const CHANNEL_COLORS = {
  email: 'bg-blue-950 text-blue-300 border-blue-800',
  social: 'bg-purple-950 text-purple-300 border-purple-800',
  ads: 'bg-orange-950 text-orange-300 border-orange-800',
}

export function ChannelChips({ channels }) {
  if (!channels || channels.length === 0) return <span className="text-gray-500 text-sm">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {channels.map(ch => (
        <span
          key={ch}
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize ${CHANNEL_COLORS[ch] || 'bg-gray-800 text-gray-300 border-gray-700'}`}
        >
          {ch}
        </span>
      ))}
    </div>
  )
}