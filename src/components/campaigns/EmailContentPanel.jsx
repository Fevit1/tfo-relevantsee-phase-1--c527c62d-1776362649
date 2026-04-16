'use client'

import { useState } from 'react'

export function EmailContentPanel({ content, loading }) {
  const [activeSubject, setActiveSubject] = useState(0)

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 bg-gray-800 rounded w-32" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-800 rounded" />)}
        </div>
        <div className="h-4 bg-gray-800 rounded w-24 mt-4" />
        <div className="h-48 bg-gray-800 rounded" />
      </div>
    )
  }

  if (!content || content.error) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>Email content unavailable</p>
        {content?.error && <p className="text-xs mt-1 text-red-400">{content.error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Subject lines */}
      {content.subject_lines?.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Subject Lines</h3>
          <div className="space-y-2">
            {content.subject_lines.map((subject, i) => (
              <div
                key={i}
                onClick={() => setActiveSubject(i)}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                  activeSubject === i
                    ? 'border-indigo-500 bg-indigo-950/30'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <span className="text-sm text-white">{subject}</span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(subject) }}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-white transition-colors"
                  title="Copy"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 4.5h-1.5a2.251 2.251 0 00-2.15 1.836m5.4 0h.003M15 13.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preview text */}
      {content.preview_text && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Preview Text</h3>
          <div className="flex items-center justify-between p-3 rounded-lg border border-gray-700 bg-gray-800">
            <span className="text-sm text-gray-300">{content.preview_text}</span>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(content.preview_text)}
              className="flex-shrink-0 p-1 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5A3.375 3.375 0 006.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0015 4.5h-1.5a2.251 2.251 0 00-2.15 1.836m5.4 0h.003M15 13.5a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Recommended send time */}
      {content.recommended_send_time && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Recommended: <span className="text-white font-medium">{content.recommended_send_time}</span>
        </div>
      )}

      {/* HTML Preview */}
      {content.html_body && (
        <div>
          <h3 className="text-sm font-semibold text-gray-300 mb-2">Email Preview</h3>
          <div className="rounded-lg border border-gray-700 overflow-hidden bg-white">
            <iframe
              srcDoc={content.html_body}
              sandbox="allow-same-origin"
              className="w-full min-h-[400px]"
              title="Email preview"
              style={{ height: '400px' }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1.5">Rendered preview — scripts and external resources are blocked</p>
        </div>
      )}
    </div>
  )
}