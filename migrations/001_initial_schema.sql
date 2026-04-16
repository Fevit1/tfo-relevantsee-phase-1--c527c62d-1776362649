-- ============================================================
-- RelevantSee Phase 1 — Initial Schema Migration
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer');
CREATE TYPE campaign_status AS ENUM ('draft', 'pending', 'approved', 'rejected');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'expired');
CREATE TYPE approval_action AS ENUM ('approve', 'reject', 'override');

-- ============================================================
-- TABLE: accounts
-- Top-level tenant record. Parent of all account-scoped data.
-- ============================================================

CREATE TABLE accounts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  brand_voice       text,
  tone_keywords     text[] NOT NULL DEFAULT '{}',
  banned_phrases    text[] NOT NULL DEFAULT '{}',
  example_content   jsonb NOT NULL DEFAULT '[]',
  logo_url          text,
  primary_color     text,
  plan              text NOT NULL DEFAULT 'phase1',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE accounts IS 'Top-level tenant record. Parent of all account-scoped data.';
COMMENT ON COLUMN accounts.example_content IS 'Array of up to 3 example approved content objects for brand model.';
COMMENT ON COLUMN accounts.plan IS 'Reserved for Phase 2 plan/tier differentiation. Default: phase1.';

-- ============================================================
-- TABLE: users
-- Platform users. ID matches Supabase Auth UID.
-- ============================================================

