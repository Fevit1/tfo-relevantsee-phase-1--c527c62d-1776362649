-- ============================================================
-- RelevantSee Phase 1 — Rollback Migration
-- Drops all tables, types, functions, and triggers in
-- dependency-safe order (children before parents).
-- ============================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS team_invites_updated_at ON team_invites;
DROP TRIGGER IF EXISTS campaigns_updated_at ON campaigns;
DROP TRIGGER IF EXISTS users_updated_at ON users;
DROP TRIGGER IF EXISTS accounts_updated_at ON accounts;

-- Drop helper functions
DROP FUNCTION IF EXISTS get_my_role();
DROP FUNCTION IF EXISTS get_my_account_id();
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS brand_score_log CASCADE;
DROP TABLE IF EXISTS campaign_approval_log CASCADE;
DROP TABLE IF EXISTS campaign_status_log CASCADE;
DROP TABLE IF EXISTS team_invites CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- Drop enums
DROP TYPE IF EXISTS approval_action;
DROP TYPE IF EXISTS invite_status;
DROP TYPE IF EXISTS campaign_status;
DROP TYPE IF EXISTS user_role;
