import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * createClient()
 *
 * Creates a Supabase client for server-side use (API routes, server components).
 * Uses the anon key with cookie-based session management.
 * Respects RLS policies.
 *
 * Must be awaited: const supabase = await createClient()
 */
export async function createClient() {
  const cookieStore = cookies()

  return createServerClient(
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
            // Ignore in read-only contexts
          }
        },
        remove(name, options) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // Ignore in read-only contexts
          }
        },
      },
    }
  )
}