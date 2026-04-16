'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { BrandScoreBadge } from '@/components/ui/BrandScoreBadge'
import { ChannelChips } from '@/components/ui/ChannelChips'
import { Modal } from '@/components/ui/Modal'
import { EmailContentPanel } from '@/components/campaigns/EmailContentPanel'
import { SocialContentPanel } from '@/components/campaigns/SocialContentPanel'
import { AdsContentPanel } from '@/components/campaigns/AdsContentPanel'
import { BrandScoreWidget } from '@/components/campaigns/BrandScoreWidget'
import { useAuth } from '@/components/AuthProvider'
import {
  getCampaign,
  approveCampaign,
  rejectCampaign,
  reopenCampaign,
  scoreCampaign,
  submitCampaign,
  formatMockMetrics,
} from '@/lib/api'

export function CampaignDetailPage({ id }) {
  const router = useRouter()
  const { isAdmin, role } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('email')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

  // Modals
  const [approveModalOpen, setApproveModalOpen] = useState(false)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [overrideModalOpen, setOverrideModalOpen] = useState(false)
  const [approveNotes, setApproveNotes] = useState('')
  const [rejectNotes, setRejectNotes] = useState('')
  const [overrideNotes, setOverrideNotes] = useState('')

  // Score state
  const [brandScore, setBrandScore] = useState(null)
  const [scoringData, setScoringData] = useState(null)
  const [scoreLoading, setScoreLoading] = useState(false)

  const loadCampaign = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getCampaign(id)
      setData(result)
      setBrandScore(result.campaign?.brand_score ?? null)
      const lastScore = result.score_log?.[0]
      if (lastScore) {
        setScoringData({
          brand_score: lastScore.final_score,
          phase1: { passed: lastScore.phase1_passed, banned_phrase_hits: lastScore.phase1_banned_phrase_hits },
          phase2: { score: lastScore.phase2_claude_score },
        })
      }
      // Set active tab to first available channel
      const channels = result.campaign?.channels || []
      if (channels.length > 0) setActiveTab(channels[0])
    } catch (err) {
      setError(err.message || 'Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadCampaign() }, [loadCampaign])

  const handleApprove = async (override = false) => {
    setActionLoading(true)
    setActionError(null)
    try {
      const notes = override ? overrideNotes : approveNotes
      await approveCampaign(id, { notes, override_flag: override })
      setApproveModalOpen(false)
      setOverrideModalOpen(false)
      setApproveNotes('')
      setOverrideNotes('')
      await loadCampaign()
    } catch (err) {
      setActionError(err.message || 'Failed to approve campaign')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectNotes.trim()) {
      setActionError('Rejection notes are required')
      return
    }
    setActionLoading(true)
    setActionError(null)
    try {
      await rejectCampaign(id, { notes: rejectNotes })
      setRejectModalOpen(false)
      setRejectNotes('')
      await loadCampaign()
    } catch (err) {
      setActionError(err.message || 'Failed to reject campaign')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReopen = async () => {
    setActionLoading(true)
    setActionError(null)
    try {
      await reopenCampaign(id)
      await loadCampaign()
    } catch (err) {
      setActionError(err.message || 'Failed to reopen campaign')
    } finally {
      setActionLoading(false)
    }
  }

  const handleScore = async () => {
    setScoreLoading(true)
    setActionError(null)
    try {
      const result = await scoreCampaign({ campaign_id: id })
      setBrandScore(result.brand_score)
      setScoringData(result)
      await loadCampaign()
    } catch (err) {
      setActionError(err.message || 'Scoring failed')
    } finally {
      setScoreLoading(false)
    }
  }

  const handleSubmit = async () => {
    setActionLoading(true)
    setActionError(null)
    try {
      await submitCampaign(id)
      await loadCampaign()
    } catch (err) {
      setActionError(err.message || 'Submission failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
            <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
            <div className="h-6 w-32 bg-gray-800 rounded animate-pulse" />
            <div className="h-96 bg-gray-900 border border-gray-800 rounded-xl animate-pulse" />
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  if (error || !data) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="p-6 lg:p-8 max-w-5xl mx-auto">
            <div className="bg-gray-900 border border-red-900/50 rounded-xl p-8 text-center">
              <p className="text-red-400">{error || 'Campaign not found'}</p>
              <Link href="/dashboard" className="mt-3 inline-block text-sm text-indigo-400 hover:text-indigo-300">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  const { campaign, status_log, approval_log, score_log, mock_metrics } = data
  const channels = campaign.channels || []
  const gc = campaign.generated_content || {}
  const hasContent = Object.keys(gc).some(k => k !== '_schema_version')
  const mockMetricsFormatted = formatMockMetrics(mock_metrics)
  const canSubmit = (brandScore ?? campaign.brand_score) >= 85
  const isDraft = campaign.status === 'draft'
  const isPending = campaign.status === 'pending'
  const isRejected = campaign.status === 'rejected'
  const isApproved = campaign.status === 'approved'

  return (
    <ProtectedRoute>
      <Layout>
        <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link href="/dashboard" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
                  Campaigns
                </Link>
                <span className="text-gray-600">/</span>
              </div>
              <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <StatusBadge status={campaign.status} />
                <BrandScoreBadge score={brandScore ?? campaign.brand_score} />
                <ChannelChips channels={channels} />
                <span className="text-xs text-gray-500">v{campaign.campaign_version}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Created {formatDate(campaign.created_at)}</p>
            </div>
          </div>

          {actionError && (
            <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3">
              <p className="text-sm text-red-400">{actionError}</p>
            </div>
          )}

          {/* Status-aware action panel */}
          <ActionPanel
            campaign={campaign}
            isAdmin={isAdmin}
            role={role}
            canSubmit={canSubmit}
            brandScore={brandScore ?? campaign.brand_score}
            actionLoading={actionLoading}
            onApprove={() => setApproveModalOpen(true)}
            onReject={() => setRejectModalOpen(true)}
            onOverride={() => setOverrideModalOpen(true)}
            onReopen={handleReopen}
            onSubmit={handleSubmit}
            onScore={handleScore}
            scoreLoading={scoreLoading}
          />

          {/* Rejection notes banner */}
          {isRejected && campaign.approval_notes && (
            <div className="rounded-xl border border-red-800 bg-red-950/30 p-4">
              <p className="text-sm font-semibold text-red-300 mb-1">Rejection Notes</p>
              <p className="text-sm text-red-200">{campaign.approval_notes}</p>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Main content area */}
            <div className="xl:col-span-2 space-y-6">
              {/* Brief */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-gray-300 mb-2">Campaign Brief</h2>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{campaign.brief}</p>
              </div>

              {/* Generated content panels */}
              {hasContent && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                  <div className="border-b border-gray-800 px-5 py-3">
                    <div className="flex gap-1">
                      {channels.filter(ch => gc[ch]).map(ch => (
                        <button
                          key={ch}
                          onClick={() => setActiveTab(ch)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                            activeTab === ch ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-5">
                    {activeTab === 'email' && <EmailContentPanel content={gc.email} />}
                    {activeTab === 'social' && <SocialContentPanel content={gc.social} />}
                    {activeTab === 'ads' && <AdsContentPanel content={gc.ads} />}
                  </div>
                </div>
              )}

              {/* Brand score widget */}
              {isDraft && (
                <BrandScoreWidget
                  score={brandScore ?? campaign.brand_score}
                  scoringData={scoringData}
                  loading={scoreLoading}
                  onScore={handleScore}
                />
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Mock metrics */}
              {mock_metrics && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-300">Performance</h3>
                    <span className="text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded border border-gray-700">Demo data</span>
                  </div>
                  <div className="space-y-3">
                    {mockMetricsFormatted.map(m => (
                      <div key={m.label} className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">{m.label}</span>
                        <span className="text-sm font-semibold text-white tabular-nums">{m.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Score history */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Score History</h3>
                {score_log?.length > 0 ? (
                  <div className="space-y-2">
                    {score_log.map(entry => (
                      <div key={entry.id} className="border border-gray-800 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white">{entry.final_score}/100</span>
                          <span className="text-xs text-gray-500">v{entry.campaign_version}</span>
                        </div>
                        <div className="mt-1.5 text-xs text-gray-500">
                          <span className={entry.phase1_passed ? 'text-emerald-400' : 'text-red-400'}>
                            P1 {entry.phase1_passed ? '✓' : '✗'}
                          </span>
                          {entry.phase2_claude_score !== null && (
                            <span className="ml-2">P2: {entry.phase2_claude_score}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{formatDate(entry.created_at)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No scoring runs yet</p>
                )}
              </div>

              {/* Status timeline */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Status Timeline</h3>
                {status_log?.length > 0 ? (
                  <div className="space-y-3">
                    {status_log.map((entry, i) => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${i === 0 ? 'bg-gray-500' : 'bg-indigo-500'}`} />
                          {i < status_log.length - 1 && <div className="w-px flex-1 bg-gray-800 mt-1" />}
                        </div>
                        <div className="pb-3 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {entry.from_status && (
                              <>
                                <span className="text-xs text-gray-500 capitalize">{entry.from_status}</span>
                                <span className="text-gray-600">→</span>
                              </>
                            )}
                            <span className="text-xs text-white font-medium capitalize">{entry.to_status}</span>
                          </div>
                          {entry.notes && <p className="text-xs text-gray-500 mt-0.5">{entry.notes}</p>}
                          <p className="text-xs text-gray-600 mt-0.5">{formatDate(entry.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No transitions logged</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Approve modal */}
        <Modal open={approveModalOpen} onClose={() => setApproveModalOpen(false)} title="Approve Campaign">
          <div className="space-y-4">
            <p className="text-sm text-gray-300">Approving <strong className="text-white">{campaign.name}</strong>.</p>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">Notes (optional)</label>
              <textarea
                value={approveNotes}
                onChange={e => setApproveNotes(e.target.value)}
                rows={3}
                placeholder="Add any notes for the campaign creator..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setApproveModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors">Cancel</button>
              <button
                onClick={() => handleApprove(false)}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 rounded-lg transition-colors"
              >
                {actionLoading ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Override modal */}
        <Modal open={overrideModalOpen} onClose={() => setOverrideModalOpen(false)} title="Approve with Override">
          <div className="space-y-4">
            <div className="rounded-lg bg-amber-950/30 border border-amber-800 p-3">
              <p className="text-sm text-amber-300">
                This campaign's brand score ({campaign.brand_score ?? '—'}) is below the 85 threshold.
                Overriding requires a documented reason.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">Override Reason <span className="text-red-400">*</span></label>
              <textarea
                value={overrideNotes}
                onChange={e => setOverrideNotes(e.target.value)}
                rows={3}
                placeholder="Explain why this campaign should be approved despite the low brand score..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setOverrideModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors">Cancel</button>
              <button
                onClick={() => handleApprove(true)}
                disabled={actionLoading || !overrideNotes.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-700 hover:bg-amber-600 disabled:opacity-50 rounded-lg transition-colors"
              >
                {actionLoading ? 'Approving…' : 'Approve with Override'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Reject modal */}
        <Modal open={rejectModalOpen} onClose={() => setRejectModalOpen(false)} title="Reject Campaign">
          <div className="space-y-4">
            <p className="text-sm text-gray-300">Rejecting <strong className="text-white">{campaign.name}</strong>. The creator will be notified with your notes.</p>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">Rejection Notes <span className="text-red-400">*</span></label>
              <textarea
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                rows={4}
                placeholder="Explain what needs to be changed before this campaign can be approved..."
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
              {!rejectNotes.trim() && (
                <p className="text-xs text-gray-500">Notes are required for rejection</p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRejectModalOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg transition-colors">Cancel</button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectNotes.trim()}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors"
              >
                {actionLoading ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </Modal>
      </Layout>
    </ProtectedRoute>
  )
}

function ActionPanel({ campaign, isAdmin, role, canSubmit, brandScore, actionLoading, onApprove, onReject, onOverride, onReopen, onSubmit, onScore, scoreLoading }) {
  const { status } = campaign
  const hasContent = Object.keys(campaign.generated_content || {}).some(k => k !== '_schema_version')

  if (status === 'draft') {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
          </svg>
          Draft
        </div>
        {(role === 'admin' || role === 'editor') && hasContent && (
          <>
            <button
              onClick={onScore}
              disabled={scoreLoading}
              className="px-3 py-1.5 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {scoreLoading ? 'Scoring…' : 'Score Content'}
            </button>
            <button
              onClick={onSubmit}
              disabled={actionLoading || !canSubmit}
              title={!canSubmit ? `Brand score must be ≥ 85 (current: ${brandScore ?? '—'})` : ''}
              className="px-3 py-1.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {actionLoading ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </>
        )}
        {!hasContent && (
          <span className="text-xs text-gray-500">Generate content before submitting</span>
        )}
      </div>
    )
  }

  if (status === 'pending' && isAdmin) {
    return (
      <div className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-amber-300 flex-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Awaiting your review
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={onApprove} className="px-3 py-1.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg transition-colors">
            Approve
          </button>
          {(campaign.brand_score === null || campaign.brand_score < 85) && (
            <button onClick={onOverride} className="px-3 py-1.5 text-sm font-semibold text-amber-100 bg-amber-800/60 hover:bg-amber-700/60 border border-amber-700 rounded-lg transition-colors">
              Approve with Override
            </button>
          )}
          <button onClick={onReject} className="px-3 py-1.5 text-sm font-semibold text-red-200 bg-red-900/40 hover:bg-red-900/60 border border-red-800 rounded-lg transition-colors">
            Reject
          </button>
        </div>
      </div>
    )
  }

  if (status === 'pending' && !isAdmin) {
    return (
      <div className="bg-amber-950/20 border border-amber-800/50 rounded-xl p-4 flex items-center gap-2 text-sm text-amber-300">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        This campaign is pending admin review
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <div className="bg-emerald-950/20 border border-emerald-800/50 rounded-xl p-4 flex items-center gap-2 text-sm text-emerald-300">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        Approved {campaign.approved_at ? `on ${formatDate(campaign.approved_at)}` : ''}
      </div>
    )
  }

  if (status === 'rejected' && (role === 'admin' || role === 'editor')) {
    return (
      <div className="bg-red-950/20 border border-red-800/50 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-red-300">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Campaign was rejected
        </div>
        <button
          onClick={onReopen}
          disabled={actionLoading}
          className="px-3 py-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition-colors"
        >
          {actionLoading ? 'Reopening…' : 'Reopen for Revision'}
        </button>
      </div>
    )
  }

  return null
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}