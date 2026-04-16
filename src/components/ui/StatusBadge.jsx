export function StatusBadge({ status }) {
  const styles = {
    draft: 'bg-gray-800 text-gray-300 border-gray-700',
    pending: 'bg-amber-950 text-amber-300 border-amber-800',
    approved: 'bg-emerald-950 text-emerald-300 border-emerald-800',
    rejected: 'bg-red-950 text-red-300 border-red-800',
  }
  const labels = {
    draft: 'Draft',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  }
  if (!status) return null
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.draft}`}>
      {labels[status] || status}
    </span>
  )
}