import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/approvals
 *
 * Admin only. Returns all pending campaigns for the account.
 * Powers the Approval Queue page.
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

  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, brief, channels, status, brand_score, created_by, created_at, updated_at, campaign_version')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[approvals/GET] Query failed:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch approval queue' }, { status: 500 })
  }

  return NextResponse.json({
    campaigns: campaigns || [],
    count: campaigns?.length || 0,
  })
}