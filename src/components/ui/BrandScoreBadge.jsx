export function BrandScoreBadge({ score }) {
  if (score === null || score === undefined) {
    return <span className="text-sm text-gray-500">—</span>
  }
  const color =
    score >= 85 ? 'text-emerald-400' :
    score >= 60 ? 'text-amber-400' :
    'text-red-400'
  return (
    <span className={`text-sm font-semibold tabular-nums ${color}`}>
      {score}
    </span>
  )
}