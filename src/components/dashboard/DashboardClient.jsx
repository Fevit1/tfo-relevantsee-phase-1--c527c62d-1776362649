'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import Spinner from '@/components/ui/Spinner'

const STATUS_CONFIG = {
  draft: {
    label: 'Draft',
    dot: 'bg-gray-500',
    badge: 'bg-gray-800 text-gray-300 border-gray-700',
  },
  pending: {
    label: 'Pending',
    dot: 'bg-amber-400 badge-pending-pulse',
    badge: 'bg-amber-900/40 text-amber-300 border-amber-700/60',
  },
  approved: {
    label: 'Approved',
    dot: 'bg-green-500',
    badge: 'bg-green-900/40 text-green-300 border-green-700/60',
  },
  rejected: {
    label: 'Rejected',
    dot: 'bg-red-500',
    badge: 'bg-red-900/40 text-red-300 border-red-700/60',
  },
}

const SCORE_COLOR = (score) => {
  if (score === null || score === undefined) return 'text-gray-500'
  if (score >= 85) return 'text-green-400'
  if (score >= 70) return 'text-amber-400'
  return 'text-red-400'
}

const SCORE_BG = (score) => {
  if (score === null || score === undefined) return ''
  if (score >= 85) return 'bg-green-900/20'
  if (score >= 70) return 'bg-amber-900/20'
  return 'bg-red-900/20'
}

const STATUS_FILTERS = ['all', 'draft', 'pending', 'approved', 'rejected']

function StatCard({ label, value, icon, accent = false, isLoading = false }) {
  return (
    <div className={[
      'relative bg-gray-900 rounded-xl border p-5',
      'transition-all duration-200 hover:shadow-card-hover group',
      accent ? 'border-indigo-700/50 hover:border-indigo-600' : 'border-gray-800 hover:border-gray-700',
    ].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
          {isLoading ? (
            <div className="h-8 w-16 skeleton rounded" />
          ) : (
            <p className={`text-3xl font-bold tracking-tight ${accent ? 'text-indigo-300' : 'text-white'}`}>
              {value ?? '—'}
            </p>
          )}
        </div>
        {icon && (
          <div className={[
            'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
            'transition-transform duration-200 group-hover:scale-110',
            accent ? 'bg-indigo-900/40 text-indigo-400' : 'bg-gray-800 text-gray-400',
          ].join(' ')}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

function CampaignCard({ campaign }) {
  const status = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft
  const hasScore = campaign.brand_score !== null && campaign.brand_score !== undefined

  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className={[
        'group block bg-gray-900 rounded-xl border border-gray-800 p-5',
        'transition-all duration-200 hover:border-gray-700 hover:shadow-card-hover hover:-translate-y-px',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950',
        'animate-fade-in-up',
      ].join(' ')}
      aria-label={`Campaign: ${campaign.name || 'Untitled'}, status: ${status.label}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-100 truncate group-hover:text-white transition-colors duration-150">
            {campaign.name || 'Untitled Campaign'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {campaign.created_at
              ? new Date(campaign.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Unknown date'}
          </p>
        </div>

        {/* Status badge */}
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border flex-shrink-0 ${status.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} aria-hidden="true" />
          {status.label}
        </span>
      </div>

      {/* Brief preview */}
      {campaign.brief && (
        <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">
          {campaign.brief}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Channels */}
        <div className="flex gap-1 flex-wrap">
          {(campaign.channels || []).length > 0
            ? campaign.channels.slice(0, 3).map(ch => (
              <span
                key={ch}
                className="px-1.5 py-0.5 bg-gray-800 text-gray-400 text-xs rounded capitalize border border-gray-700/50"
              >
                {ch}
              </span>
            ))
            : <span className="text-xs text-gray-600">No channels</span>
          }
        </div>

        {/* Score */}
        {hasScore ? (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${SCORE_COLOR(campaign.brand_score)} ${SCORE_BG(campaign.brand_score)}`}>
            {campaign.brand_score}/100
          </span>
        ) : null}
      </div>
    </Link>
  )
}

export default function DashboardClient({ initialCampaigns = [], initialStats = {}, userRole = 'viewer' }) {
  const [campaigns] = useState(initialCampaigns)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const stats = {
    total: initialStats.total_campaigns ?? campaigns.length,
    pending: initialStats.pending_count ?? campaigns.filter(c => c.status === 'pending').length,
    approved: initialStats.approved_this_month ?? campaigns.filter(c => c.status === 'approved').length,
  }

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(c => {
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter
      const matchesSearch = !searchQuery.trim() ||
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.brief?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [campaigns, statusFilter, searchQuery])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 sm:mb-8 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">
            {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''} total
          </p>
        </div>

        {['admin', 'editor'].includes(userRole) && (
          <Link
            href="/campaigns/new"
            className={[
              'inline-flex items-center gap-2 px-4 py-2.5',
              'bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg',
              'transition-all duration-150 btn-press shadow-glow-indigo/30',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950',
            ].join(' ')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Campaign
          </Link>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8 stagger-children">
        <StatCard
          label="Total Campaigns"
          value={stats.total}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
        <StatCard
          label="Pending Review"
          value={stats.pending}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Approved This Month"
          value={stats.approved}
          accent
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={[
              'w-full pl-9 pr-3 py-2',
              'bg-gray-900 border border-gray-700 rounded-lg',
              'text-sm text-gray-200 placeholder-gray-500',
              'transition-all duration-150',
              'hover:border-gray-600',
              'focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
            ].join(' ')}
            aria-label="Search campaigns"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map(filter => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              aria-pressed={statusFilter === filter}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium capitalize',
                'transition-all duration-150 border',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                statusFilter === filter
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600',
              ].join(' ')}
            >
              {filter === 'all' ? 'All' : (STATUS_CONFIG[filter]?.label || filter)}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign List */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 border-dashed p-10 sm:p-14 text-center animate-fade-in">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            {searchQuery || statusFilter !== 'all' ? (
              <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            )}
          </div>

          {searchQuery || statusFilter !== 'all' ? (
            <>
              <p className="text-gray-300 font-medium mb-1">No matching campaigns</p>
              <p className="text-gray-500 text-sm mb-4">
                Try adjusting your search or filter.
              </p>
              <button
                onClick={() => { setSearchQuery(''); setStatusFilter('all') }}
                className="text-indigo-400 hover:text-indigo-300 text-sm font-medium transition-colors duration-150"
              >
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-300 font-medium mb-1">No campaigns yet</p>
              <p className="text-gray-500 text-sm mb-5">
                Create your first AI-powered marketing campaign.
              </p>
              {['admin', 'editor'].includes(userRole) && (
                <Link
                  href="/campaigns/new"
                  className={[
                    'inline-flex items-center gap-2 px-5 py-2.5',
                    'bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg',
                    'transition-all duration-150 btn-press',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  ].join(' ')}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Create First Campaign
                </Link>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 stagger-children">
          {filteredCampaigns.map(campaign => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}

      {/* Count indicator */}
      {filteredCampaigns.length > 0 && (searchQuery || statusFilter !== 'all') && (
        <p className="mt-4 text-xs text-gray-600 text-center">
          Showing {filteredCampaigns.length} of {campaigns.length} campaigns
        </p>
      )}
    </div>
  )
}