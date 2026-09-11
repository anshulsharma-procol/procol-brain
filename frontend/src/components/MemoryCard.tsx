import { Link } from 'react-router-dom'
import type { MemoryEntry, MemoryMatch } from '../platform/types'

/**
 * A previously resolved run, recalled against the ticket on screen.
 *
 * This is the part of the product that gets more valuable every month. The
 * first GST ticket cost three hours of five people's time; this card is what
 * makes the second one cost minutes, whoever picks it up.
 */
export function MemoryMatchCard({ match }: { match: MemoryMatch }) {
  const { entry, confidence, reason } = match

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-gray-900">{entry.title}</p>
        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] text-amber-800">
          {Math.round(confidence * 100)}%
        </span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-gray-600">{entry.resolution}</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 font-mono text-[10px] text-gray-400">
        <Link to={`/tickets/${entry.sourceTicketRef}`} className="text-blue-600 hover:underline">
          {entry.sourceTicketRef}
        </Link>
        <span>{reason.toLowerCase()}</span>
        {entry.reuseCount > 0 && <span>reused {entry.reuseCount}×</span>}
      </p>
    </div>
  )
}

/** A memory entry in the library view. */
export function MemoryRow({ entry }: { entry: MemoryEntry }) {
  return (
    <div className="border-b border-gray-100 py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{entry.title}</p>
          <p className="mt-0.5 text-sm text-gray-500">{entry.symptom}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold text-gray-900">{entry.reuseCount}×</p>
          <p className="text-xs text-gray-400">reused</p>
        </div>
      </div>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-gray-400">Root cause</dt>
          <dd className="mt-0.5 text-sm text-gray-700">{entry.rootCause}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400">Resolution</dt>
          <dd className="mt-0.5 text-sm text-gray-700">{entry.resolution}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] text-gray-400">
        <Link to={`/tickets/${entry.sourceTicketRef}`} className="text-blue-600 hover:underline">
          {entry.sourceTicketRef}
        </Link>
        <span>·</span>
        <span>{entry.path.toLowerCase().replace('_', ' ')}</span>
        <span>·</span>
        <span>learned {entry.learnedAt}</span>
        <span>·</span>
        <span>{Math.round((entry.reuseCount * entry.minutesSavedPerReuse) / 60)}h saved</span>
      </div>
    </div>
  )
}
