'use client'

import { useState } from 'react'

function CopyableField({ label, value, maxChars, multiLine }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const over = maxChars && value?.length > maxChars
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {label && <p className="text-xs text-gray-500 mb-1">{label}</p>}
          <p className={`text-sm text-gray-200 ${multiLine ? 'whitespace-pre-wrap' : ''}`}>{value}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {maxChars && (
            <span className={`text-xs tabular-nums ${over ? 'text-red-400' : 'text-gray-500'}`}>
              {value?.length || 0}/{maxChars}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 text-gray-400 hover:text-white transition-colors"
            title="Copy"
          >
            {copied ? (
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 4.5h-1.5a2.251 2.251 0 00-2.15 1.836m5.4 0h.003M15 13.5a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdsContentPanel({ content, loading }) {
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {[1,2].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-gray-800 rounded w-28" />
            <div className="space-y-2">
              {[1,2,3].map(j => <div key={j} className="h-12 bg-gray-800 rounded" />)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!content || content.error) {
    return <div className="text-center py-8 text-gray-400">Ads content unavailable</div>
  }

  return (
    <div className="space-y-8">
      {/* Google Ads */}
      {content.google && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-gray-300">Google Ads</span>
            <span className="text-xs text-gray-500">Platform-ready format</span>
          </div>
          <div className="space-y-4">
            {content.google.headlines?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Headlines (max 30 chars each)</p>
                <div className="space-y-2">
                  {content.google.headlines.map((h, i) => (
                    <CopyableField key={i} label={`Headline ${i + 1}`} value={h} maxChars={30} />
                  ))}
                </div>
              </div>
            )}
            {content.google.descriptions?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">Descriptions (max 90 chars each)</p>
                <div className="space-y-2">
                  {content.google.descriptions.map((d, i) => (
                    <CopyableField key={i} label={`Description ${i + 1}`} value={d} maxChars={90} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Meta Ads */}
      {content.meta && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-gray-300">Meta Ads</span>
            <span className="text-xs text-gray-500">Facebook & Instagram</span>
          </div>
          <div className="space-y-2">
            {content.meta.headline && (
              <CopyableField label="Headline" value={content.meta.headline} />
            )}
            {content.meta.primary_text && (
              <CopyableField label="Primary Text" value={content.meta.primary_text} multiLine />
            )}
          </div>
        </div>
      )}
    </div>
  )
}