CREATE TABLE users (
  id                uuid PRIMARY KEY,
  account_id        uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email             text NOT NULL,
  role              user_role NOT NULL DEFAULT 'editor',
  full_name         text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'Platform users. id matches Supabase Auth UID. Role enum enforces RBAC.';
COMMENT ON COLUMN users.id IS 'Matches Supabase Auth UID exactly. Set on insert, never generated.';

CREATE UNIQUE INDEX users_email_account_idx ON users(email, account_id);
CREATE INDEX users_account_id_idx ON users(account_id);
CREATE INDEX users_account_role_idx ON users(account_id, role);

-- ============================================================
-- TABLE: campaigns
-- Core campaign record. Status state machine:
-- draft -> pending -> approved | rejected -> draft (via reopen)
-- ============================================================

CREATE TABLE campaigns (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by          uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name                text NOT NULL,
  brief               text NOT NULL CHECK (char_length(brief) <= 2000),
  channels            text[] NOT NULL DEFAULT '{}',
  status              campaign_status NOT NULL DEFAULT 'draft',
  brand_score         integer CHECK (brand_score >= 0 AND brand_score <= 100),
  generated_content   jsonb NOT NULL DEFAULT '{"_schema_version": 1}',
  approval_notes      text,
  approved_by         uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at         timestamptz,
  campaign_version    integer NOT NULL DEFAULT 1,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE campaigns IS 'Core campaign record. Status state machine: draft->pending->approved|rejected->draft.';
COMMENT ON COLUMN campaigns.generated_content IS 'JSONB with _schema_version:1. Contains email, social, ads channel content.';
COMMENT ON COLUMN campaigns.campaign_version IS 'Incremented on reopen (rejected->draft). Used for brand_score_log versioning.';
COMMENT ON COLUMN campaigns.brief IS 'Max 2000 characters enforced by CHECK constraint and server-side validation.';

CREATE INDEX campaigns_account_status_idx ON campaigns(account_id, status);
CREATE INDEX campaigns_account_id_idx ON campaigns(account_id);
CREATE INDEX campaigns_created_by_idx ON campaigns(created_by);
CREATE INDEX campaigns_status_idx ON campaigns(status);

-- ============================================================
-- TABLE: campaign_status_log
-- Append-only audit trail for all campaign status transitions.
-- No UPDATE or DELETE permitted for authenticated users.
-- ============================================================

CREATE TABLE campaign_status_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  actor_user_id   uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  from_status     campaign_status,
  to_status       campaign_status NOT NULL,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE campaign_status_log IS 'Append-only audit trail for campaign status transitions. No updates or deletes by any user-facing role.';

CREATE INDEX campaign_status_log_campaign_id_idx ON campaign_status_log(campaign_id);
CREATE INDEX campaign_status_log_campaign_created_idx ON campaign_status_log(campaign_id, created_at);

-- ============================================================
-- TABLE: campaign_approval_log
-- Append-only audit trail for approve, reject, override actions.
-- Captures override flag and pre-override score.
-- ============================================================

CREATE TABLE campaign_approval_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  admin_user_id       uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action              approval_action NOT NULL,
  override_flag       boolean NOT NULL DEFAULT false,
  pre_override_score  integer CHECK (pre_override_score >= 0 AND pre_override_score <= 100),
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE campaign_approval_log IS 'Append-only audit trail for approve/reject/override actions. Records override flag and pre-override score.';

CREATE INDEX campaign_approval_log_campaign_id_idx ON campaign_approval_log(campaign_id);
CREATE INDEX campaign_approval_log_admin_user_idx ON campaign_approval_log(admin_user_id);

-- ============================================================
-- TABLE: brand_score_log
-- Append-only scoring history. One row per scoring run per
-- campaign version.
-- ============================================================

CREATE TABLE brand_score_log (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id                 uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  campaign_version            integer NOT NULL DEFAULT 1,
  phase1_passed               boolean NOT NULL,
  phase1_banned_phrase_hits   text[] NOT NULL DEFAULT '{}',
  phase2_claude_score         integer CHECK (phase2_claude_score >= 0 AND phase2_claude_score <= 100),
  final_score                 integer NOT NULL CHECK (final_score >= 0 AND final_score <= 100),
  created_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE brand_score_log IS 'Append-only brand scoring history. One row per scoring run per campaign version.';
COMMENT ON COLUMN brand_score_log.phase1_banned_phrase_hits IS 'List of banned phrases detected during phase 1 deterministic check.';
COMMENT ON COLUMN brand_score_log.phase2_claude_score IS 'NULL if phase1 failed (scoring short-circuits on phase 1 failure).';

CREATE INDEX brand_score_log_campaign_id_idx ON brand_score_log(campaign_id);
CREATE INDEX brand_score_log_campaign_version_idx ON brand_score_log(campaign_id, campaign_version);

-- ============================================================
-- TABLE: team_invites
-- Invite tokens for onboarding new team members. 7-day expiry.
-- ============================================================

CREATE TABLE team_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  invited_by    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  email         text NOT NULL,
  role          user_role NOT NULL DEFAULT 'editor',
  token         text NOT NULL UNIQUE,
  status        invite_status NOT NULL DEFAULT 'pending',
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE team_invites IS 'Invite tokens for onboarding new team members. Tokens expire in 7 days.';
COMMENT ON COLUMN team_invites.token IS '32-byte cryptographically random hex string. Unique. Single-use.';

CREATE UNIQUE INDEX team_invites_token_idx ON team_invites(token);
CREATE INDEX team_invites_account_id_idx ON team_invites(account_id);
CREATE INDEX team_invites_email_account_idx ON team_invites(email, account_id);
CREATE INDEX team_invites_status_idx ON team_invites(account_id, status);

-- ============================================================
-- updated_at TRIGGER FUNCTION
-- Automatically updates updated_at on row modification.
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER team_invites_updated_at
  BEFORE UPDATE ON team_invites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_approval_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_score_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTION: get_my_account_id()
-- Returns the account_id for the currently authenticated user.
-- Used in RLS policies to scope queries to the user's account.
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_account_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT account_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- HELPER FUNCTION: get_my_role()
-- Returns the role for the currently authenticated user.
-- Used in RLS policies for role-gated access.
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM users WHERE id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- RLS POLICIES: accounts
-- Users can only read/update their own account.
-- Only service role can insert or delete accounts.
-- ============================================================

CREATE POLICY "accounts_select_own"
  ON accounts
  FOR SELECT
  TO authenticated
  USING (id = get_my_account_id());

CREATE POLICY "accounts_update_admin_only"
  ON accounts
  FOR UPDATE
  TO authenticated
  USING (
    id = get_my_account_id()
    AND get_my_role() = 'admin'
  )
  WITH CHECK (
    id = get_my_account_id()
    AND get_my_role() = 'admin'
  );

-- INSERT and DELETE on accounts reserved for service role only (no policy = denied for authenticated)

-- ============================================================
-- RLS POLICIES: users
-- All authenticated users can read members of their own account.
-- Admins can update/delete users in their account (server enforces last-admin guard).
-- INSERT reserved for service role (account provisioning + invite acceptance via service client).
-- ============================================================

CREATE POLICY "users_select_same_account"
  ON users
  FOR SELECT
  TO authenticated
  USING (account_id = get_my_account_id());

CREATE POLICY "users_update_admin_only"
  ON users
  FOR UPDATE
  TO authenticated
  USING (
    account_id = get_my_account_id()
    AND get_my_role() = 'admin'
  )
  WITH CHECK (
    account_id = get_my_account_id()
    AND get_my_role() = 'admin'
  );

CREATE POLICY "users_delete_admin_only"
  ON users
  FOR DELETE
  TO authenticated
  USING (
    account_id = get_my_account_id()
    AND get_my_role() = 'admin'
  );

-- Users can read their own record (covers the self-lookup for role fetch)
CREATE POLICY "users_select_self"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- ============================================================
-- RLS POLICIES: campaigns
-- All roles can read campaigns in their account.
-- Admin and editor can insert campaigns.
-- Admin and editor can update campaigns (server enforces draft-only restriction).
-- Delete reserved for service role only.
-- ============================================================

CREATE POLICY "campaigns_select_same_account"
  ON campaigns
  FOR SELECT
  TO authenticated
  USING (account_id = get_my_account_id());

CREATE POLICY "campaigns_insert_admin_editor"
  ON campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_my_account_id()
    AND get_my_role() IN ('admin', 'editor')
  );

CREATE POLICY "campaigns_update_admin_editor"
  ON campaigns
  FOR UPDATE
  TO authenticated
  USING (
    account_id = get_my_account_id()
    AND get_my_role() IN ('admin', 'editor')
  )
  WITH CHECK (
    account_id = get_my_account_id()
    AND get_my_role() IN ('admin', 'editor')
  );

-- ============================================================
-- RLS POLICIES: campaign_status_log
-- Append-only: authenticated users can INSERT and SELECT only.
-- UPDATE and DELETE are denied for all authenticated users.
-- Scoped to campaigns in the user's account.
-- ============================================================

CREATE POLICY "campaign_status_log_select_same_account"
  ON campaign_status_log
  FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE account_id = get_my_account_id()
    )
  );

