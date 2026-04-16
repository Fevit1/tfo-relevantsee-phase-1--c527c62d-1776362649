import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const MAX_TONE_KEYWORDS = 20
const MAX_BANNED_PHRASES = 50
const MAX_EXAMPLE_CONTENT = 3

/**
 * GET /api/accounts/brand
 *
 * All roles. Returns the account's brand model fields.
 */
export async function GET(req) {
  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  const supabase = await createClient()

  const { data: account, error } = await supabase
    .from('accounts')
    .select('id, name, brand_voice, tone_keywords, banned_phrases, example_content, logo_url, primary_color, plan, updated_at')
    .eq('id', authContext.accountId)
    .single()

  if (error || !account) {
    console.error('[brand/GET] Query failed:', error?.message)
    return NextResponse.json({ error: 'Failed to fetch brand model' }, { status: 500 })
  }

  // Include first_run flag if brand_voice is empty
  const isFirstRun = !account.brand_voice || account.brand_voice.trim() === ''

  return NextResponse.json({ account, first_run: isFirstRun })
}

/**
 * PATCH /api/accounts/brand
 *
 * Admin only. Updates brand model fields.
 * Validates logo_url as HTTPS-only.
 * Enforces array length limits on tone_keywords and banned_phrases.
 */
export async function PATCH(req) {
  let authContext
  try {
    authContext = await getAuthenticatedUser()
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unauthorized' }, { status: err.status || 401 })
  }

  if (authContext.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin role required' }, { status: 403 })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, brand_voice, tone_keywords, banned_phrases, example_content, logo_url, primary_color } = body

  const updates = {}

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name must be a non-empty string' }, { status: 422 })
    }
    updates.name = name.trim()
  }

  if (brand_voice !== undefined) {
    if (typeof brand_voice !== 'string') {
      return NextResponse.json({ error: 'brand_voice must be a string' }, { status: 422 })
    }
    updates.brand_voice = brand_voice.trim()
  }

  if (tone_keywords !== undefined) {
    if (!Array.isArray(tone_keywords)) {
      return NextResponse.json({ error: 'tone_keywords must be an array' }, { status: 422 })
    }
    if (tone_keywords.length > MAX_TONE_KEYWORDS) {
      return NextResponse.json(
        { error: `tone_keywords cannot exceed ${MAX_TONE_KEYWORDS} items` },
        { status: 422 }
      )
    }
    updates.tone_keywords = tone_keywords.map(k => String(k).trim()).filter(Boolean)
  }

  if (banned_phrases !== undefined) {
    if (!Array.isArray(banned_phrases)) {
      return NextResponse.json({ error: 'banned_phrases must be an array' }, { status: 422 })
    }
    if (banned_phrases.length > MAX_BANNED_PHRASES) {
      return NextResponse.json(
        { error: `banned_phrases cannot exceed ${MAX_BANNED_PHRASES} items` },
        { status: 422 }
      )
    }
    updates.banned_phrases = banned_phrases.map(p => String(p).trim()).filter(Boolean)
  }

  if (example_content !== undefined) {
    if (!Array.isArray(example_content)) {
      return NextResponse.json({ error: 'example_content must be an array' }, { status: 422 })
    }
    if (example_content.length > MAX_EXAMPLE_CONTENT) {
      return NextResponse.json(
        { error: `example_content cannot exceed ${MAX_EXAMPLE_CONTENT} items` },
        { status: 422 }
      )
    }
    updates.example_content = example_content
  }

  if (logo_url !== undefined) {
    if (logo_url !== null && logo_url !== '') {
      if (typeof logo_url !== 'string') {
        return NextResponse.json({ error: 'logo_url must be a string' }, { status: 422 })
      }
      // Validate HTTPS-only
      try {
        const url = new URL(logo_url)
        if (url.protocol !== 'https:') {
          return NextResponse.json({ error: 'logo_url must use HTTPS' }, { status: 422 })
        }
      } catch {
        return NextResponse.json({ error: 'logo_url must be a valid URL' }, { status: 422 })
      }
    }
    updates.logo_url = logo_url || null
  }

  if (primary_color !== undefined) {
    if (primary_color !== null && primary_color !== '') {
      if (typeof primary_color !== 'string') {
        return NextResponse.json({ error: 'primary_color must be a string' }, { status: 422 })
      }
      // Basic hex color validation
      if (!/^#[0-9A-Fa-f]{3,8}$/.test(primary_color)) {
        return NextResponse.json({ error: 'primary_color must be a valid hex color (e.g. #FF5733)' }, { status: 422 })
      }
    }
    updates.primary_color = primary_color || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 })
  }

  const serviceClient = createServiceClient()

  const { data: updatedAccount, error: updateError } = await serviceClient
    .from('accounts')
    .update(updates)
    .eq('id', authContext.accountId)
    .select('id, name, brand_voice, tone_keywords, banned_phrases, example_content, logo_url, primary_color, plan, updated_at')
    .single()

  if (updateError || !updatedAccount) {
    console.error('[brand/PATCH] Update failed:', updateError?.message)
    return NextResponse.json({ error: 'Failed to update brand model' }, { status: 500 })
  }

  const isFirstRun = !updatedAccount.brand_voice || updatedAccount.brand_voice.trim() === ''

  return NextResponse.json({ account: updatedAccount, first_run: isFirstRun })
}