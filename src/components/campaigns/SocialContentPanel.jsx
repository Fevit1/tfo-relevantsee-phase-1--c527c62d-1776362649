'use client'

import { useState } from 'react'

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 4.5h-1.5a2.251 2.251 0 00-2.15 1.836m5.4 0h.003M15 13.5a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Copy
        </>
      )}
    </button>
  )
}

export function SocialContentPanel({ content, loading }) {
  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        {[1,2,3].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-4 bg-gray-800 rounded w-24" />
            <div className="h-20 bg-gray-800 rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (!content || content.error) {
    return <div className="text-center py-8 text-gray-400">Social content unavailable</div>
  }

  return (
    <div className="space-y-6">
      {/* Instagram */}
      {content.instagram && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-300">Instagram</span>
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-gray-200 whitespace-pre-wrap flex-1">{content.instagram.caption}</p>
              <CopyButton text={content.instagram.caption} />
            </div>
            {content.instagram.hashtags?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <div className="flex flex-wrap gap-1">
                  {content.instagram.hashtags.map(h => (
                    <span key={h} className="text-xs text-indigo-400">#{h.replace('#', '')}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Twitter */}
      {content.twitter && (
        <div className="space-y-2">
          <span className="text-sm font-semibold text-gray-300">Twitter / X</span>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-gray-200 whitespace-pre-wrap flex-1">{content.twitter.post}</p>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs tabular-nums ${(content.twitter.post?.length || 0) > 260 ? 'text-red-400' : 'text-gray-500'}`}>
                  {content.twitter.post?.length || 0}/280
                </span>
                <CopyButton text={content.twitter.post} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LinkedIn */}
      {content.linkedin && (
        <div className="space-y-2">
          <span className="text-sm font-semibold text-gray-300">LinkedIn</span>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-gray-200 whitespace-pre-wrap flex-1">{content.linkedin.post}</p>
              <CopyButton text={content.linkedin.post} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}