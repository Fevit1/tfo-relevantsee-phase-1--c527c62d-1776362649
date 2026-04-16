import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import crypto from 'crypto'
import { checkRateLimit } from '@/lib/rateLimit'

const TEAM_SOFT_CAP = 25

/**
 * POST /api/team/invite
 *
 * Admin only. Creates a team invite with a 7-day expiry.
 * Generates a 32-byte cryptographically random hex token.
 * Sends invite email via Resend.
 * Returns soft-cap warning if member count >= 25.
 *
 * Body: { email: string, role: 'admin' | 'editor' | 'viewer' }
 */
export async function POST(req) {
  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  if (authContext.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  // Rate limit: 20 invites per account per hour
  const rateCheck = checkRateLimit('invite', authContext.accountId, 20, 3600)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many invite requests. Please wait before sending more invites.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateCheck.retryAfter) },
      }
    )
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, role } = body

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 422 })
  }

  if (!role || !['admin', 'editor', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'role must be admin, editor, or viewer' }, { status: 422 })
  }

  const serviceClient = createServiceClient()
  const supabase = await createClient()

  // Get current member count
  const { count: memberCount } = await serviceClient
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', authContext.accountId)

  // Get pending invite count
  const { count: pendingCount } = await serviceClient
    .from('team_invites')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', authContext.accountId)
    .eq('status', 'pending')

  const totalCount = (memberCount || 0) + (pendingCount || 0)
  const softCapWarning = totalCount >= TEAM_SOFT_CAP

  // Check for existing pending invite for this email
  const { data: existingInvite } = await serviceClient
    .from('team_invites')
    .select('id')
    .eq('account_id', authContext.accountId)
    .eq('email', email.toLowerCase())
    .eq('status', 'pending')
    .single()

  if (existingInvite) {
    return NextResponse.json(
      { error: 'A pending invite already exists for this email address' },
      { status: 409 }
    )
  }

  // Check if user already exists in the account
  const { data: existingUser } = await serviceClient
    .from('users')
    .select('id')
    .eq('account_id', authContext.accountId)
    .eq('email', email.toLowerCase())
    .single()

  if (existingUser) {
    return NextResponse.json(
      { error: 'A user with this email already exists in your account' },
      { status: 409 }
    )
  }

  // Get inviting user's name for the email
  const { data: inviter } = await serviceClient
    .from('users')
    .select('full_name, email')
    .eq('id', authContext.userId)
    .single()

  // Get account name
  const { data: account } = await serviceClient
    .from('accounts')
    .select('name')
    .eq('id', authContext.accountId)
    .single()

  // Generate 32-byte cryptographically random token
  const token = crypto.randomBytes(32).toString('hex')

  // 7-day expiry
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  // Insert invite
  const { data: invite, error: inviteError } = await serviceClient
    .from('team_invites')
    .insert({
      account_id: authContext.accountId,
      invited_by: authContext.userId,
      email: email.toLowerCase(),
      role,
      token,
      status: 'pending',
      expires_at: expiresAt.toISOString(),
    })
    .select('id, email, role, created_at, expires_at')
    .single()

  if (inviteError || !invite) {
    console.error('[team/invite] Insert failed:', inviteError?.message)
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
  }

  // Send invite email via Resend
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const inviteLink = `${appUrl}/invite/${token}`
  const inviterName = inviter?.full_name || inviter?.email || 'Your team admin'
  const accountName = account?.name || 'your team'

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'RelevantSee <noreply@relevantsee.com>',
      to: email,
      subject: `You've been invited to join ${accountName} on RelevantSee`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #1f2937;">You've been invited to RelevantSee</h2>
          <p style="color: #6b7280;"><strong>${inviterName}</strong> has invited you to join <strong>${accountName}</strong> as a <strong>${role}</strong>.</p>
          <p style="color: #6b7280;">RelevantSee is an AI-powered marketing campaign copilot for luxury brands.</p>
          <div style="margin: 24px 0;">
            <a href="${inviteLink}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Accept Invite
            </a>
          </div>
          <p style="color: #9ca3af; font-size: 12px;">This invite expires in 7 days. If you did not expect this invitation, you can safely ignore this email.</p>
          <p style="color: #9ca3af; font-size: 12px;">Or copy this link: ${inviteLink}</p>
        </div>
      `,
    })
  } catch (emailErr) {
    console.error('[team/invite] Email send failed (non-fatal):', emailErr?.message)
    // Non-fatal — invite was created, email failed
  }

  const response = {
    success: true,
    invite,
  }

  if (softCapWarning) {
    response.warning = `Your account has ${totalCount} members and pending invites. The recommended limit is ${TEAM_SOFT_CAP}.`
    response.soft_cap_reached = true
  }

  return NextResponse.json(response, { status: 201 })
}