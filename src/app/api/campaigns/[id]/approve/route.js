import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { Resend } from 'resend'

/**
 * POST /api/campaigns/[id]/approve
 *
 * Admin only. Approves a pending campaign.
 * Accepts optional notes and optional override_flag.
 * override_flag=true records the pre_override_score and admin who approved.
 * Transitions pending -> approved.
 * Notifies campaign creator via Resend.
 *
 * Body: { notes?: string, override_flag?: boolean }
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

  let body = {}
  try {
    body = await req.json()
  } catch {
    // Body is optional for approve
  }

  const { notes, override_flag } = body

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
      { error: 'Campaign must be in pending status to approve', current_status: campaign.status },
      { status: 409 }
    )
  }

  // Transition pending -> approved
  const { data: updatedCampaign, error: updateError } = await serviceClient
    .from('campaigns')
    .update({
      status: 'approved',
      approved_by: authContext.userId,
      approved_at: new Date().toISOString(),
      approval_notes: notes || null,
    })
    .eq('id', id)
    .select('id, name, status, brand_score, approved_by, approved_at, approval_notes')
    .single()

  if (updateError || !updatedCampaign) {
    console.error('[campaigns/approve] Status update failed:', updateError?.message)
    return NextResponse.json({ error: 'Failed to approve campaign' }, { status: 500 })
  }

  // Log to campaign_approval_log
  const approvalLogEntry = {
    campaign_id: id,
    admin_user_id: authContext.userId,
    action: override_flag ? 'override' : 'approve',
    override_flag: override_flag === true,
    pre_override_score: override_flag === true ? (campaign.brand_score ?? null) : null,
    notes: notes || null,
  }

  const { error: approvalLogError } = await serviceClient
    .from('campaign_approval_log')
    .insert(approvalLogEntry)

  if (approvalLogError) {
    console.error('[campaigns/approve] Approval log insert failed (non-fatal):', approvalLogError?.message)
  }

  // Log status transition
  const { error: statusLogError } = await serviceClient
    .from('campaign_status_log')
    .insert({
      campaign_id: id,
      actor_user_id: authContext.userId,
      from_status: 'pending',
      to_status: 'approved',
      notes: override_flag ? `Approved with override. Pre-override score: ${campaign.brand_score ?? 'N/A'}` : (notes || 'Campaign approved'),
    })

  if (statusLogError) {
    console.error('[campaigns/approve] Status log insert failed (non-fatal):', statusLogError?.message)
  }

  // Notify campaign creator via Resend
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
        subject: `Your campaign has been approved: ${campaign.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h2 style="color: #059669;">Campaign Approved ✓</h2>
            <p style="color: #6b7280;">Your campaign <strong>"${campaign.name}"</strong> has been approved.</p>
            ${notes ? `<p style="color: #6b7280;">Notes from reviewer: <em>${notes}</em></p>` : ''}
            <a href="${appUrl}/campaigns/${id}" style="display: inline-block; background-color: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 16px;">
              View Campaign
            </a>
          </div>
        `,
      })
    }
  } catch (emailErr) {
    console.error('[campaigns/approve] Creator notification email failed (non-fatal):', emailErr?.message)
  }

  return NextResponse.json({ campaign: updatedCampaign })
}