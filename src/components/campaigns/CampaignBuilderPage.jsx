'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Layout } from '@/components/Layout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { createCampaign, generateCampaignContent, scoreCampaign, submitCampaign } from '@/lib/api'
import { EmailContentPanel } from '@/components/campaigns/EmailContentPanel'
import { SocialContentPanel } from '@/components/campaigns/SocialContentPanel'
import { AdsContentPanel } from '@/components/campaigns/AdsContentPanel'
import { BrandScoreWidget } from '@/components/campaigns/BrandScoreWidget'

const BRIEF_MAX = 2000
const CHANNELS = [
  { value: 'email', label: 'Email', description: '3 subject variants, HTML body, send time' },
  { value: 'social', label: 'Social', description: 'Instagram, Twitter/X, LinkedIn' },
  { value: 'ads', label: 'Ads', description: 'Google & Meta ad copy, clipboard-ready' },
]

const briefSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(200, 'Name too long'),
  brief: z.string().min(10, 'Brief must be at least 10 characters').max(BRIEF_MAX, `Brief cannot exceed ${BRIEF_MAX} characters`),
  channels: z.array(z.string()).min(1, 'Select at least one channel'),
})

export function CampaignBuilderPage() {
  const router = useRouter()
  const [step, setStep] = useState('brief') // 'brief' | 'generating' | 'review'
  const [campaignId, setCampaignId] = useState(null)
  const [generatedContent, setGeneratedContent] = useState(null)
  const [generatingChannels, setGeneratingChannels] = useState({})
  const [brandScore, setBrandScore] = useState(null)
  const [scoringData, setScoringData] = useState(null)
  const [activeTab, setActiveTab] = useState('email')
  const [error, setError] = useState(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [scoreLoading, setScoreLoading] = useState(false)

  const form = useForm({
    resolver: zodResolver(briefSchema),
    defaultValues: { name: '', brief: '', channels: ['email'] },
  })

  const briefValue = form.watch('brief') || ''
  const selectedChannels = form.watch('channels') || []

  const toggleChannel = (ch) => {
    const cur = form.getValues('channels') || []
    if (cur.includes(ch)) {
      form.setValue('channels', cur.filter(c => c !== ch), { shouldValidate: true })
    } else {
      form.setValue('channels', [...cur, ch], { shouldValidate: true })
    }
  }

  const handleGenerate = async (values) => {
    setError(null)
    try {
      // Step 1: Create campaign
      const { campaign } = await createCampaign({
        name: values.name,
        brief: values.brief,
        channels: values.channels,
      })
      setCampaignId(campaign.id)
      setStep('generating')

      // Initialize loading states
      const loadingMap = {}
      values.channels.forEach(ch => { loadingMap[ch] = true })
      setGeneratingChannels(loadingMap)
      setActiveTab(values.channels[0])

      // Step 2: Generate content
      const result = await generateCampaignContent({
        campaign_id: campaign.id,
        channels: values.channels,
      })

      setGeneratedContent(result.campaign?.generated_content || {})
      setGeneratingChannels({})
      setStep('review')
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.')
      setStep('brief')
      setGeneratingChannels({})
    }
  }

  const handleScore = async () => {
    if (!campaignId) return
    setScoreLoading(true)
    setError(null)
    try {
      const result = await scoreCampaign({ campaign_id: campaignId })
      setBrandScore(result.brand_score)
      setScoringData(result)
    } catch (err) {
      setError(err.message || 'Scoring failed. Please try again.')
    } finally {
      setScoreLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!campaignId) return
    setSubmitLoading(true)
    setError(null)
    try {
      await submitCampaign(campaignId)
      router.push(`/campaigns/${campaignId}`)
    } catch (err) {
      setError(err.message || 'Submission failed.')
    } finally {
      setSubmitLoading(false)
    }
  }

  const canSubmit = brandScore !== null && brandScore >= 85

  return (
    <ProtectedRoute allowedRoles={['admin', 'editor']}>
      <Layout>
        <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">New Campaign</h1>
            <p className="text-sm text-gray-400 mt-0.5">Build an AI-powered marketing campaign across all your channels</p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Brief form */}
          {(step === 'brief' || step === 'generating') && (
            <form onSubmit={form.handleSubmit(handleGenerate)} className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
                {/* Campaign name */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-300">Campaign Name</label>
                  <input
                    type="text"
                    {...form.register('name')}
                    placeholder="e.g. Summer Collection Launch"
                    className={`w-full rounded-lg border bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${form.formState.errors.name ? 'border-red-700' : 'border-gray-700'}`}
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-red-400">{form.formState.errors.name.message}</p>
                  )}
                </div>

                {/* Brief */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-300">Campaign Brief</label>
                    <span className={`text-xs tabular-nums ${briefValue.length > BRIEF_MAX * 0.9 ? 'text-amber-400' : 'text-gray-500'}`}>
                      {briefValue.length} / {BRIEF_MAX}
                    </span>
                  </div>
                  <textarea
                    {...form.register('brief')}
                    rows={6}
                    placeholder="Describe your campaign goals, target audience, key messages, tone of voice, and any specific requirements..."
                    className={`w-full rounded-lg border bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none ${form.formState.errors.brief ? 'border-red-700' : 'border-gray-700'}`}
                    maxLength={BRIEF_MAX}
                  />
                  {form.formState.errors.brief && (
                    <p className="text-xs text-red-400">{form.formState.errors.brief.message}</p>
                  )}
                </div>

                {/* Channel selection */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Channels</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {CHANNELS.map(ch => {
                      const selected = selectedChannels.includes(ch.value)
                      return (
                        <button
                          key={ch.value}
                          type="button"
                          onClick={() => toggleChannel(ch.value)}
                          className={`flex flex-col items-start p-4 rounded-lg border text-left transition-colors ${
                            selected
                              ? 'border-indigo-500 bg-indigo-950/50 text-white'
                              : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                          }`}
                        >
                          <span className="text-sm font-semibold">{ch.label}</span>
                          <span className="text-xs mt-0.5 opacity-70">{ch.description}</span>
                        </button>
                      )
                    })}
                  </div>
                  {form.formState.errors.channels && (
                    <p className="text-xs text-red-400">{form.formState.errors.channels.message}</p>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={step === 'generating' || form.formState.isSubmitting}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {step === 'generating' ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Generating content…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                    Generate with AI
                  </>
                )}
              </button>
            </form>
          )}

          {/* Content review step */}
          {step === 'review' && generatedContent && (
            <div className="space-y-6">
              {/* Channel tabs */}
              <div className="flex gap-1 p-1 bg-gray-900 rounded-lg border border-gray-800 w-fit">
                {selectedChannels.map(ch => (
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

              {/* Panel content */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                {activeTab === 'email' && <EmailContentPanel content={generatedContent.email} />}
                {activeTab === 'social' && <SocialContentPanel content={generatedContent.social} />}
                {activeTab === 'ads' && <AdsContentPanel content={generatedContent.ads} />}
              </div>

              {/* Brand score widget */}
              <BrandScoreWidget
                score={brandScore}
                scoringData={scoringData}
                loading={scoreLoading}
                onScore={handleScore}
              />

              {/* Actions */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleScore}
                  disabled={scoreLoading}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 text-sm font-medium text-white rounded-lg transition-colors"
                >
                  {scoreLoading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-500 border-t-white" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  )}
                  {scoreLoading ? 'Scoring…' : 'Score Brand Compliance'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={submitLoading || !canSubmit}
                    title={!canSubmit ? brandScore === null ? 'Score your campaign first' : `Brand score must be ≥ 85 (current: ${brandScore})` : ''}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white rounded-lg transition-colors"
                  >
                    {submitLoading ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : null}
                    Submit for Approval
                  </button>
                  {brandScore !== null && brandScore < 85 && (
                    <span className="text-xs text-amber-400">Score must be ≥ 85</span>
                  )}
                  {brandScore === null && (
                    <span className="text-xs text-gray-500">Score required before submitting</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}