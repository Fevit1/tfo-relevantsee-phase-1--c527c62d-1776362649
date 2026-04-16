'use client'

import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

const ToastContext = createContext(null)

const TOAST_ICONS = {
  success: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  info: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
}

const TOAST_STYLES = {
  success: {
    container: 'bg-gray-900 border-green-600/60',
    icon: 'text-green-400',
    text: 'text-gray-100',
    progress: 'bg-green-500',
  },
  error: {
    container: 'bg-gray-900 border-red-600/60',
    icon: 'text-red-400',
    text: 'text-gray-100',
    progress: 'bg-red-500',
  },
  warning: {
    container: 'bg-gray-900 border-amber-600/60',
    icon: 'text-amber-400',
    text: 'text-gray-100',
    progress: 'bg-amber-500',
  },
  info: {
    container: 'bg-gray-900 border-indigo-600/60',
    icon: 'text-indigo-400',
    text: 'text-gray-100',
    progress: 'bg-indigo-500',
  },
}

const TOAST_DURATIONS = {
  success: 4000,
  error: 6000,
  warning: 5000,
  info: 4000,
}

let toastIdCounter = 0

function ToastItem({ toast, onRemove }) {
  const [exiting, setExiting] = useState(false)
  const [progressWidth, setProgressWidth] = useState(100)
  const timerRef = useRef(null)
  const progressRef = useRef(null)
  const startTimeRef = useRef(Date.now())
  const duration = toast.duration || TOAST_DURATIONS[toast.type] || 4000

  const dismiss = useCallback(() => {
    setExiting(true)
    clearInterval(timerRef.current)
    clearInterval(progressRef.current)
    setTimeout(() => onRemove(toast.id), 220)
  }, [toast.id, onRemove])

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, duration)

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      const remaining = Math.max(0, ((duration - elapsed) / duration) * 100)
      setProgressWidth(remaining)
    }, 50)

    return () => {
      clearTimeout(timerRef.current)
      clearInterval(progressRef.current)
    }
  }, [dismiss, duration])

  const styles = TOAST_STYLES[toast.type] || TOAST_STYLES.info

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={[
        'relative flex items-start gap-3 p-4 rounded-xl border shadow-modal',
        'max-w-sm w-full overflow-hidden',
        styles.container,
        exiting ? 'animate-toast-out' : 'animate-toast-in',
      ].join(' ')}
      onMouseEnter={() => {
        clearTimeout(timerRef.current)
        clearInterval(progressRef.current)
      }}
      onMouseLeave={() => {
        const remaining = (progressWidth / 100) * duration
        timerRef.current = setTimeout(dismiss, remaining)
        progressRef.current = setInterval(() => {
          const elapsed = Date.now() - startTimeRef.current
          const rem = Math.max(0, ((duration - elapsed) / duration) * 100)
          setProgressWidth(rem)
        }, 50)
      }}
    >
      {/* Icon */}
      <span className={`mt-0.5 ${styles.icon}`}>
        {TOAST_ICONS[toast.type]}
      </span>

      {/* Message */}
      <p className={`flex-1 text-sm leading-snug ${styles.text}`}>
        {toast.message}
      </p>

      {/* Dismiss button */}
      <button
        onClick={dismiss}
        className="flex-shrink-0 text-gray-500 hover:text-gray-300 transition-colors duration-150 -mt-0.5 -mr-1 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label="Dismiss notification"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-800 rounded-b-xl overflow-hidden">
        <div
          className={`h-full transition-none ${styles.progress}`}
          style={{ width: `${progressWidth}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration) => {
    const id = ++toastIdCounter
    setToasts(prev => [...prev.slice(-4), { id, message, type, duration }])
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toast = {
    success: (msg, duration) => addToast(msg, 'success', duration),
    error: (msg, duration) => addToast(msg, 'error', duration),
    warning: (msg, duration) => addToast(msg, 'warning', duration),
    info: (msg, duration) => addToast(msg, 'info', duration),
  }

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container */}
      <div
        className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 items-end pointer-events-none"
        aria-label="Notifications"
      >
        {toasts.map(t => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}