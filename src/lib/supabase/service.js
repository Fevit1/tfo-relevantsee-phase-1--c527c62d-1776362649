import { createClient } from '@supabase/supabase-js'

/**
 * createServiceClient()
 *
 * Creates a Supabase client using the service role key.
 * Bypasses RLS — use ONLY in server-side API routes for privileged operations.
 * NEVER use in client components or expose to the browser.
 *
 * Synchronous — do NOT await.
 */
export function createServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}