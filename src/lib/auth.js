import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * getAuthenticatedUser()
 *
 * Verifies the current session and fetches the user's role from the database.
 * Returns { userId, accountId, role }.
 * Throws { message, status } errors for 401/403 cases.
 *
 * IMPORTANT: Role is fetched from the users table, never from the JWT.
 */
export async function getAuthenticatedUser() {
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // Ignore cookie set errors in read-only contexts
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Ignore cookie remove errors in read-only contexts
          }
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    const err = new Error('Unauthorized — no valid session')
    err.status = 401
    throw err
  }

  // Fetch role from users table — never trust JWT claims for role
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('id, account_id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    const err = new Error('Unauthorized — user profile not found')
    err.status = 401
    throw err
  }

  return {
    userId: profile.id,
    accountId: profile.account_id,
    role: profile.role,
  }
}