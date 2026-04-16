import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * GET /api/team/invite/[token]
 *
 * Public endpoint — validates an invite token.
 * Uses service client to bypass RLS (user is unauthenticated).
 * Returns account name, role, and email for the invite page UI.
 */
export async function GET(req, { params }) {
  const { token } = params

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  const serviceClient = createServiceClient()

  const { data: invite, error: inviteError } = await serviceClient
    .from('team_invites')
    .select('id, account_id, email, role, status, expires_at')
    .eq('token', token)
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  // Check if expired or accepted
  const now = new Date()
  const expiresAt = new Date(invite.expires_at)

  if (invite.status === 'accepted') {
    return NextResponse.json({ error: 'This invite has already been accepted' }, { status: 410 })
  }

  if (invite.status === 'expired' || now > expiresAt) {
    // Update status to expired if not already
    if (invite.status !== 'expired') {
      await serviceClient
        .from('team_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id)
    }
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
  }

  // Fetch account name
  const { data: account } = await serviceClient
    .from('accounts')
    .select('name')
    .eq('id', invite.account_id)
    .single()

  return NextResponse.json({
    account_name: account?.name || 'Unknown',
    role: invite.role,
    email: invite.email,
    expires_at: invite.expires_at,
  })
}