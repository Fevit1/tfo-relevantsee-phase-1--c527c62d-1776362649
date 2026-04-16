import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'

const BRIEF_MAX_LENGTH = 2000
const DEFAULT_PAGE_SIZE = 20

/**
 * POST /api/campaigns
 *
 * Admin | Editor. Creates a new campaign in draft status.
 * Validates brief <= 2000 chars and non-empty channels array.
 * Inserts initial row into campaign_status_log.
 *
 * Body: { name: string, brief: string, channels: string[] }
 */
export async function POST(req) {
  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  if (!['admin', 'editor'].includes(authContext.role)) {
    return NextResponse.json({ error: 'Forbidden — admin or editor role required' }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, brief, channels } = body

  // Validate name
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 422 })
  }

  // Validate brief — server-side enforcement of 2000 char limit
  if (!brief || typeof brief !== 'string' || !brief.trim()) {
    return NextResponse.json({ error: 'brief is required' }, { status: 422 })
  }
  if (brief.length > BRIEF_MAX_LENGTH) {
    return NextResponse.json(
      { error: `brief exceeds maximum length of ${BRIEF_MAX_LENGTH} characters`, max_length: BRIEF_MAX_LENGTH, provided_length: brief.length },
      { status: 422 }
    )
  }

  // Validate channels
  if (!Array.isArray(channels) || channels.length === 0) {
    return NextResponse.json({ error: 'channels must be a non-empty array' }, { status: 422 })
  }
  const validChannels = ['email', 'social', 'ads']
  const invalidChannels = channels.filter(c => !validChannels.includes(c))
  if (invalidChannels.length > 0) {
    return NextResponse.json(
      { error: `Invalid channels: ${invalidChannels.join(', ')}. Valid values: ${validChannels.join(', ')}` },
      { status: 422 }
    )
  }

  const serviceClient = createServiceClient()

  // Insert campaign
  const { data: campaign, error: campaignError } = await serviceClient
    .from('campaigns')
    .insert({
      account_id: authContext.accountId,
      created_by: authContext.userId,
      name: name.trim(),
      brief: brief.trim(),
      channels,
      status: 'draft',
      generated_content: { _schema_version: 1 },
    })
    .select('id, name, brief, channels, status, brand_score, created_at, updated_at, campaign_version')
    .single()

  if (campaignError || !campaign) {
    console.error('[campaigns/POST] Insert failed:', campaignError?.message)
    return NextResponse.json(
      { error: 'Failed to create campaign', details: campaignError?.message },
      { status: 500 }
    )
  }

  // Insert initial status log entry
  const { error: logError } = await serviceClient
    .from('campaign_status_log')
    .insert({
      campaign_id: campaign.id,
      actor_user_id: authContext.userId,
      from_status: null,
      to_status: 'draft',
      notes: 'Campaign created',
    })

  if (logError) {
    console.error('[campaigns/POST] Status log insert failed (non-fatal):', logError?.message)
  }

  return NextResponse.json({ campaign }, { status: 201 })
}

/**
 * GET /api/campaigns
 *
 * All roles. Returns paginated campaign list for the account.
 * Excludes generated_content from response.
 * Supports ?status=draft|pending|approved|rejected and ?page=N&page_size=N
 */
export async function GET(req) {
  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  const { searchParams } = new URL(req.url)
  const statusFilter = searchParams.get('status')
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || String(DEFAULT_PAGE_SIZE), 10)))
  const offset = (page - 1) * pageSize

  const validStatuses = ['draft', 'pending', 'approved', 'rejected']
  if (statusFilter && !validStatuses.includes(statusFilter)) {
    return NextResponse.json(
      { error: `Invalid status filter. Valid values: ${validStatuses.join(', ')}` },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Build query — RLS scopes to authenticated user's account
  let query = supabase
    .from('campaigns')
    .select(
      'id, name, brief, channels, status, brand_score, created_by, approved_by, approved_at, created_at, updated_at, campaign_version',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data: campaigns, error, count } = await query

  if (error) {
    console.error('[campaigns/GET] Query failed:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
  }

  const totalPages = Math.ceil((count || 0) / pageSize)

  return NextResponse.json({
    campaigns: campaigns || [],
    pagination: {
      page,
      page_size: pageSize,
      total: count || 0,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  })
}