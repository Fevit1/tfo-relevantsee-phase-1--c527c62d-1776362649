import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { Resend } from 'resend'

const BRAND_SCORE_GATE = 85

/**
 * POST /api/campaigns/[id]/submit
 *
 * Admin | Editor. Submits campaign for approval.
 * Enforces brand_score >= 85 for editors (422 if below).
 * Admins bypass the gate (they can submit regardless — override is via /approve).
 * Transitions draft -> pending.
 * Notifies all account admins via Resend.
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

  // Validate status transition
  if (campaign.status !== 'draft') {
    return NextResponse.json(
      { error: 'Campaign must be in draft status to submit', current_status: campaign.status },
      { status: 409 }
    )
  }

  // Brand score gate — editors cannot submit below 85
  // Admins are exempt from the gate (they can submit regardless)
  if (authContext.role === 'editor') {
    const score = campaign.brand_score ?? 0
    if (score < BRAND_SCORE_GATE) {
      return NextResponse.json(
        {
          error: `Brand score must be at least ${BRAND_SCORE_GATE} to submit. Current score: ${score}`,
          brand_score: score,
          required_score: BRAND_SCORE_GATE,
        },
        { status: 422 }
      )
    }
  }

  // Transition draft -> pending
  const { data: updatedCampaign, error: updateError } = await serviceClient
    .from('campaigns')
    .update({ status: 'pending' })
    .eq('id', id)
    .select('id, name, status, brand_score')
    .single()

  if (updateError || !updatedCampaign) {
    console.error('[campaigns/submit] Status update failed:', updateError?.message)
    return NextResponse.json({ error: 'Failed to submit campaign' }, { status: 500 })
  }

  // Log status transition
  const { error: logError } = await serviceClient
    .from('campaign_status_log')
    .insert({
      campaign_id: id,
      actor_user_id: authContext.userId,
      from_status: 'draft',
      to_status: 'pending',
      notes: 'Campaign submitted for approval',
    })

  if (logError) {
    console.error('[campaigns/submit] Status log insert failed (non-fatal):', logError?.message)
  }

  // Notify all account admins via Resend
  try {
    const { data: admins } = await serviceClient
      .from('users')
      .select('email, full_name')
      .eq('account_id', authContext.accountId)
      .eq('role', 'admin')

    if (admins && admins.length > 0) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

      await Promise.allSettled(
        admins.map(admin =>
          resend.emails.send({
            from: 'RelevantSee <noreply@relevantsee.com>',
            to: admin.email,
            subject: `Campaign submitted for approval: ${campaign.name}`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h2 style="color: #1f2937;">Campaign Awaiting Approval</h2>
                <p style="color: #6b7280;">The campaign <strong>"${campaign.name}"</strong> has been submitted for your review.</p>
                <p style="color: #6b7280;">Brand Score: <strong>${campaign.brand_score ?? 'Not scored'}</strong></p>
                <a href="${appUrl}/campaigns/${id}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; margin-top: 16px;">
                  Review Campaign
                </a>
              </div>
            `,
          })
        )
      )
    }
  } catch (emailErr) {
    console.error('[campaigns/submit] Admin notification email failed (non-fatal):', emailErr?.message)
  }

  return NextResponse.json({ campaign: updatedCampaign })
}