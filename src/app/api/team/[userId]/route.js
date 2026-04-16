import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * DELETE /api/team/[userId]
 *
 * Admin only. Removes a user from the account.
 * Prevents removal of the last admin on the account.
 */
export async function DELETE(req, { params }) {
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

  const serviceClient = createServiceClient()

  // Verify target user exists in same account
  const { data: targetUser, error: targetError } = await serviceClient
    .from('users')
    .select('id, role, account_id, email')
    .eq('id', userId)
    .eq('account_id', authContext.accountId)
    .single()

  if (targetError || !targetUser) {
    return NextResponse.json({ error: 'User not found in your account' }, { status: 404 })
  }

  // Last-admin guard
  if (targetUser.role === 'admin') {
    const { count: adminCount } = await serviceClient
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', authContext.accountId)
      .eq('role', 'admin')

    if ((adminCount || 0) <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove — this is the last admin on the account' },
        { status: 422 }
      )
    }
  }

  // Delete from users table
  const { error: deleteError } = await serviceClient
    .from('users')
    .delete()
    .eq('id', userId)
    .eq('account_id', authContext.accountId)

  if (deleteError) {
    console.error('[team/delete] Delete failed:', deleteError?.message)
    return NextResponse.json({ error: 'Failed to remove user' }, { status: 500 })
  }

  // Optionally delete Supabase Auth user (soft delete leaves auth entry)
  // Per spec: remove from account — auth cleanup is administrative
  // For now we delete the auth user too
  try {
    await serviceClient.auth.admin.deleteUser(userId)
  } catch (authDeleteErr) {
    console.warn('[team/delete] Auth user deletion failed (non-fatal):', authDeleteErr?.message)
  }

  return NextResponse.json({ success: true, removed_user_id: userId })
}