CREATE POLICY "campaign_status_log_insert_admin_editor"
  ON campaign_status_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns WHERE account_id = get_my_account_id()
    )
    AND get_my_role() IN ('admin', 'editor')
  );

-- No UPDATE policy = UPDATE denied for authenticated users
-- No DELETE policy = DELETE denied for authenticated users

-- ============================================================
-- RLS POLICIES: campaign_approval_log
-- Append-only: authenticated users can INSERT (admin only) and SELECT.
-- UPDATE and DELETE denied for all authenticated users.
-- Scoped to campaigns in the user's account.
-- ============================================================

CREATE POLICY "campaign_approval_log_select_same_account"
  ON campaign_approval_log
  FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE account_id = get_my_account_id()
    )
  );

CREATE POLICY "campaign_approval_log_insert_admin_only"
  ON campaign_approval_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns WHERE account_id = get_my_account_id()
    )
    AND get_my_role() = 'admin'
  );

-- No UPDATE policy = UPDATE denied for authenticated users
-- No DELETE policy = DELETE denied for authenticated users

-- ============================================================
-- RLS POLICIES: brand_score_log
-- Append-only: authenticated users can INSERT (admin|editor) and SELECT.
-- UPDATE and DELETE denied for all authenticated users.
-- Scoped to campaigns in the user's account.
-- ============================================================

CREATE POLICY "brand_score_log_select_same_account"
  ON brand_score_log
  FOR SELECT
  TO authenticated
  USING (
    campaign_id IN (
      SELECT id FROM campaigns WHERE account_id = get_my_account_id()
    )
  );

CREATE POLICY "brand_score_log_insert_admin_editor"
  ON brand_score_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM campaigns WHERE account_id = get_my_account_id()
    )
    AND get_my_role() IN ('admin', 'editor')
  );

-- No UPDATE policy = UPDATE denied for authenticated users
-- No DELETE policy = DELETE denied for authenticated users

-- ============================================================
-- RLS POLICIES: team_invites
-- Admins can SELECT, INSERT invites for their account.
-- No UPDATE or DELETE from authenticated users (status updates
-- and expiry processing done via service role in API handlers).
-- Public SELECT on token lookup is handled by service role client
-- in the public invite validation endpoint (bypasses RLS).
-- ============================================================

CREATE POLICY "team_invites_select_admin_only"
  ON team_invites
  FOR SELECT
  TO authenticated
  USING (
    account_id = get_my_account_id()
    AND get_my_role() = 'admin'
  );

CREATE POLICY "team_invites_insert_admin_only"
  ON team_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id = get_my_account_id()
    AND get_my_role() = 'admin'
  );

-- No UPDATE/DELETE for authenticated users
-- Token validation and accept endpoints use service role client to bypass RLS

-- ============================================================
-- SEED DATA: No seed data required for Phase 1.
-- Accounts and users are provisioned via /api/admin/seed-account.
-- ============================================================

-- ============================================================
-- MIGRATION COMPLETE
-- Tables: accounts, users, campaigns, campaign_status_log,
--         campaign_approval_log, brand_score_log, team_invites
-- RLS: Enabled on all 7 tables
-- Policies: Defined and scoped to account_id
-- Audit log tables: INSERT-only for authenticated users
-- ============================================================
