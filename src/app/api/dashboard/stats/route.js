import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/dashboard/stats
 *
 * All roles. Returns aggregated campaign statistics for the account.
 * Returns: { total_campaigns, pending_count, approved_this_month }
 */
export async function GET(req) {
  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  const supabase = await createClient()

  // Total campaigns
  const { count: total_campaigns } = await supabase
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', authContext.accountId)

  // Pending count
  const { count: pending_count } = await supabase
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', authContext.accountId)
    .eq('status', 'pending')

  // Approved this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count: approved_this_month } = await supabase
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', authContext.accountId)
    .eq('status', 'approved')
    .gte('approved_at', startOfMonth.toISOString())

  return NextResponse.json({
    total_campaigns: total_campaigns || 0,
    pending_count: pending_count || 0,
    approved_this_month: approved_this_month || 0,
  })
}