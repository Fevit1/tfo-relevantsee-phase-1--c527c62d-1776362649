import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { Resend } from 'resend'

/**
 * POST /api/campaigns/[id]/reject
 *
 * Admin only. Rejects a pending campaign.
 * Requires non-empty notes (422 if empty).
 * Transitions pending -> rejected.
 * Notifies campaign creator via Resend with rejection notes.
 *
 * Body: { notes: string } — required
 */
export async function POST(req, { params }) {
  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  if (authContext.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const { id } = params

  if (!id) {
    return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body — notes are required for rejection' }, { status: 400 })
  }

  const { notes } = body

  // Notes are required on rejection
  if (!notes || typeof notes !== 'string' || !notes.trim()) {
    return NextResponse.json(
      { error: 'Rejection notes are required and must be non-empty' },
      { status: 422 }
    )
  }

  const serviceClient = createServiceClient()

  // Fetch campaign
  const { data: campaign, error: campaignError } = await serviceClient
    .from('campaigns')
    .select('id, name, status, brand_score, account_id, created_by')
    .eq('id', id)
    .eq('account_id', authContext.accountId)
    .single()

  if (campaignError || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }

  if (campaign.status !== 'pending') {
    return NextResponse.json(
      { error: 'Campaign must be in pending status to reject', current_status: campaign.status },
      { status: 409 }
    )
  }

  // Transition pending -> rejected
  const { data: updatedCampaign, error: updateError } = await serviceClient
    .from('campaigns')
    .update({
      status: 'rejected',
      approval_notes: notes.trim(),
    })
    .eq('id', id)
    .select('id, name, status, brand_score, approval_notes')
    .single()

  if (updateError || !updatedCampaign) {
    console.error('[campaigns/reject] Status update failed:', updateError?.message)
    return NextResponse.json({ error: 'Failed to reject campaign' }, { status: 500 })
  }

  // Log to campaign_approval_log
  const { error: approvalLogError } = await serviceClient
    .from('campaign_approval_log')
    .insert({
      campaign_id: id,
      admin_user_id: authContext.userId,
      action: 'reject',
      override_flag: false,
      pre_override_score: null,
      notes: notes.trim(),
    })

  if (approvalLogError) {
    console.error('[campaigns/reject] Approval log insert failed (non-fatal):', approvalLogError?.message)
  }

  // Log status transition
  const { error: statusLogError } = await serviceClient
    .from('campaign_status_log')
    .insert({
      campaign_id: id,
      actor_user_id: authContext.userId,
      from_status: 'pending',
      to_status: 'rejected',
      notes: notes.trim(),
    })

  if (statusLogError) {
    console.error('[campaigns/reject] Status log insert failed (non-fatal):', statusLogError?.message)
  }

  // Notify campaign creator via Resend with rejection notes
  try {
    const { data: creator } = await serviceClient
      .from('users')
      .select('email, full_name')
      .eq('id', campaign.created_by)
      .single()

    if (creator) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      await resend.emails.send({
        from: 'RelevantSee <noreply@relevantsee.com>',
        to: creator.email,
        subject: `Campaign requires revision: ${campaign.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #dc2626;">Campaign Needs Revision</h2>
            <p style="color: #6b7280;">Your campaign <strong>"${campaign.name}"</strong> has been returned for revision.</p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #991b1b; font-weight: 600; margin: 0 0 8px;">Reviewer Notes:</p>
              <p style="color: #7f1d1d; margin: 0;">${notes.trim()}</p>
            </div>
            <p style="color: #6b7280;">You can open the campaign, make revisions, and resubmit for approval.</p>
            <a href="${appUrl}/campaigns/${id}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 16px;">
              View Campaign
            </a>
          </div>
        `,
      })
    }
  } catch (emailErr) {
    console.error('[campaigns/reject] Creator notification email failed (non-fatal):', emailErr?.message)
  }

  return NextResponse.json({ campaign: updatedCampaign })
}