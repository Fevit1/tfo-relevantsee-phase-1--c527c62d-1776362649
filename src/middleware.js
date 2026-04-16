import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

/**
 * Next.js Middleware — Route Protection
 *
 * Protects all routes under /dashboard, /campaigns, /approvals, /settings.
 * Redirects unauthenticated users to /login.
 * Admin-only routes (/approvals, /settings/team) redirect non-admins to /dashboard.
 *
 * Public routes (no auth required):
 * - /login
 * - /invite/[token]
 * - /api/team/invite/[token] (GET — token validation)
 * - /api/team/invite/[token]/accept (POST — invite acceptance)
 * - /api/admin/seed-account (POST — guarded by PLATFORM_ADMIN_SECRET)
 */
export async function middleware(request) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Define protected routes
  const isProtectedRoute = (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/campaigns') ||
    pathname.startsWith('/approvals') ||
    pathname.startsWith('/settings')
  )

  // Redirect unauthenticated users to login
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Admin-only page routes — redirect non-admins to /dashboard
  const isAdminOnlyRoute = (
    pathname.startsWith('/approvals') ||
    pathname.startsWith('/settings/team')
  )

  if (isAdminOnlyRoute && user) {
    // Fetch role from database
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile && profile.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Redirect authenticated users away from login page
  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - Public API routes for invites and seed
     */
    '/((?!_next/static|_next/image|favicon.ico|api/team/invite|api/admin/seed-account).*)',
  ],
}