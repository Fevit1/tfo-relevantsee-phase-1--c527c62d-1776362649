'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import EmailPreviewFrame from '@/components/campaigns/EmailPreviewFrame'
import AdCopyPanel from '@/components/campaigns/AdCopyPanel'
import BrandScoreWidget from '@/components/campaigns/BrandScoreWidget'
import StatusTimeline from '@/components/campaigns/StatusTimeline'
import ScoreHistoryAccordion from '@/components/campaigns/ScoreHistoryAccordion'
import MockMetricsPanel from '@/components/campaigns/MockMetricsPanel'
import ApproveModal from '@/components/approvals/ApproveModal'
import RejectModal from '@/components/approvals/RejectModal'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useToast } from '@/components/ui/Toast'
import Spinner from '@/components/ui/Spinner'

const STATUS_STYLES = {
  draft: 'bg-gray-700 text-gray-300',
  pending: 'bg-amber-900/60 text-amber-300',
  approved: 'bg-green-900/60 text-green-300',
  rejected: 'bg-red-900/60 text-red-300',
}

const SCORE_COLOR = (score) => {
  if (score === null || score === undefined) return 'text-gray-400'
  if (score >= 85) return 'text-green-400'
  if (score >= 70) return 'text-amber-400'
  return 'text-red-400'
}

