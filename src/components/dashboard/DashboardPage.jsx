'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { BrandScoreBadge } from '@/components/ui/BrandScoreBadge'
import { ChannelChips } from '@/components/ui/ChannelChips'
import { listCampaigns, formatMockMetrics } from '@/lib/api'
import { useAuth } from '@/components/AuthProvider'

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Pending', value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
]

export function DashboardPage() {
  const router = useRouter()
  const { isAdmin } = useAuth()
  const [campaigns, setCampaigns] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('')
  const [quickStats, setQuickStats] = useState({ total: 0, pending: 0, approvedThisMonth: 0 })

  const fetchCampaigns = useCallback(async (status = '') => {
    setLoading(true)
    setError(null)
    try {
      const [allData, pendingData, approvedData] = await Promise.all([
        listCampaigns({ status, page_size: 20 }),
        listCampaigns({ status: 'pending', page_size: 1 }),
        listCampaigns({ status: 'approved', page_size: 100 }),
      ])
      setCampaigns(allData.campaigns || [])
      setPagination(allData.pagination || null)

      // Compute quick stats
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const approvedThisMonth = (approvedData.campaigns || []).filter(c =>
        new Date(c.approved_at || c.updated_at) >= startOfMonth
      ).length

      setQuickStats({
        total: status === '' ? (allData.pagination?.total || 0) : quickStats.total,
        pending: pendingData.pagination?.total || 0,
        approvedThisMonth,
      })
    } catch (err) {
      setError(err.message || 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCampaigns(activeTab)
  }, [activeTab, fetchCampaigns])

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6 lg:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Campaigns</h1>
              <p className="text-sm text-gray-400 mt-0.5">Manage and track your marketing campaigns</p>
            </div>
            <Link
              href="/campaigns/new"
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Campaign
            </Link>
          </div>

          {/* Quick stats */}
          <QuickStatsBar stats={quickStats} loading={loading} />

          {/* Status filter tabs */}
          <div className="flex gap-1 p-1 bg-gray-900 rounded-lg border border-gray-800 w-fit">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.value
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Campaign table */}
          {loading ? (
            <CampaignTableSkeleton />
          ) : error ? (
            <ErrorState message={error} onRetry={() => fetchCampaigns(activeTab)} />
          ) : campaigns.length === 0 ? (
            <EmptyState activeTab={activeTab} />
          ) : (
            <CampaignTable campaigns={campaigns} />
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}

function QuickStatsBar({ stats, loading }) {
  const items = [
    { label: 'Total Campaigns', value: stats.total, color: 'text-white' },
    { label: 'Pending Approval', value: stats.pending, color: 'text-amber-400' },
    { label: 'Approved This Month', value: stats.approvedThisMonth, color: 'text-emerald-400' },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {items.map(item => (
        <div key={item.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400">{item.label}</p>
          {loading ? (
            <div className="h-8 w-16 bg-gray-800 rounded animate-pulse mt-1" />
          ) : (
            <p className={`text-2xl font-bold mt-1 ${item.color}`}>{item.value}</p>
          )}
        </div>
      ))}
    </div>
  )
}

function CampaignTable({ campaigns }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Campaign</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Brand Score</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Channels</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide hidden xl:table-cell">Demo Metrics</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {campaigns.map(campaign => (
              <CampaignRow key={campaign.id} campaign={campaign} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CampaignRow({ campaign }) {
  const router = useRouter()
  const metrics = getMockMetrics(campaign.id)

  return (
    <tr
      className="hover:bg-gray-800/50 cursor-pointer transition-colors group"
      onClick={() => router.push(`/campaigns/${campaign.id}`)}
    >
      <td className="px-4 py-4">
        <div>
          <p className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">{campaign.name}</p>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{campaign.brief}</p>
        </div>
      </td>
      <td className="px-4 py-4">
        <StatusBadge status={campaign.status} />
      </td>
      <td className="px-4 py-4">
        <BrandScoreBadge score={campaign.brand_score} />
      </td>
      <td className="px-4 py-4">
        <ChannelChips channels={campaign.channels || []} />
      </td>
      <td className="px-4 py-4 hidden xl:table-cell">
        <div className="flex items-center gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{metrics.impressions.toLocaleString()} imp</span>
              <span>{metrics.clicks.toLocaleString()} clicks</span>
              <span>{metrics.ctr} CTR</span>
            </div>
          </div>
          <span className="text-xs bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded border border-gray-700">Demo</span>
        </div>
      </td>
      <td className="px-4 py-4">
        <p className="text-xs text-gray-400">{formatDate(campaign.created_at)}</p>
      </td>
    </tr>
  )
}

function getMockMetrics(campaignId) {
  const chars = (campaignId || '').replace(/-/g, '')
  let hash = 0
  for (let i = 0; i < chars.length; i++) {
    hash = ((hash << 5) - hash + parseInt(chars[i], 16)) | 0
  }
  const abs = Math.abs(hash)
  const impressions = 15000 + (abs % 85000)
  const clicks = 300 + (abs % 4700)
  const conversions = 5 + (abs % 195)
  const ctr = ((clicks / impressions) * 100).toFixed(2) + '%'
  return { impressions, clicks, ctr, conversions }
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CampaignTableSkeleton() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <div className="h-4 bg-gray-800 rounded w-32 animate-pulse" />
      </div>
      {[1,2,3,4,5].map(i => (
        <div key={i} className="px-4 py-4 border-b border-gray-800 flex items-center gap-4 animate-pulse">
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-800 rounded w-48" />
            <div className="h-3 bg-gray-800 rounded w-72" />
          </div>
          <div className="h-6 bg-gray-800 rounded-full w-16" />
          <div className="h-6 bg-gray-800 rounded w-12" />
          <div className="h-6 bg-gray-800 rounded w-24" />
          <div className="h-4 bg-gray-800 rounded w-20 hidden xl:block" />
          <div className="h-4 bg-gray-800 rounded w-24" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ activeTab }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl flex flex-col items-center justify-center py-16 px-8 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      </div>
      <p className="text-white font-semibold">
        {activeTab ? `No ${activeTab} campaigns` : 'No campaigns yet'}
      </p>
      <p className="text-sm text-gray-400 mt-1 max-w-sm">
        {activeTab ? `There are no campaigns with ${activeTab} status.` : 'Create your first campaign to get started.'}
      </p>
      {!activeTab && (
        <Link
          href="/campaigns/new"
          className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Create Campaign
        </Link>
      )}
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="bg-gray-900 border border-red-900/50 rounded-xl p-8 text-center">
      <p className="text-red-400 font-medium">{message}</p>
      <button onClick={onRetry} className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
        Try again
      </button>
    </div>
  )
}