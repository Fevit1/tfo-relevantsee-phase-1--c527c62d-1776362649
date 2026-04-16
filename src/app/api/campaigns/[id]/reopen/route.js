import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/campaigns/[id]/reopen
 *
 * Admin | Editor. Reopens a rejected campaign.
 * Transitions rejected -> draft.
 * Moves prior approval_notes to status log entry.
 * Increments campaign_version for brand_score_log versioning.
 * Clears approval_notes from campaign row.
 *
 * Body: { notes?: string } — optional editor notes for the reopen
 */
export async function POST(req, { params }) {
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

  let body = {}
  try {
    body = await req.json()
  } catch {
    // Body is optional
  }

  const { notes } = body

  const serviceClient = createServiceClient()

  // Fetch campaign
  const { data: campaign, error: campaignError } = await serviceClient
    .from('campaigns')
    .select('id, name, status, brand_score, campaign_version, approval_notes, account_id')
    .eq('id', id)
    .eq('account_id', authContext.accountId)
    .single()

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (campaign.status !== 'rejected') {
    return NextResponse.json(
      { error: 'Campaign must be in rejected status to reopen', current_status: campaign.status },
      { status: 409 }
    )
  }

  const newVersion = (campaign.campaign_version || 1) + 1
  const priorNotes = campaign.approval_notes

  // Transition rejected -> draft, increment version, clear approval_notes
  const { data: updatedCampaign, error: updateError } = await serviceClient
    .from('campaigns')
    .update({
      status: 'draft',
      campaign_version: newVersion,
      approval_notes: null, // Clear prior rejection notes from campaign row
    })
    .eq('id', id)
    .select('id, name, status, brand_score, campaign_version, approval_notes')
    .single()

  if (updateError || !updatedCampaign) {
    console.error('[campaigns/reopen] Status update failed:', updateError?.message)
    return NextResponse.json({ error: 'Failed to reopen campaign' }, { status: 500 })
  }

  // Log status transition — include prior rejection notes in log
  const logNotes = [
    notes ? `Editor note: ${notes}` : null,
    priorNotes ? `Prior rejection reason: ${priorNotes}` : null,
  ].filter(Boolean).join(' | ') || 'Campaign reopened for revision'

  const { error: logError } = await serviceClient
    .from('campaign_status_log')
    .insert({
      campaign_id: id,
      actor_user_id: authContext.userId,
      from_status: 'rejected',
      to_status: 'draft',
      notes: logNotes,
    })

  if (logError) {
    console.error('[campaigns/reopen] Status log insert failed (non-fatal):', logError?.message)
  }

  return NextResponse.json({
    campaign: updatedCampaign,
    new_version: newVersion,
  })
}