'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import Spinner from '@/components/ui/Spinner'
import ConfirmDialog from '@/components/ui/ConfirmDialog'

const ROLE_LABELS = { admin: 'Admin', editor: 'Editor', viewer: 'Viewer' }

function TeamContent() {
  const router = useRouter()
  const toast = useToast()

  const [members, setMembers] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [retrying, setRetrying] = useState(false)

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviteErrors, setInviteErrors] = useState({})
  const [isInviting, setIsInviting] = useState(false)
  const [inviteApiError, setInviteApiError] = useState(null)

  // Role changes
  const [updatingRole, setUpdatingRole] = useState(null)

  // Remove member
  const [removingId, setRemovingId] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(null)

  // Resend invite
  const [resendingToken, setResendingToken] = useState(null)

  const fetchTeam = useCallback(async (isRetry = false) => {
    if (isRetry) setRetrying(true)
    else setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/team')

      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 403) {
        setError('You do not have permission to manage team settings.')
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to load team. Please try again.')
        return
      }

      const data = await res.json()
      setMembers(data.members || [])
      setPendingInvites(data.pending_invites || [])
      setMemberCount(data.member_count || 0)
    } catch (err) {
      if (!navigator.onLine) {
        setError('You appear to be offline. Please check your connection.')
      } else {
        setError('Failed to load team data. Please try again.')
      }
    } finally {
      setLoading(false)
      setRetrying(false)
    }
  }, [router])

  useEffect(() => {
    fetchTeam()
  }, [fetchTeam])

  const validateInvite = () => {
    const errors = {}
    if (!inviteEmail.trim()) errors.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)) errors.email = 'Enter a valid email address.'
    if (!inviteRole) errors.role = 'Role is required.'
    setInviteErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteApiError(null)
    if (!validateInvite()) return

    setIsInviting(true)
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole }),
      })

      if (res.status === 401) { router.push('/login'); return }
      if (res.status === 429) {
        setInviteApiError('Too many invitations sent. Please wait before sending more.')
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setInviteApiError(data.error || 'Failed to send invite. Please try again.')
        return
      }

      toast.success(`Invite sent to ${inviteEmail}!`)
      setInviteEmail('')
      setInviteRole('editor')

      if (data.soft_cap_warning) {
        toast.warning('Your team is approaching the 25-member limit.')
      }

      await fetchTeam()
    } catch {
      setInviteApiError('An unexpected error occurred. Please try again.')
    } finally {
      setIsInviting(false)
    }
  }

  const handleRoleChange = async (userId, newRole) => {
    setUpdatingRole(userId)
    const prevMembers = members
    // Optimistic update
    setMembers(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m))

    try {
      const res = await fetch(`/api/team/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (res.status === 401) { router.push('/login'); return }

      if (!res.ok) {
        setMembers(prevMembers) // rollback
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to update role.')
        return
      }

      toast.success('Role updated successfully.')
    } catch {
      setMembers(prevMembers) // rollback
      toast.error('Failed to update role.')
    } finally {
      setUpdatingRole(null)
    }
  }

  const handleRemoveMember = async (userId) => {
    setRemovingId(userId)
    setConfirmRemove(null)
    const prevMembers = members
    // Optimistic update
    setMembers(prev => prev.filter(m => m.id !== userId))
    setMemberCount(prev => prev - 1)

    try {
      const res = await fetch(`/api/team/${userId}`, {
        method: 'DELETE',
      })

      if (res.status === 401) { router.push('/login'); return }

      if (!res.ok) {
        setMembers(prevMembers) // rollback
        setMemberCount(prev => prev + 1)
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to remove team member.')
        return
      }

      toast.success('Team member removed.')
    } catch {
      setMembers(prevMembers) // rollback
      setMemberCount(prev => prev + 1)
      toast.error('Failed to remove team member.')
    } finally {
      setRemovingId(null)
    }
  }

  const handleResendInvite = async (invite) => {
    setResendingToken(invite.token || invite.id)

    try {
      // Delete old invite, create new one
      if (invite.id) {
        await fetch(`/api/team/invite/${invite.token || invite.id}`, { method: 'DELETE' }).catch(() => {})
      }

      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: invite.email, role: invite.role }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to resend invitation.')
        return
      }

      toast.success(`Invitation resent to ${invite.email}!`)
      await fetchTeam()
    } catch {
      toast.error('Failed to resend invitation.')
    } finally {
      setResendingToken(null)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="text-center">
          <Spinner size="lg" className="mx-auto mb-4" />
          <p className="text-gray-400">Loading team...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-900/40 border border-red-700 rounded-xl p-6">
          <p className="text-red-300 font-medium mb-4">{error}</p>
          <button
            onClick={() => fetchTeam(true)}
            disabled={retrying}
            className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {retrying ? <span className="flex items-center gap-2"><Spinner size="sm" />Retrying...</span> : 'Try Again'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Team Management</h1>
        <p className="text-gray-400 mt-1">{memberCount} member{memberCount !== 1 ? 's' : ''} in your account</p>
      </div>

      {memberCount >= 25 && (
        <div className="mb-6 p-4 bg-amber-900/40 border border-amber-700 rounded-xl" role="alert">
          <p className="text-amber-300 font-semibold">Team capacity warning</p>
          <p className="text-amber-400 text-sm mt-1">Your team has reached the 25-member limit. Remove a member to invite new ones.</p>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 mb-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">Team Members</h2>
        </div>
        {members.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400">No team members found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" aria-label="Team members">
              <thead className="bg-gray-800/50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Member</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Joined</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {members.map(member => (
                  <tr key={member.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-white text-sm font-medium">{member.full_name || 'No name'}</p>
                        <p className="text-gray-400 text-xs">{member.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <select
                          value={member.role}
                          onChange={e => handleRoleChange(member.id, e.target.value)}
                          disabled={updatingRole === member.id}
                          className="px-2 py-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 appearance-none pr-6"
                          aria-label={`Role for ${member.full_name || member.email}`}
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        {updatingRole === member.id && (
                          <Spinner size="sm" className="absolute right-1 top-1/2 -translate-y-1/2" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {member.created_at ? new Date(member.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setConfirmRemove(member)}
                        disabled={removingId === member.id}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
                        aria-label={`Remove ${member.full_name || member.email}`}
                      >
                        {removingId === member.id ? <Spinner size="sm" /> : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-base font-semibold text-white">Pending Invitations</h2>
          </div>
          <div className="divide-y divide-gray-800">
            {pendingInvites.map(invite => {
              const isExpiring = invite.expires_at &&
                new Date(invite.expires_at) - new Date() < 24 * 60 * 60 * 1000
              return (
                <div key={invite.id} className="px-6 py-4 flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <p className="text-white text-sm font-medium">{invite.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-gray-400 text-xs">{ROLE_LABELS[invite.role] || invite.role}</span>
                      <span className="text-gray-600 text-xs">·</span>
                      <span className="text-gray-400 text-xs">
                        Expires {invite.expires_at ? new Date(invite.expires_at).toLocaleDateString() : 'unknown'}
                      </span>
                      {isExpiring && (
                        <span className="text-xs text-amber-400 font-medium">⚠ Expiring soon</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleResendInvite(invite)}
                    disabled={resendingToken === (invite.token || invite.id)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors flex items-center gap-1"
                    aria-label={`Resend invite to ${invite.email}`}
                  >
                    {resendingToken === (invite.token || invite.id) ? (
                      <><Spinner size="sm" />Resending...</>
                    ) : 'Resend Invite'}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Invite Form */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-base font-semibold text-white mb-4">Invite Team Member</h2>

        {inviteApiError && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg" role="alert">
            <p className="text-red-300 text-sm">{inviteApiError}</p>
          </div>
        )}

        <form onSubmit={handleInvite} noValidate>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-48">
              <label htmlFor="invite-email" className="sr-only">Email address</label>
              <input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={e => { setInviteEmail(e.target.value); setInviteErrors(prev => ({ ...prev, email: undefined })) }}
                className={`w-full px-3 py-2 bg-gray-800 border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${inviteErrors.email ? 'border-red-500' : 'border-gray-700'}`}
                placeholder="colleague@company.com"
                aria-label="Invitee email address"
                aria-invalid={!!inviteErrors.email}
                aria-describedby={inviteErrors.email ? 'invite-email-error' : undefined}
                disabled={memberCount >= 25}
              />
              {inviteErrors.email && (
                <p id="invite-email-error" className="mt-1 text-red-400 text-xs" role="alert">{inviteErrors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="invite-role" className="sr-only">Role</label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value)}
                className="px-3 py-2 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={memberCount >= 25}
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isInviting || memberCount >= 25}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              aria-busy={isInviting}
            >
              {isInviting ? (
                <span className="flex items-center gap-2"><Spinner size="sm" />Sending...</span>
              ) : 'Send Invite'}
            </button>
          </div>
          {memberCount >= 25 && (
            <p className="mt-2 text-amber-400 text-xs">Remove a team member to invite new ones.</p>
          )}
        </form>
      </div>

      {/* Confirm Remove Dialog */}
      <ConfirmDialog
        open={!!confirmRemove}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${confirmRemove?.full_name || confirmRemove?.email}? They will immediately lose access to your account.`}
        confirmLabel="Remove Member"
        cancelLabel="Cancel"
        dangerous
        onConfirm={() => handleRemoveMember(confirmRemove?.id)}
        onCancel={() => setConfirmRemove(null)}
      />
    </div>
  )
}

export default function TeamSettingsPage() {
  return (
    <ErrorBoundary message="Failed to load team settings. Please refresh the page.">
      <TeamContent />
    </ErrorBoundary>
  )
}