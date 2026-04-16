'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ApproveModal from '@/components/approvals/ApproveModal'
import RejectModal from '@/components/approvals/RejectModal'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { useToast } from '@/components/ui/Toast'
import Spinner from '@/components/ui/Spinner'

const SCORE_COLOR = (score) => {
  if (score === null || score === undefined) return 'text-gray-400'
  if (score >= 85) return 'text-green-400'
  if (score >= 70) return 'text-amber-400'
  return 'text-red-400'
}

const SCORE_BG = (score) => {
  if (score === null || score === undefined) return 'bg-gray-800/50'
  if (score >= 85) return 'bg-green-900/30'
  if (score >= 70) return 'bg-amber-900/30'
  return 'bg-red-900/30'
}

function ApprovalsContent() {
  const toast = useToast()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retrying, setRetrying] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [modalType, setModalType] = useState(null)

  const fetchCampaigns = useCallback(async (isRetry = false) => {
    if (isRetry) setRetrying(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/approvals')

      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 403) {
        setError('You do not have permission to view the approval queue.')
        return
      }
      if (res.status === 429) {
        setError('Too many requests. Please wait a moment and try again.')
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to load approval queue.')
        return
      }

      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch {
      setError(navigator.onLine
        ? 'Failed to load approval queue. Please try again.'
        : 'You appear to be offline. Please check your connection.')
    } finally {
      setLoading(false)
      setRetrying(false)
    }
  }, [router])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  const openApprove = (campaign) => { setSelectedCampaign(campaign); setModalType('approve') }
  const openReject = (campaign) => { setSelectedCampaign(campaign); setModalType('reject') }
  const closeModal = () => { setSelectedCampaign(null); setModalType(null) }

  const handleSuccess = (action) => {
    const prev = selectedCampaign
    closeModal()
    if (prev) setCampaigns(c => c.filter(x => x.id !== prev.id))
    toast.success(action === 'approve' ? 'Campaign approved successfully.' : 'Campaign rejected. Creator notified.')
    fetchCampaigns()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" aria-live="polite">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-3 text-indigo-400" />
          <p className="text-gray-500 text-sm">Loading approval queue...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 animate-fade-in-up">
        <div className="max-w-md mx-auto bg-gray-900 border border-red-800/60 rounded-2xl p-6 text-center shadow-modal">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-900/30 flex items-center justify-center">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <p className="text-gray-200 font-medium mb-1">Failed to load queue</p>
          <p className="text-gray-500 text-sm mb-5">{error}</p>
          <button
            onClick={() => fetchCampaigns(true)}
            disabled={retrying}
            className={[
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg',
              'bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold',
              'transition-all duration-150 btn-press disabled:opacity-50 disabled:cursor-not-allowed',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
            ].join(' ')}
          >
            {retrying ? <><Spinner size="sm" />Retrying...</> : 'Try Again'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Approval Queue</h1>
          {campaigns.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-900/40 text-amber-300 border border-amber-700/50 rounded-full text-xs font-bold">
              {campaigns.length}
            </span>
          )}
        </div>
        <p className="text-gray-500 text-sm">
          {campaigns.length === 0
            ? 'No campaigns pending approval'
            : `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} awaiting review`}
        </p>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 border-dashed p-12 sm:p-16 text-center animate-fade-in-up">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-900/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-white font-semibold mb-1">All clear!</p>
          <p className="text-gray-500 text-sm mb-6">No campaigns pending approval right now.</p>
          <Link
            href="/dashboard"
            className={[
              'inline-flex items-center gap-2 px-4 py-2',
              'bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg',
              'transition-all duration-150 btn-press',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
            ].join(' ')}
          >
            ← Back to Dashboard
          </Link>
        </div>
      ) : (
        <div className="space-y-3 stagger-children" role="list" aria-label="Campaigns pending approval">
          {campaigns.map(campaign => {
            const score = campaign.brand_score
            const hasScore = score !== null && score !== undefined
            const isBelowGate = hasScore && score < 85

            return (
              <div
                key={campaign.id}
                role="listitem"
                className={[
                  'bg-gray-900 rounded-xl border border-gray-800 p-5',
                  'transition-all duration-200 hover:border-gray-700 hover:shadow-card-hover',
                  'animate-fade-in-up',
                ].join(' ')}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Title + score */}
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className={[
                          'text-base font-semibold text-white hover:text-indigo-300',
                          'transition-colors duration-150 truncate',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded',
                        ].join(' ')}
                        aria-label={`View campaign: ${campaign.name}`}
                      >
                        {campaign.name || 'Untitled Campaign'}
                      </Link>

                      {hasScore ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${SCORE_COLOR(score)} ${SCORE_BG(score)} ${isBelowGate ? 'border-amber-600/50' : 'border-transparent'}`}>
                          {score}
                          {isBelowGate && <span className="font-normal text-amber-400 ml-0.5">below gate</span>}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600 px-2 py-0.5 bg-gray-800 rounded-full border border-gray-700">
                          Unscored
                        </span>
                      )}
                    </div>

                    <p className="text-gray-500 text-sm line-clamp-2 mb-3 leading-relaxed">
                      {campaign.brief || 'No brief provided.'}
                    </p>

                    <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                      <div className="flex gap-1">
                        {(campaign.channels || []).map(ch => (
                          <span key={ch} className="px-1.5 py-0.5 bg-gray-800 text-gray-400 rounded capitalize border border-gray-700/50">{ch}</span>
                        ))}
                      </div>
                      {campaign.updated_at && (
                        <span>Submitted {new Date(campaign.updated_at).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0 sm:flex-col xs:flex-row">
                    <button
                      onClick={() => openApprove(campaign)}
                      className={[
                        'flex-1 sm:flex-none flex items-center justify-center gap-1.5',
                        'px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg',
                        'transition-all duration-150 btn-press',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
                      ].join(' ')}
                      aria-label={`Approve: ${campaign.name}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve
                    </button>
                    <button
                      onClick={() => openReject(campaign)}
                      className={[
                        'flex-1 sm:flex-none flex items-center justify-center gap-1.5',
                        'px-4 py-2 bg-gray-800 hover:bg-red-900/60 border border-gray-700 hover:border-red-700/60 text-gray-300 hover:text-red-300 text-sm font-semibold rounded-lg',
                        'transition-all duration-150 btn-press',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
                      ].join(' ')}
                      aria-label={`Reject: ${campaign.name}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {modalType === 'approve' && selectedCampaign && (
        <ApproveModal
          campaignId={selectedCampaign.id}
          brandScore={selectedCampaign.brand_score}
          campaignName={selectedCampaign.name}
          onClose={closeModal}
          onSuccess={() => handleSuccess('approve')}
        />
      )}
      {modalType === 'reject' && selectedCampaign && (
        <RejectModal
          campaignId={selectedCampaign.id}
          campaignName={selectedCampaign.name}
          onClose={closeModal}
          onSuccess={() => handleSuccess('reject')}
        />
      )}
    </div>
  )
}

export default function ApprovalsPage() {
  return (
    <ErrorBoundary message="Failed to load the approval queue. Please refresh the page.">
      <ApprovalsContent />
    </ErrorBoundary>
  )
}