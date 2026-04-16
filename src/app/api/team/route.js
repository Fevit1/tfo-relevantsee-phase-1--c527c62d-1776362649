import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/team
 *
 * Admin only. Returns current team members, pending invites, and member count.
 * Used by the Settings > Team page.
 */
export async function GET(req) {
  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  if (authContext.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  const supabase = await createClient()

  // Fetch members
  const { data: members, error: membersError } = await supabase
    .from('users')
    .select('id, email, role, full_name, created_at')
    .eq('account_id', authContext.accountId)
    .order('created_at', { ascending: true })

  if (membersError) {
    console.error('[team/GET] Members query failed:', membersError?.message)
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 })
  }

  // Fetch pending invites
  const { data: pending_invites, error: invitesError } = await supabase
    .from('team_invites')
    .select('id, email, role, created_at, expires_at')
    .eq('account_id', authContext.accountId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (invitesError) {
    console.error('[team/GET] Invites query failed:', invitesError?.message)
  }

  const member_count = members?.length || 0

  return NextResponse.json({
    members: members || [],
    pending_invites: pending_invites || [],
    member_count,
  })
}