import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { agentVisual, useWorkspace } from '../platform/react'
import type { Exchange } from '../utils/exchanges'
import { durationLabel, timeOf } from '../utils/format'
import { colorClasses } from './colorClasses'

/**
 * One exchange on the audit trail.
 *
 * The contract models an A2A hop as three kinds of row sharing a `taskId` —
 * the request, the agent's own `agent.log` notes, and the response. They
 * belong to one moment, so they render as one entry: the request's task type
 * in the header, the response's prose as the body, its measured latency on
 * the right, and the notes as indented sub-lines.
 *
 * Rendering them as three separate entries would be a more literal reading of
 * the data and a worse reading of what happened.
 */
export default function TranscriptEntry({ exchange }: { exchange: Exchange }) {
  const { workspace } = useWorkspace()
  const [showPayload, setShowPayload] = useState(false)

  const { head, response, logs } = exchange
  const speaker = response ?? head
  const from = agentVisual(workspace, speaker.fromAgent ?? undefined)
  const to = head.toAgent ? agentVisual(workspace, head.toAgent) : undefined
  const color = colorClasses[from.color]

  const level = response?.level ?? head.level
  const body = response?.body ?? (head.type === 'a2a.request' ? null : head.body)
  const title = response?.title ?? head.title
  const durationMs = response?.durationMs ?? head.durationMs
  // Only a request carries its envelope; a thought has nothing to disclose.
  const payload = head.type === 'a2a.request' ? head.body : null

  return (
    <li className="transcript-entry relative flex gap-3 pb-5 last:pb-0">
      <span className={`absolute left-0 top-1 h-[calc(100%-0.5rem)] w-[3px] rounded-full ${color.rule}`} />

      <div className="min-w-0 flex-1 pl-4">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-gray-400">
          <span>{timeOf(head.createdAt)}</span>
          <span className="text-gray-600">
            {from.name}
            {to && <span className="text-gray-400"> → {to.name}</span>}
          </span>
          {head.taskId && <span className={`font-medium ${color.text}`}>{head.title}</span>}
          {durationMs !== null && durationMs !== undefined && (
            <span className="text-gray-400">{durationLabel(durationMs)}</span>
          )}
        </p>

        <p
          className={`mt-1 text-sm font-medium ${
            level === 'warn'
              ? 'text-amber-700'
              : level === 'error'
                ? 'text-red-600'
                : 'text-gray-900'
          }`}
        >
          {head.taskId ? title : head.title}
        </p>

        {body && <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-gray-600">{body}</p>}

        {logs.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {logs.map((log) => (
              <li key={log.id} className="pl-3 text-xs text-gray-400">
                <span className="mr-1.5 text-gray-300">›</span>
                {log.title}
              </li>
            ))}
          </ul>
        )}

        {payload && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowPayload((open) => !open)}
              aria-expanded={showPayload}
              className="flex items-center gap-1 rounded text-xs text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <ChevronRight
                className={`h-3 w-3 transition-transform ${showPayload ? 'rotate-90' : ''}`}
              />
              {showPayload ? 'hide payload' : 'show payload'}
            </button>

            {showPayload && (
              <pre className="mt-2 max-w-full overflow-x-auto rounded-lg bg-gray-900 p-3 font-mono text-[11px] leading-relaxed text-gray-100">
                {pretty(payload)}
              </pre>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

/**
 * The contract keeps `body` a string precisely so the frontend never parses a
 * response field. This is the one place it is treated as JSON, and only to
 * indent it for display — if it is not JSON, it is shown as written.
 */
function pretty(body: string): string {
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}
