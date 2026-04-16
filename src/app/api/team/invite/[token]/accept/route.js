import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/team/invite/[token]/accept
 *
 * Public endpoint — creates Supabase Auth user, inserts into users table,
 * marks invite accepted.
 * Returns user info so the client can call supabase.auth.signInWithPassword()
 * directly with the credentials the user just entered.
 *
 * Body: { full_name: string, password: string }
 */
export async function POST(req, { params }) {
  const { token } = params

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { full_name, password } = body

  if (!full_name || typeof full_name !== 'string' || !full_name.trim()) {
    return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'password must be at least 8 characters' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Fetch invite using service role (bypasses RLS — user is unauthenticated)
  const { data: invite, error: inviteError } = await serviceClient
    .from('team_invites')
    .select('id, account_id, email, role, status, expires_at')
    .eq('token', token)
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  const now = new Date()
  const expiresAt = new Date(invite.expires_at)

  if (invite.status === 'accepted') {
    return NextResponse.json({ error: 'This invite has already been accepted' }, { status: 410 })
  }

  if (invite.status === 'expired' || now > expiresAt) {
    if (invite.status !== 'expired') {
      await serviceClient
        .from('team_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id)
    }
    return NextResponse.json({ error: 'This invite has expired' }, { status: 410 })
  }

  // Create Supabase Auth user
  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  })

  if (authError || !authData?.user) {
    if (authError?.message?.includes('already been registered') || authError?.message?.includes('already exists')) {
      return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 })
    }
    console.error('[invite/accept] Auth user creation failed:', authError?.message)
    return NextResponse.json(
      { error: 'Failed to create user account', details: authError?.message },
      { status: 500 }
    )
  }

  // Insert into users table
  const { error: userError } = await serviceClient
    .from('users')
    .insert({
      id: authData.user.id,
      account_id: invite.account_id,
      email: invite.email,
      role: invite.role,
      full_name: full_name.trim(),
    })

  if (userError) {
    // Rollback auth user
    await serviceClient.auth.admin.deleteUser(authData.user.id)
    console.error('[invite/accept] Users table insert failed:', userError?.message)
    return NextResponse.json(
      { error: 'Failed to create user record', details: userError?.message },
      { status: 500 }
    )
  }

  // Mark invite as accepted
  const { error: updateError } = await serviceClient
    .from('team_invites')
    .update({ status: 'accepted' })
    .eq('id', invite.id)

  if (updateError) {
    console.error('[invite/accept] Failed to mark invite accepted (non-fatal):', updateError?.message)
  }

  // Return success with user info — client calls supabase.auth.signInWithPassword()
  // with the email and password the user just entered, then redirects to /dashboard
  return NextResponse.json({
    success: true,
    user: {
      id: authData.user.id,
      email: invite.email,
      role: invite.role,
      full_name: full_name.trim(),
    },
  })
}