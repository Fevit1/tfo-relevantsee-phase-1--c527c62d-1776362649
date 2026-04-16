import { getAuthenticatedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch {
    redirect('/login')
  }

  const supabase = await createClient()

  // Fetch campaigns
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name, brief, channels, status, brand_score, created_by, created_at, updated_at, campaign_version')
    .order('created_at', { ascending: false })
    .limit(50)

  // Fetch stats
  let stats = { total_campaigns: 0, pending_count: 0, approved_this_month: 0 }
  try {
    const statsRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/dashboard/stats`,
      {
        headers: {
          // Pass through cookies for auth
          cookie: (await import('next/headers')).cookies().toString(),
        },
        cache: 'no-store',
      }
    )
    if (statsRes.ok) {
      stats = await statsRes.json()
    }
  } catch {
    // Stats are non-critical
  }

  return (
    <DashboardClient
      initialCampaigns={campaigns || []}
      initialStats={stats}
      userRole={authContext.role}
    />
  )
}