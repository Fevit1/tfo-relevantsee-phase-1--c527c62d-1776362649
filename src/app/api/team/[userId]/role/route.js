import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * PATCH /api/team/[userId]/role
 *
 * Admin only. Updates a team member's role.
 * Prevents self-demotion if the user is the last admin on the account.
 *
 * Body: { role: 'admin' | 'editor' | 'viewer' }
 */
export async function PATCH(req, { params }) {
  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  if (authContext.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const { userId } = params

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { role } = body

  if (!role || !['admin', 'editor', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'role must be admin, editor, or viewer' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  // Verify target user exists in same account
  const { data: targetUser, error: targetError } = await serviceClient
    .from('users')
    .select('id, role, account_id')
    .eq('id', userId)
    .eq('account_id', authContext.accountId)
    .single()

  if (targetError || !targetUser) {
    return NextResponse.json({ error: 'User not found in your account' }, { status: 404 })
  }

  // Self-demotion guard: if demoting self and they are the last admin
  if (userId === authContext.userId && role !== 'admin') {
    const { count: adminCount } = await serviceClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', authContext.accountId)
      .eq('role', 'admin')

    if ((adminCount || 0) <= 1) {
      return NextResponse.json(
        { error: 'Cannot demote — you are the last admin on this account' },
        { status: 422 }
      )
    }
  }

  // Update role
  const { data: updatedUser, error: updateError } = await serviceClient
    .from('users')
    .update({ role })
    .eq('id', userId)
    .eq('account_id', authContext.accountId)
    .select('id, email, role, full_name')
    .single()

  if (updateError || !updatedUser) {
    console.error('[team/role] Update failed:', updateError?.message)
    return NextResponse.json({ error: 'Failed to update role' }, { status: 500 })
  }

  return NextResponse.json({ user: updatedUser })
}