'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import Spinner from '@/components/ui/Spinner'
import FirstRunBanner from '@/components/settings/FirstRunBanner'

function SettingsContent() {
  const router = useRouter()
  const toast = useToast()
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [firstRun, setFirstRun] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const [brandName, setBrandName] = useState('')
  const [brandVoice, setBrandVoice] = useState('')
  const [toneKeywordsInput, setToneKeywordsInput] = useState('')
  const [toneKeywords, setToneKeywords] = useState([])
  const [bannedPhrasesInput, setBannedPhrasesInput] = useState('')
  const [bannedPhrases, setBannedPhrases] = useState([])
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#6366f1')

  const fetchBrand = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/accounts/brand')

      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 403) {
        setError('You do not have permission to view brand settings.')
        setLoading(false)
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to load brand settings. Please try again.')
        setLoading(false)
        return
      }

      const data = await res.json()
      setAccount(data.account)
      setFirstRun(data.first_run)
      setBrandName(data.account?.name || '')
      setBrandVoice(data.account?.brand_voice || '')
      setToneKeywords(Array.isArray(data.account?.tone_keywords) ? data.account.tone_keywords : [])
      setBannedPhrases(Array.isArray(data.account?.banned_phrases) ? data.account.banned_phrases : [])
      setLogoUrl(data.account?.logo_url || '')
      setPrimaryColor(data.account?.primary_color || '#6366f1')
    } catch (err) {
      if (!navigator.onLine) {
        setError('You appear to be offline. Please check your connection.')
      } else {
        setError('Failed to load brand settings. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchBrand()
  }, [fetchBrand])

  const addToneKeyword = () => {
    const kw = toneKeywordsInput.trim()
    if (!kw) return
    if (toneKeywords.includes(kw)) {
      toast.warning(`"${kw}" is already in your tone keywords.`)
      return
    }
    if (toneKeywords.length >= 20) {
      toast.warning('Maximum 20 tone keywords allowed.')
      return
    }
    setToneKeywords(prev => [...prev, kw])
    setToneKeywordsInput('')
  }

  const removeToneKeyword = (kw) => {
    setToneKeywords(prev => prev.filter(k => k !== kw))
  }

  const addBannedPhrase = () => {
    const phrase = bannedPhrasesInput.trim()
    if (!phrase) return
    if (bannedPhrases.includes(phrase)) {
      toast.warning(`"${phrase}" is already in your banned phrases.`)
      return
    }
    if (bannedPhrases.length >= 50) {
      toast.warning('Maximum 50 banned phrases allowed.')
      return
    }
    setBannedPhrases(prev => [...prev, phrase])
    setBannedPhrasesInput('')
  }

  const removeBannedPhrase = (phrase) => {
    setBannedPhrases(prev => prev.filter(p => p !== phrase))
  }

  const validateForm = () => {
    const errors = {}
    if (!brandName.trim()) errors.brandName = 'Brand name is required.'
    if (logoUrl && logoUrl.trim()) {
      try {
        const url = new URL(logoUrl)
        if (url.protocol !== 'https:') errors.logoUrl = 'Logo URL must use HTTPS.'
      } catch {
        errors.logoUrl = 'Logo URL must be a valid URL.'
      }
    }
    if (primaryColor && !/^#[0-9A-Fa-f]{3,8}$/.test(primaryColor)) {
      errors.primaryColor = 'Primary color must be a valid hex code (e.g. #6366f1).'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaveError(null)
    if (!validateForm()) return

    setSaving(true)

    try {
      const res = await fetch('/api/accounts/brand', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: brandName.trim(),
          brand_voice: brandVoice,
          tone_keywords: toneKeywords,
          banned_phrases: bannedPhrases,
          logo_url: logoUrl || null,
          primary_color: primaryColor || null,
        }),
      })

      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 403) {
        setSaveError('You do not have permission to update brand settings.')
        return
      }
      if (res.status === 429) {
        setSaveError('Too many requests. Please wait a moment and try again.')
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setSaveError(data.error || 'Failed to save settings. Please try again.')
        return
      }

      setAccount(data.account)
      setFirstRun(data.first_run)
      toast.success('Brand settings saved successfully!')
    } catch (err) {
      if (!navigator.onLine) {
        setSaveError('You appear to be offline. Please check your connection.')
      } else {
        setSaveError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-400">Loading brand settings...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900/40 border border-red-700 rounded-xl p-6">
          <p className="text-red-300 font-medium mb-4">{error}</p>
          <button
            onClick={fetchBrand}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Brand Settings</h1>
          <p className="text-gray-400 mt-1">Configure your brand voice for AI-generated content</p>
        </div>
        <Link
          href="/settings/team"
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors"
        >
          Team Management →
        </Link>
      </div>

      {firstRun && <FirstRunBanner />}

      <form onSubmit={handleSave} noValidate>
        {saveError && (
          <div className="mb-6 p-3 bg-red-900/40 border border-red-700 rounded-lg flex items-start gap-3" role="alert">
            <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
            </svg>
            <p className="text-red-300 text-sm">{saveError}</p>
          </div>
        )}

        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-6">
          {/* Brand Name */}
          <div>
            <label htmlFor="brand-name" className="block text-sm font-medium text-gray-300 mb-1">
              Brand Name <span className="text-red-400">*</span>
            </label>
            <input
              id="brand-name"
              type="text"
              value={brandName}
              onChange={e => { setBrandName(e.target.value); setFieldErrors(prev => ({ ...prev, brandName: undefined })) }}
              className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${fieldErrors.brandName ? 'border-red-500' : 'border-gray-700'}`}
              placeholder="Your brand name"
              aria-invalid={!!fieldErrors.brandName}
              aria-describedby={fieldErrors.brandName ? 'brand-name-error' : undefined}
            />
            {fieldErrors.brandName && (
              <p id="brand-name-error" className="mt-1 text-red-400 text-xs" role="alert">{fieldErrors.brandName}</p>
            )}
          </div>

          {/* Brand Voice */}
          <div>
            <label htmlFor="brand-voice" className="block text-sm font-medium text-gray-300 mb-1">Brand Voice</label>
            <p className="text-xs text-gray-500 mb-2">Describe your brand's tone, style, and personality for AI-generated content.</p>
            <textarea
              id="brand-voice"
              value={brandVoice}
              onChange={e => setBrandVoice(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="e.g. Professional but approachable, data-driven, empowering language, avoids jargon..."
            />
          </div>

          {/* Tone Keywords */}
          <div>
            <label htmlFor="tone-keyword-input" className="block text-sm font-medium text-gray-300 mb-1">
              Tone Keywords <span className="text-gray-500 font-normal">({toneKeywords.length}/20)</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                id="tone-keyword-input"
                type="text"
                value={toneKeywordsInput}
                onChange={e => setToneKeywordsInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addToneKeyword() } }}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Type a keyword and press Enter or Add"
                aria-label="Add tone keyword"
              />
              <button
                type="button"
                onClick={addToneKeyword}
                disabled={toneKeywords.length >= 20}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            {toneKeywords.length > 0 ? (
              <div className="flex flex-wrap gap-2" role="list" aria-label="Tone keywords">
                {toneKeywords.map(kw => (
                  <span key={kw} role="listitem" className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-900/40 border border-indigo-700 text-indigo-300 text-sm rounded-full">
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeToneKeyword(kw)}
                      className="ml-1 text-indigo-400 hover:text-white transition-colors"
                      aria-label={`Remove keyword: ${kw}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">No tone keywords added yet.</p>
            )}
          </div>

          {/* Banned Phrases */}
          <div>
            <label htmlFor="banned-phrase-input" className="block text-sm font-medium text-gray-300 mb-1">
              Banned Phrases <span className="text-gray-500 font-normal">({bannedPhrases.length}/50)</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">Content containing these phrases will fail brand scoring.</p>
            <div className="flex gap-2 mb-2">
              <input
                id="banned-phrase-input"
                type="text"
                value={bannedPhrasesInput}
                onChange={e => setBannedPhrasesInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBannedPhrase() } }}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Type a phrase and press Enter or Add"
                aria-label="Add banned phrase"
              />
              <button
                type="button"
                onClick={addBannedPhrase}
                disabled={bannedPhrases.length >= 50}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            {bannedPhrases.length > 0 ? (
              <div className="flex flex-wrap gap-2" role="list" aria-label="Banned phrases">
                {bannedPhrases.map(phrase => (
                  <span key={phrase} role="listitem" className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-full">
                    {phrase}
                    <button
                      type="button"
                      onClick={() => removeBannedPhrase(phrase)}
                      className="ml-1 text-red-400 hover:text-white transition-colors"
                      aria-label={`Remove banned phrase: ${phrase}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm italic">No banned phrases added yet.</p>
            )}
          </div>

          {/* Logo URL */}
          <div>
            <label htmlFor="logo-url" className="block text-sm font-medium text-gray-300 mb-1">Logo URL</label>
            <input
              id="logo-url"
              type="url"
              value={logoUrl}
              onChange={e => { setLogoUrl(e.target.value); setFieldErrors(prev => ({ ...prev, logoUrl: undefined })) }}
              className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${fieldErrors.logoUrl ? 'border-red-500' : 'border-gray-700'}`}
              placeholder="https://your-domain.com/logo.png"
              aria-invalid={!!fieldErrors.logoUrl}
              aria-describedby={fieldErrors.logoUrl ? 'logo-url-error' : 'logo-url-hint'}
            />
            <p id="logo-url-hint" className="mt-1 text-xs text-gray-500">Must be an HTTPS URL.</p>
            {fieldErrors.logoUrl && (
              <p id="logo-url-error" className="mt-1 text-red-400 text-xs" role="alert">{fieldErrors.logoUrl}</p>
            )}
          </div>

          {/* Primary Color */}
          <div>
            <label htmlFor="primary-color" className="block text-sm font-medium text-gray-300 mb-1">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                id="primary-color"
                type="color"
                value={primaryColor || '#6366f1'}
                onChange={e => { setPrimaryColor(e.target.value); setFieldErrors(prev => ({ ...prev, primaryColor: undefined })) }}
                className="h-9 w-16 rounded cursor-pointer bg-gray-800 border border-gray-700 p-0.5"
                aria-label="Pick primary color"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={e => { setPrimaryColor(e.target.value); setFieldErrors(prev => ({ ...prev, primaryColor: undefined })) }}
                className={`flex-1 px-3 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono ${fieldErrors.primaryColor ? 'border-red-500' : 'border-gray-700'}`}
                placeholder="#6366f1"
                aria-label="Primary color hex code"
              />
            </div>
            {fieldErrors.primaryColor && (
              <p className="mt-1 text-red-400 text-xs" role="alert">{fieldErrors.primaryColor}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-950"
            aria-busy={saving}
          >
            {saving ? (
              <span className="flex items-center gap-2"><Spinner size="sm" />Saving...</span>
            ) : 'Save Brand Settings'}
          </button>
          {account && (
            <span className="text-xs text-gray-500">
              Last saved: {account.updated_at ? new Date(account.updated_at).toLocaleString() : 'Never'}
            </span>
          )}
        </div>
      </form>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <ErrorBoundary message="Failed to load brand settings. Please refresh the page.">
      <SettingsContent />
    </ErrorBoundary>
  )
}