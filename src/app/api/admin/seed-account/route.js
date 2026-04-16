import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * POST /api/admin/seed-account
 *
 * Internal-only endpoint for provisioning new accounts and their first admin user.
 * Guarded by PLATFORM_ADMIN_SECRET header using constant-time comparison.
 * Returns 404 for any invalid or missing secret (avoids confirming endpoint existence).
 *
 * Body: { account_name: string, admin_email: string, admin_password?: string }
 */
export async function POST(req) {
  // Constant-time secret comparison — prevents timing attacks
  const providedSecret = req.headers.get('x-platform-admin-secret') || ''
  const expectedSecret = process.env.PLATFORM_ADMIN_SECRET || ''

  if (!expectedSecret || expectedSecret.length < 32) {
    // Misconfigured — return 404 to not reveal endpoint existence
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let secretsMatch = false
  try {
    const providedBuf = Buffer.from(providedSecret.padEnd(expectedSecret.length, '\0'))
    const expectedBuf = Buffer.from(expectedSecret)
    // Both buffers must be same length for timingSafeEqual
    if (providedBuf.length === expectedBuf.length) {
      secretsMatch = crypto.timingSafeEqual(providedBuf, expectedBuf)
    }
  } catch {
    secretsMatch = false
  }

  if (!secretsMatch) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { account_name, admin_email, admin_password } = body

  if (!account_name || typeof account_name !== 'string' || !account_name.trim()) {
    return NextResponse.json({ error: 'account_name is required' }, { status: 400 })
  }
  if (!admin_email || typeof admin_email !== 'string' || !admin_email.includes('@')) {
    return NextResponse.json({ error: 'admin_email is required and must be a valid email' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // 1. Create the account row
  const { data: account, error: accountError } = await serviceClient
    .from('accounts')
    .insert({
      name: account_name.trim(),
      plan: 'phase1',
    })
    .select('id, name')
    .single()

  if (accountError || !account) {
    console.error('[seed-account] Account insert failed:', accountError?.message)
    return NextResponse.json(
      { error: 'Failed to create account', details: accountError?.message },
      { status: 500 }
    )
  }

  // 2. Create Supabase Auth user
  const password = admin_password || crypto.randomBytes(16).toString('hex')
  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email: admin_email.trim().toLowerCase(),
    password,
    email_confirm: true, // Invite-only — skip email confirmation
  })

  if (authError || !authData?.user) {
    // Rollback: delete account if auth user creation failed
    await serviceClient.from('accounts').delete().eq('id', account.id)
    console.error('[seed-account] Auth user creation failed:', authError?.message)
    return NextResponse.json(
      { error: 'Failed to create auth user', details: authError?.message },
      { status: 500 }
    )
  }

  // 3. Insert into users table with admin role
  const { data: dbUser, error: userError } = await serviceClient
    .from('users')
    .insert({
      id: authData.user.id,
      account_id: account.id,
      email: admin_email.trim().toLowerCase(),
      role: 'admin',
      full_name: null,
    })
    .select('id, email, role, account_id')
    .single()

  if (userError || !dbUser) {
    // Rollback: delete auth user and account
    await serviceClient.auth.admin.deleteUser(authData.user.id)
    await serviceClient.from('accounts').delete().eq('id', account.id)
    console.error('[seed-account] Users table insert failed:', userError?.message)
    return NextResponse.json(
      { error: 'Failed to create user record', details: userError?.message },
      { status: 500 }
    )
  }

  const response = {
    success: true,
    account: { id: account.id, name: account.name },
    admin_user: { id: dbUser.id, email: dbUser.email, role: dbUser.role },
  }

  // Only return generated password if none was provided (temp password scenario)
  if (!admin_password) {
    response.temporary_password = password
    response.note = 'Temporary password generated. User should reset on first login.'
  }

  return NextResponse.json(response, { status: 201 })
}