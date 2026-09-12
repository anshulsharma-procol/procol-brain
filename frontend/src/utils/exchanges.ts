import type { ActivityEvent } from '../platform/types'

/**
 * ============================================================================
 *  ACTIVITY → TRANSCRIPT
 * ============================================================================
 *
 * The contract's activity is a discriminated union: a thought carries `text`,
 * a request carries `summary` and `taskType`, a log carries `line`. This is
 * the one file that knows those field names, and it turns them into the rows
 * the transcript renders — so a new event type is a case here rather than a
 * change in every component.
 *
 * Two things are derived rather than read, because the contract does not
 * carry them and should not:
 *
 *  - `level`, from the event type and a response's status. A failed hop is
 *    red because it failed, not because a server chose to say so.
 *  - the grouping. A hop is three rows sharing a `taskId` — request, the
 *    agent's own notes, response — and they are one moment. Rendering them
 *    as three entries is a more literal reading of the data and a worse
 *    reading of what happened.
 *
 * Fields marked additive below are ones this backend sends and the contract
 * does not define: each has a fallback, so a compliant backend that omits
 * them renders a transcript that reads correctly and is only less detailed.
 */

export type Level = 'info' | 'success' | 'warn' | 'error'

export interface Exchange {
  id: string
  at: string
  /**
   * The direction of the delegation — brain → agent — and it stays that way
   * once the answer arrives. A hop is one act with two ends; relabelling it
   * agent → brain on the response turns a round trip into two halves and
   * loses who asked.
   */
  from: string
  to?: string
  /** The mono label in the header — a hop's task type. */
  label?: string
  title: string
  body?: string | null
  level: Level
  durationMs?: number | null
  logs: { id: string; line: string }[]
  /** The A2A envelope, behind the "show payload" disclosure. */
  payload?: unknown
}

/** Additive fields this backend sends. Absent ones fall back. */
type Extra = {
  heading?: string
  detail?: string | null
  summary?: string
  via?: string
  payload?: unknown
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value ? value : undefined

/**
 * Rows that belong to another part of the screen.
 *
 * `artifact.created` is the clearest case: the artifact column already shows
 * what was produced, so a line saying it was produced is a second mention of
 * the same fact. `run.state` is the stage rail, in prose nobody asked for.
 */
const SILENT = new Set<ActivityEvent['type']>([
  'artifact.created',
  'agent.status',
  'signal.raised',
  'run.state',
])

export function toExchanges(activity: ActivityEvent[]): Exchange[] {
  const exchanges: Exchange[] = []
  const byTask = new Map<string, Exchange>()

  for (const row of activity) {
    if (SILENT.has(row.type)) continue
    const extra = row as Extra

    switch (row.type) {
      case 'ticket.created': {
        // Guarded because this row is the one that can take the page down
        // with it: a backend that names the ticket only in the envelope
        // leaves `ticket` undefined, and reading through it throws before
        // anything renders. The id on the row itself is always there.
        const raised = row.ticket ?? { id: row.ticketId, description: null }
        exchanges.push({
          id: row.id,
          at: row.at,
          from: 'customer',
          title: `${raised.id} raised${text(extra.via) ? ` via ${String(extra.via)}` : ''}`,
          body: raised.description,
          level: 'info',
          logs: [],
        })
        break
      }

      case 'run.started':
        // The thought that follows says what the run is doing, so the marker
        // itself would be a heading with nothing under it.
        break

      case 'brain.thought':
        exchanges.push({
          id: row.id,
          at: row.at,
          from: 'brain',
          // additive: the same words split where we want to bold them. `text`
          // is the whole thought, and is what a compliant backend sends.
          title: text(extra.heading) ?? row.text,
          body: text(extra.heading) ? (extra.detail ?? null) : null,
          level: 'info',
          logs: [],
        })
        break

      case 'a2a.request': {
        const exchange: Exchange = {
          id: row.id,
          at: row.at,
          from: row.from,
          to: row.to,
          label: row.summary,
          title: row.summary,
          level: 'info',
          logs: [],
          // additive: the exact envelope that went over the wire.
          payload: extra.payload,
        }
        byTask.set(row.taskId, exchange)
        exchanges.push(exchange)
        break
      }

      case 'a2a.response': {
        const failed = row.status === 'failed'
        const existing = byTask.get(row.taskId)
        const body = extra.detail ?? null

        // A response whose request we never saw still has to render; it is
        // what a mid-run refresh or a replay from Last-Event-ID looks like.
        if (!existing) {
          exchanges.push({
            id: row.id,
            at: row.at,
            from: row.from,
            to: row.to,
            title: row.summary,
            body,
            level: failed ? 'error' : 'success',
            durationMs: row.durationMs,
            logs: [],
          })
          break
        }

        existing.title = row.summary
        existing.body = body
        existing.level = failed ? 'error' : 'success'
        existing.durationMs = row.durationMs
        break
      }

      case 'agent.log': {
        const existing = row.taskId ? byTask.get(row.taskId) : undefined
        if (existing) {
          existing.logs.push({ id: row.id, line: row.line })
          break
        }

        // No hop to sit under — either the request has not arrived yet, or
        // this backend does not send the task id that groups them. The line
        // is still something an agent said, so it is shown on its own rather
        // than thrown away, which is the difference between a thin transcript
        // and a misleading one.
        exchanges.push({
          id: row.id,
          at: row.at,
          from: row.agent,
          title: row.line,
          level: 'info',
          logs: [],
        })
        break
      }

      case 'run.awaiting_approval':
        exchanges.push({
          id: row.id,
          at: row.at,
          from: 'brain',
          title: 'Waiting for human approval',
          body: row.policyReason,
          level: 'warn',
          logs: [],
        })
        break

      case 'run.completed':
        exchanges.push({
          id: row.id,
          at: row.at,
          from: 'brain',
          title:
            row.outcome === 'RESOLVED' ? 'Ticket closed' : 'Handed to a person',
          // additive: one line on how it ended.
          body: text(extra.summary) ?? null,
          level: row.outcome === 'RESOLVED' ? 'success' : 'warn',
          logs: [],
        })
        break
    }
  }

  return exchanges
}
