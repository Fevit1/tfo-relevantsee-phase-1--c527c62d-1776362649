/**
 * Simple in-memory rate limiter using a Map with TTL.
 * Phase 1 approximation — does not persist across serverless function instances.
 * For production, replace with Redis-based implementation.
 *
 * Usage:
 *   const result = checkRateLimit('generate', userId, 10, 3600)
 *   if (!result.allowed) return NextResponse.json({ error: 'Rate limited' }, { status: 429, headers: { 'Retry-After': String(result.retryAfter) } })
 */

// Store: key -> { count: number, windowStart: number }
const rateLimitStore = new Map()

// Cleanup interval: remove expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, value] of rateLimitStore.entries()) {
      if (now - value.windowStart > value.windowMs) {
        rateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)
}

/**
 * Check and increment rate limit counter.
 *
 * @param {string} prefix - Identifier for the rate limit bucket (e.g. 'generate', 'invite')
 * @param {string} identifier - User ID or account ID to scope the limit
 * @param {number} maxRequests - Maximum requests allowed in the window
 * @param {number} windowSeconds - Time window in seconds
 * @returns {{ allowed: boolean, remaining: number, retryAfter: number }}
 */
export function checkRateLimit(prefix, identifier, maxRequests, windowSeconds) {
  const key = `${prefix}:${identifier}`
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  const existing = rateLimitStore.get(key)

  if (!existing || now - existing.windowStart > windowMs) {
    // New window
    rateLimitStore.set(key, { count: 1, windowStart: now, windowMs })
    return { allowed: true, remaining: maxRequests - 1, retryAfter: 0 }
  }

  if (existing.count >= maxRequests) {
    const retryAfter = Math.ceil((existing.windowStart + windowMs - now) / 1000)
    return { allowed: false, remaining: 0, retryAfter }
  }

  existing.count += 1
  return { allowed: true, remaining: maxRequests - existing.count, retryAfter: 0 }
}