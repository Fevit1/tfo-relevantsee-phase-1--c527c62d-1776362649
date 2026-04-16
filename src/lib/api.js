/**
 * RelevantSee API Client
 *
 * Reusable frontend API helpers for all route handlers.
 * All functions use fetch with proper error handling.
 * Import these in page/component files instead of calling fetch directly.
 */

// ============================================================
// HTTP HELPER
// ============================================================

/**
 * Base fetch wrapper with consistent error handling.
 * Throws an ApiError on non-2xx responses.
 *
 * @param {string} path - API path (e.g. '/api/campaigns')
 * @param {RequestInit} options - fetch options
 * @returns {Promise<any>} Parsed JSON response
 */
async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = new Error(data.error || `Request failed with status ${response.status}`)
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

// ============================================================
// CAMPAIGNS
// ============================================================

/**
 * Create a new campaign in draft status.
 * @param {{ name: string, brief: string, channels: string[] }} payload
 * @returns {Promise<{ campaign: Object }>}
 */
export async function createCampaign(payload) {
  return apiFetch('/api/campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * List campaigns for the account with optional filters.
 * @param {{ status?: string, page?: number, page_size?: number }} params
 * @returns {Promise<{ campaigns: Object[], pagination: Object }>}
 */
export async function listCampaigns(params = {}) {
  const searchParams = new URLSearchParams()
  if (params.status) searchParams.set('status', params.status)
  if (params.page) searchParams.set('page', String(params.page))
  if (params.page_size) searchParams.set('page_size', String(params.page_size))

  const query = searchParams.toString()
  return apiFetch(`/api/campaigns${query ? `?${query}` : ''}`)
}

/**
 * Get full campaign detail including generated content, score log, and mock metrics.
 * @param {string} campaignId
 * @returns {Promise<{ campaign: Object, status_log: Object[], approval_log: Object[], score_log: Object[], mock_metrics: Object }>}
 */
export async function getCampaign(campaignId) {
  return apiFetch(`/api/campaigns/${campaignId}`)
}

/**
 * Update campaign fields (draft status only).
 * @param {string} campaignId
 * @param {Object} updates
 * @returns {Promise<{ campaign: Object }>}
 */
export async function updateCampaign(campaignId, updates) {
  return apiFetch(`/api/campaigns/${campaignId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

/**
 * Trigger AI generation for a campaign's channels.
 * @param {{ campaign_id: string, channels: string[] }} payload
 * @returns {Promise<{ campaign: Object, channel_errors?: Object[] }>}
 */
export async function generateCampaignContent(payload) {
  return apiFetch('/api/campaigns/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Run two-phase brand scoring on a campaign.
 * @param {{ campaign_id: string }} payload
 * @returns {Promise<{ brand_score: number, phase1: Object, phase2: Object, score_log_entry: Object }>}
 */
export async function scoreCampaign(payload) {
  return apiFetch('/api/campaigns/score', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Submit a campaign for approval (draft -> pending).
 * @param {string} campaignId
 * @returns {Promise<{ campaign: Object }>}
 */
export async function submitCampaign(campaignId) {
  return apiFetch(`/api/campaigns/${campaignId}/submit`, { method: 'POST' })
}

/**
 * Approve a pending campaign. Admin only.
 * @param {string} campaignId
 * @param {{ notes?: string, override_flag?: boolean }} payload
 * @returns {Promise<{ campaign: Object }>}
 */
export async function approveCampaign(campaignId, payload = {}) {
  return apiFetch(`/api/campaigns/${campaignId}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Reject a pending campaign. Admin only. Notes required.
 * @param {string} campaignId
 * @param {{ notes: string }} payload
 * @returns {Promise<{ campaign: Object }>}
 */
export async function rejectCampaign(campaignId, payload) {
  return apiFetch(`/api/campaigns/${campaignId}/reject`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Reopen a rejected campaign (rejected -> draft). Admin | Editor.
 * @param {string} campaignId
 * @param {{ notes?: string }} payload
 * @returns {Promise<{ campaign: Object, new_version: number }>}
 */
export async function reopenCampaign(campaignId, payload = {}) {
  return apiFetch(`/api/campaigns/${campaignId}/reopen`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ============================================================
// APPROVAL QUEUE
// ============================================================

/**
 * Get all pending campaigns for the approval queue. Admin only.
 * @returns {Promise<{ campaigns: Object[], count: number }>}
 */
export async function getApprovalQueue() {
  return apiFetch('/api/approvals')
}

// ============================================================
// BRAND SETTINGS
// ============================================================

/**
 * Get the account's brand model.
 * @returns {Promise<{ account: Object, first_run: boolean }>}
 */
export async function getBrandModel() {
  return apiFetch('/api/accounts/brand')
}

/**
 * Update the account's brand model. Admin only.
 * @param {Object} updates
 * @returns {Promise<{ account: Object, first_run: boolean }>}
 */
export async function updateBrandModel(updates) {
  return apiFetch('/api/accounts/brand', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  })
}

// ============================================================
// TEAM MANAGEMENT
// ============================================================

/**
 * Get team members and pending invites. Admin only.
 * @returns {Promise<{ members: Object[], pending_invites: Object[], member_count: number, soft_cap_warning: boolean }>}
 */
export async function getTeam() {
  return apiFetch('/api/team')
}

/**
 * Send a team invite. Admin only.
 * @param {{ email: string, role: string }} payload
 * @returns {Promise<{ invite: Object, soft_cap_warning: boolean, email_sent: boolean }>}
 */
export async function inviteTeamMember(payload) {
  return apiFetch('/api/team/invite', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Validate an invite token (public).
 * @param {string} token
 * @returns {Promise<{ account_name: string, role: string, email: string }>}
 */
export async function validateInviteToken(token) {
  return apiFetch(`/api/team/invite/${token}`)
}

/**
 * Accept an invite and create account (public).
 * @param {string} token
 * @param {{ full_name: string, password: string }} payload
 * @returns {Promise<{ success: boolean, user: Object }>}
 */
export async function acceptInvite(token, payload) {
  return apiFetch(`/api/team/invite/${token}/accept`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

/**
 * Update a team member's role. Admin only.
 * @param {string} userId
 * @param {{ role: string }} payload
 * @returns {Promise<{ user: Object }>}
 */
export async function updateMemberRole(userId, payload) {
  return apiFetch(`/api/team/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

/**
 * Remove a team member. Admin only.
 * @param {string} userId
 * @returns {Promise<{ success: boolean, removed_user_id: string }>}
 */
export async function removeMember(userId) {
  return apiFetch(`/api/team/${userId}`, { method: 'DELETE' })
}

// ============================================================
// MOCK METRICS HELPERS
// ============================================================

/**
 * Format mock metrics for display.
 * Metrics come from the GET /api/campaigns/[id] response.
 *
 * @param {{ impressions: number, clicks: number, ctr: string, conversions: number }} metrics
 * @returns {{ label: string, value: string }[]}
 */
export function formatMockMetrics(metrics) {
  if (!metrics) return []
  return [
    { label: 'Impressions', value: metrics.impressions?.toLocaleString() || '—' },
    { label: 'Clicks', value: metrics.clicks?.toLocaleString() || '—' },
    { label: 'CTR', value: metrics.ctr || '—' },
    { label: 'Conversions', value: metrics.conversions?.toLocaleString() || '—' },
  ]
}

// ============================================================
// PAGINATION HELPERS
// ============================================================

/**
 * Check if there are more pages to load.
 * @param {Object} pagination - Pagination object from list responses
 * @returns {boolean}
 */
export function hasNextPage(pagination) {
  return pagination?.has_next === true
}

/**
 * Get query params for a specific page.
 * @param {number} page
 * @param {number} pageSize
 * @returns {{ page: number, page_size: number }}
 */
export function paginationParams(page, pageSize = 20) {
  return { page: Math.max(1, page), page_size: pageSize }
}