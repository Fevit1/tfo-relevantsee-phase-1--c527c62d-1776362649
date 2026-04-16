import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import DOMPurify from 'isomorphic-dompurify'

const BRIEF_MAX_LENGTH = 2000

/**
 * Deterministic seeded mock metrics for demo data.
 * Uses a simple hash of the campaign ID to produce stable values.
 * Same campaign ID always returns same metrics.
 *
 * @param {string} campaignId - UUID string
 * @returns {{ impressions: number, clicks: number, ctr: string, conversions: number }}
 */
function getSeedMetrics(campaignId) {
  // Simple deterministic hash from UUID chars
  const chars = campaignId.replace(/-/g, '')
  let hash = 0
  for (let i = 0; i < chars.length; i++) {
    hash = ((hash << 5) - hash + parseInt(chars[i], 16)) | 0
  }
  const abs = Math.abs(hash)

  // Luxury brand realistic ranges
  const impressions = 15000 + (abs % 85000)          // 15k–100k
  const clicks = 300 + (abs % 4700)                   // 300–5000
  const conversions = 5 + (abs % 195)                 // 5–200
  const ctr = ((clicks / impressions) * 100).toFixed(2) + '%'

  return { impressions, clicks, ctr, conversions, demo_data: true }
}

/**
 * GET /api/campaigns/[id]
 *
 * All roles. Returns full campaign detail including generated_content,
 * brand_score, status, score history, status log, and seeded mock metrics.
 */
export async function GET(req, { params }) {
  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  const { id } = params

  if (!id) {
    return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch campaign — RLS ensures account isolation
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (campaignError || !campaign) {
    if (campaignError?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    console.error('[campaigns/id/GET] Query failed:', campaignError?.message)
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 })
  }

  // Fetch status log
  const { data: statusLog } = await supabase
    .from('campaign_status_log')
    .select('id, actor_user_id, from_status, to_status, notes, created_at')
    .eq('campaign_id', id)
    .order('created_at', { ascending: true })

  // Fetch approval log
  const { data: approvalLog } = await supabase
    .from('campaign_approval_log')
    .select('id, admin_user_id, action, override_flag, pre_override_score, notes, created_at')
    .eq('campaign_id', id)
    .order('created_at', { ascending: true })

  // Fetch brand score log
  const { data: scoreLog } = await supabase
    .from('brand_score_log')
    .select('id, campaign_version, phase1_passed, phase1_banned_phrase_hits, phase2_claude_score, final_score, created_at')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false })

  // Seeded mock metrics
  const mockMetrics = getSeedMetrics(id)

  return NextResponse.json({
    campaign,
    status_log: statusLog || [],
    approval_log: approvalLog || [],
    score_log: scoreLog || [],
    mock_metrics: mockMetrics,
  })
}

/**
 * PATCH /api/campaigns/[id]
 *
 * Admin | Editor. Updates campaign fields while in draft status.
 * Returns 409 if campaign is not in draft status.
 * Re-sanitizes html_body server-side on every update.
 * Validates brief <= 2000 chars.
 */
export async function PATCH(req, { params }) {
  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  if (!['admin', 'editor'].includes(authContext.role)) {
    return NextResponse.json({ error: 'Forbidden — admin or editor role required' }, { status: 403 })
  }

  const { id } = params

  if (!id) {
    return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = await createClient()

  // Fetch current campaign to verify status
  const { data: existingCampaign, error: fetchError } = await supabase
    .from('campaigns')
    .select('id, status, account_id, generated_content')
    .eq('id', id)
    .single()

  if (fetchError || !existingCampaign) {
    if (fetchError?.code === 'PGRST116') {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to fetch campaign' }, { status: 500 })
  }

  // Enforce draft-only updates
  if (existingCampaign.status !== 'draft') {
    return NextResponse.json(
      { error: 'Campaign can only be updated while in draft status', current_status: existingCampaign.status },
      { status: 409 }
    )
  }

  // Build update payload — only allow safe fields
  const updates = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 422 })
    }
    updates.name = body.name.trim()
  }

  if (body.brief !== undefined) {
    if (typeof body.brief !== 'string' || !body.brief.trim()) {
      return NextResponse.json({ error: 'brief must be a non-empty string' }, { status: 422 })
    }
    if (body.brief.length > BRIEF_MAX_LENGTH) {
      return NextResponse.json(
        { error: `brief exceeds maximum length of ${BRIEF_MAX_LENGTH} characters`, max_length: BRIEF_MAX_LENGTH, provided_length: body.brief.length },
        { status: 422 }
      )
    }
    updates.brief = body.brief.trim()
  }

  if (body.channels !== undefined) {
    if (!Array.isArray(body.channels) || body.channels.length === 0) {
      return NextResponse.json({ error: 'channels must be a non-empty array' }, { status: 422 })
    }
    updates.channels = body.channels
  }

  // Handle generated_content update with HTML sanitization
  if (body.generated_content !== undefined) {
    if (typeof body.generated_content !== 'object' || body.generated_content === null) {
      return NextResponse.json({ error: 'generated_content must be an object' }, { status: 422 })
    }

    const gc = { ...body.generated_content }

    // Ensure schema version is preserved
    if (!gc._schema_version) {
      gc._schema_version = 1
    }

    // Sanitize HTML email body server-side with DOMPurify before persistence
    if (gc.email && gc.email.html_body && typeof gc.email.html_body === 'string') {
      gc.email.html_body = DOMPurify.sanitize(gc.email.html_body, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'div', 'span', 'img', 'table', 'tr', 'td', 'th', 'thead', 'tbody'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'style', 'class', 'width', 'height', 'align', 'valign', 'border', 'cellpadding', 'cellspacing'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onsubmit'],
      })
    }

    updates.generated_content = gc
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  const { data: updatedCampaign, error: updateError } = await serviceClient
    .from('campaigns')
    .update(updates)
    .eq('id', id)
    .eq('account_id', authContext.accountId)
    .select('id, name, brief, channels, status, brand_score, generated_content, updated_at')
    .single()

  if (updateError || !updatedCampaign) {
    console.error('[campaigns/id/PATCH] Update failed:', updateError?.message)
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
  }

  return NextResponse.json({ campaign: updatedCampaign })
}