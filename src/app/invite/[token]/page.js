'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createBrowserClient } from '@supabase/ssr'

const acceptSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

export default function InvitePage() {
  const router = useRouter()
  const params = useParams()
  const token = params?.token

  const [inviteData, setInviteData] = useState(null)
  const [loadingInvite, setLoadingInvite] = useState(true)
  const [inviteError, setInviteError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // Check expiry warning (< 24 hours remaining)
  const [expiryWarning, setExpiryWarning] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(acceptSchema),
  })

  useEffect(() => {
    if (!token) return

    const validateToken = async () => {
      try {
        const res = await fetch(`/api/team/invite/${token}`)
        if (res.status === 404) {
          setInviteError('This invite link is invalid or does not exist.')
          return
        }
        if (res.status === 410) {
          const data = await res.json()
          setInviteError(data.error || 'This invite has expired or has already been accepted.')
          return
        }
        if (!res.ok) {
          setInviteError('Failed to validate invite. Please try again.')
          return
        }

        const data = await res.json()
        setInviteData(data)

        // Check if invite expires within 24 hours
        if (data.expires_at) {
          const expiresAt = new Date(data.expires_at)
          const hoursRemaining = (expiresAt - Date.now()) / (1000 * 60 * 60)
          if (hoursRemaining < 24) {
            setExpiryWarning(true)
          }
        }
      } catch (err) {
        setInviteError('Failed to validate invite. Please try again.')
      } finally {
        setLoadingInvite(false)
      }
    }

    validateToken()
  }, [token])

  const onSubmit = async (data) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Step 1: Accept the invite (creates auth user + db user)
      const res = await fetch(`/api/team/invite/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: data.full_name,
          password: data.password,
        }),
      })

      const result = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          setSubmitError('A user with this email already exists. Please sign in instead.')
        } else if (res.status === 410) {
          setSubmitError('This invite has expired or has already been accepted.')
        } else {
          setSubmitError(result.error || 'Failed to create account. Please try again.')
        }
        return
      }

      // Step 2: Sign in with the credentials the user just entered
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: inviteData.email,
        password: data.password,
      })

      if (signInError) {
        setSubmitError('Account created but sign-in failed. Please go to the login page.')
        return
      }

      // Step 3: Redirect to dashboard
      router.push('/dashboard')
      router.refresh()
    } catch (err) {
      setSubmitError('An unexpected error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Validating invite...</p>
        </div>
      </div>
    )
  }

  if (inviteError) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
            <div className="w-12 h-12 bg-red-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Invalid Invite</h2>
            <p className="text-gray-400 text-sm mb-6">{inviteError}</p>
            <a href="/login" className="text-indigo-400 hover:text-indigo-300 text-sm transition-colors">
              Go to sign in
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">RelevantSee</h1>
          <p className="text-gray-400 mt-2">AI Marketing Campaign Copilot</p>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8">
          <h2 className="text-xl font-semibold text-white mb-1">You've been invited</h2>
          {inviteData && (
            <div className="mb-6">
              <p className="text-gray-400 text-sm">
                Join <span className="text-white font-medium">{inviteData.account_name}</span> as{' '}
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-900/60 text-indigo-300 capitalize">
                  {inviteData.role}
                </span>
              </p>
              <p className="text-gray-500 text-xs mt-1">{inviteData.email}</p>
            </div>
          )}

          {expiryWarning && (
            <div className="mb-4 p-3 bg-amber-900/40 border border-amber-700 rounded-lg">
              <p className="text-amber-300 text-sm">
                ⚠️ This invite expires soon. Complete your setup promptly.
              </p>
            </div>
          )}

          {submitError && (
            <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg">
              <p className="text-red-300 text-sm">{submitError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-300 mb-1">
                Full name
              </label>
              <input
                id="full_name"
                type="text"
                autoComplete="name"
                {...register('full_name')}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Jane Smith"
              />
              {errors.full_name && (
                <p className="mt-1 text-red-400 text-xs">{errors.full_name.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Create password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Minimum 8 characters"
              />
              {errors.password && (
                <p className="mt-1 text-red-400 text-xs">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-300 mb-1">
                Confirm password
              </label>
              <input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                {...register('confirm_password')}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Re-enter your password"
              />
              {errors.confirm_password && (
                <p className="mt-1 text-red-400 text-xs">{errors.confirm_password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Creating account...
                </span>
              ) : 'Create account & sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}