function CampaignDetailContent() {
  const params = useParams()
  const router = useRouter()
  const toast = useToast()
  const campaignId = params?.id

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retrying, setRetrying] = useState(false)
  const [userRole, setUserRole] = useState(null)

  const [showApproveModal, setShowApproveModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)

  const [isReopening, setIsReopening] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [actionError, setActionError] = useState(null)

  const fetchData = useCallback(async (isRetry = false) => {
    if (!campaignId) return
    if (isRetry) setRetrying(true)
    else setLoading(true)
    setError(null)

    try {
      const [campaignRes, profileRes] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}`),
        fetch('/api/auth/profile').catch(() => null),
      ])

      if (campaignRes.status === 401) {
        router.push('/login')
        return
      }
      if (campaignRes.status === 403) {
        setError('You do not have permission to view this campaign.')
        return
      }
      if (campaignRes.status === 404) {
        setError('Campaign not found. It may have been deleted.')
        return
      }
      if (!campaignRes.ok) {
        const err = await campaignRes.json().catch(() => ({}))
        setError(err.error || 'Failed to load campaign. Please try again.')
        return
      }

      const campaignData = await campaignRes.json()
      setData(campaignData)

      if (profileRes?.ok) {
        const profile = await profileRes.json()
        setUserRole(profile?.role)
      }
    } catch (err) {
      if (!navigator.onLine) {
        setError('You appear to be offline. Please check your connection.')
      } else {
        setError('Failed to load campaign data. Please try again.')
      }
    } finally {
      setLoading(false)
      setRetrying(false)
    }
  }, [campaignId, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const refreshData = async () => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`)
      if (res.status === 401) { router.push('/login'); return }
      if (res.ok) {
        const campaignData = await res.json()
        setData(campaignData)
      }
    } catch {}
  }

  const handleReopen = async () => {
    setIsReopening(true)
    setActionError(null)
    // Optimistic update
    const prevData = data
    setData(prev => prev ? {
      ...prev,
      campaign: { ...prev.campaign, status: 'draft', campaign_version: (prev.campaign.campaign_version || 1) + 1 }
    } : prev)

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const result = await res.json()

      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) {
        setData(prevData) // rollback
        setActionError(result.error || 'Failed to reopen campaign. Please try again.')
        toast.error('Failed to reopen campaign.')
        return
      }
      toast.success('Campaign reopened for revision.')
      await refreshData()
    } catch {
      setData(prevData) // rollback
      setActionError('An unexpected error occurred. Please try again.')
      toast.error('An unexpected error occurred.')
    } finally {
      setIsReopening(false)
    }
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setActionError(null)
    const prevData = data
    // Optimistic update
    setData(prev => prev ? {
      ...prev,
      campaign: { ...prev.campaign, status: 'pending' }
    } : prev)

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/submit`, {
        method: 'POST',
      })
      const result = await res.json()

      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) {
        setData(prevData) // rollback
        setActionError(result.error || 'Failed to submit campaign. Please try again.')
        toast.error(result.error || 'Failed to submit campaign.')
        return
      }
      toast.success('Campaign submitted for approval!')
      await refreshData()
    } catch {
      setData(prevData) // rollback
      setActionError('An unexpected error occurred. Please try again.')
      toast.error('An unexpected error occurred.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-400">Loading campaign...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <nav className="mb-6">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">← Back to Dashboard</a>
        </nav>
        <div className="bg-red-900/40 border border-red-700 rounded-xl p-6 text-center">
          <svg className="w-8 h-8 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-red-300 font-medium mb-4">{error}</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => fetchData(true)}
              disabled={retrying}
              className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {retrying ? <span className="flex items-center gap-2"><Spinner size="sm" />Retrying...</span> : 'Try Again'}
            </button>
            <a href="/dashboard" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors">
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    )
  }

  const { campaign, status_log, score_log, mock_metrics } = data || {}

  // JSONB null safety
  const gc = campaign?.generated_content
  const hasEmail = gc?.email && !gc.email?.error && typeof gc.email === 'object'
  const hasSocial = gc?.social && !gc.social?.error && typeof gc.social === 'object'
  const hasAds = gc?.ads && !gc.ads?.error && typeof gc.ads === 'object'
  const hasGeneratedContent = hasEmail || hasSocial || hasAds

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="mb-6" aria-label="Breadcrumb">
        <a href="/dashboard" className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Back to Dashboard
        </a>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{campaign?.name || 'Untitled Campaign'}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_STYLES[campaign?.status] || 'bg-gray-700 text-gray-300'}`}>
              {campaign?.status || 'unknown'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400 flex-wrap">
            <span>Version {campaign?.campaign_version || 1}</span>
            {campaign?.brand_score !== null && campaign?.brand_score !== undefined ? (
              <span>
                Brand Score:{' '}
                <span className={`font-semibold ${SCORE_COLOR(campaign.brand_score)}`}>
                  {campaign.brand_score}
                </span>
              </span>
            ) : (
              <span className="text-gray-500">Not scored yet</span>
            )}
            <div className="flex gap-1 flex-wrap">
              {(campaign?.channels || []).map(ch => (
                <span key={ch} className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded capitalize">{ch}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {campaign?.status === 'draft' && (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || (userRole === 'editor' && (campaign?.brand_score === null || campaign?.brand_score === undefined || campaign?.brand_score < 85))}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-950"
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2"><Spinner size="sm" />Submitting...</span>
              ) : 'Submit for Approval'}
            </button>
          )}

          {campaign?.status === 'pending' && userRole === 'admin' && (
            <>
              <button
                onClick={() => setShowApproveModal(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-gray-950"
              >
                Approve
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-950"
              >
                Reject
              </button>
            </>
          )}

          {campaign?.status === 'rejected' && ['admin', 'editor'].includes(userRole) && (
            <button
              onClick={handleReopen}
              disabled={isReopening}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
              aria-busy={isReopening}
            >
              {isReopening ? (
                <span className="flex items-center gap-2"><Spinner size="sm" />Reopening...</span>
              ) : 'Reopen for Revision'}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg flex items-center justify-between" role="alert">
          <p className="text-red-300 text-sm">{actionError}</p>
          <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-200 ml-4 flex-shrink-0" aria-label="Dismiss error">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Score gate warning */}
      {campaign?.status === 'draft' && userRole === 'editor' && (campaign?.brand_score === null || campaign?.brand_score === undefined || campaign?.brand_score < 85) && (
        <div className="mb-4 p-3 bg-amber-900/40 border border-amber-700 rounded-lg" role="status">
          <p className="text-amber-300 text-sm">
            {campaign?.brand_score === null || campaign?.brand_score === undefined
              ? '⚠️ Score your content before submitting for approval.'
              : `⚠️ Brand score must be at least 85 to submit. Current score: ${campaign.brand_score}`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Brief */}
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Campaign Brief</h2>
            <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
              {campaign?.brief || <span className="text-gray-500 italic">No brief provided.</span>}
            </p>
          </div>

          {/* No generated content state */}
          {!hasGeneratedContent && campaign?.status === 'draft' && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 border-dashed p-8 text-center">
              <svg className="w-10 h-10 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-400 font-medium mb-1">No content generated yet</p>
              <p className="text-gray-500 text-sm">Use the campaign builder to generate AI content for your campaign.</p>
            </div>
          )}

          {/* Email Content */}
          {hasEmail && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Email Campaign</h2>
              <div className="space-y-3 mb-4">
                {(gc.email.subject_lines?.length > 0) && (
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider">Subject Lines</label>
                    {gc.email.subject_lines.map((sl, i) => (
                      <div key={i} className="mt-1 px-3 py-2 bg-gray-800 rounded text-sm text-gray-200">{sl || '(empty)'}</div>
                    ))}
                  </div>
                )}
                {gc.email.preview_text && (
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider">Preview Text</label>
                    <div className="mt-1 px-3 py-2 bg-gray-800 rounded text-sm text-gray-200">{gc.email.preview_text}</div>
                  </div>
                )}
              </div>
              {gc.email.html_body ? (
                <EmailPreviewFrame htmlBody={gc.email.html_body} />
              ) : (
                <p className="text-gray-500 text-sm italic">No email body generated.</p>
              )}
            </div>
          )}

          {/* Social Content */}
          {hasSocial && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Social Media</h2>
              <div className="space-y-4">
                {gc.social.instagram && (
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider">Instagram</label>
                    <div className="mt-1 px-3 py-2 bg-gray-800 rounded text-sm text-gray-200 whitespace-pre-wrap">
                      {gc.social.instagram.caption || <span className="italic text-gray-500">No caption</span>}
                    </div>
                    {gc.social.instagram.hashtags?.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {gc.social.instagram.hashtags.map((h, i) => (
                          <span key={i} className="text-indigo-400 text-xs">#{h}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {gc.social.twitter && (
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider">Twitter / X</label>
                    <div className="mt-1 px-3 py-2 bg-gray-800 rounded text-sm text-gray-200">
                      {gc.social.twitter.post || <span className="italic text-gray-500">No post content</span>}
                    </div>
                  </div>
                )}
                {gc.social.linkedin && (
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider">LinkedIn</label>
                    <div className="mt-1 px-3 py-2 bg-gray-800 rounded text-sm text-gray-200 whitespace-pre-wrap">
                      {gc.social.linkedin.post || <span className="italic text-gray-500">No post content</span>}
                    </div>
                  </div>
                )}
                {!gc.social.instagram && !gc.social.twitter && !gc.social.linkedin && (
                  <p className="text-gray-500 text-sm italic">No social content available.</p>
                )}
              </div>
            </div>
          )}

          {/* Ads Content */}
          {hasAds && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Ad Copy</h2>
              <AdCopyPanel adsContent={gc.ads} />
            </div>
          )}

          {/* Status Timeline */}
          {status_log?.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Status Timeline</h2>
              <StatusTimeline statusLog={status_log} />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {campaign?.status === 'draft' && (
            <BrandScoreWidget
              campaignId={campaign.id}
              initialScore={campaign.brand_score}
              onScoreUpdate={(score) => {
                setData(prev => prev ? {
                  ...prev,
                  campaign: { ...prev.campaign, brand_score: score }
                } : prev)
                toast.success(`Brand score updated: ${score}/100`)
              }}
            />
          )}

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <MockMetricsPanel campaignId={campaign?.id} metrics={mock_metrics} />
          </div>

          {score_log?.length > 0 && (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
              <ScoreHistoryAccordion scoreLog={score_log} />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showApproveModal && campaign && (
        <ApproveModal
          campaignId={campaign.id}
          brandScore={campaign.brand_score}
          campaignName={campaign.name}
          onClose={() => setShowApproveModal(false)}
          onSuccess={() => {
            setShowApproveModal(false)
            toast.success('Campaign approved successfully.')
            refreshData()
          }}
        />
      )}

      {showRejectModal && campaign && (
        <RejectModal
          campaignId={campaign.id}
          campaignName={campaign.name}
          onClose={() => setShowRejectModal(false)}
          onSuccess={() => {
            setShowRejectModal(false)
            toast.success('Campaign rejected. Creator notified.')
            refreshData()
          }}
        />
      )}
    </div>
  )
}

export default function CampaignDetailPage() {
  return (
    <ErrorBoundary message="Failed to load campaign details. Please refresh the page.">
      <CampaignDetailContent />
    </ErrorBoundary>
  )
}