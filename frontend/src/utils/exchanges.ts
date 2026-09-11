import type { ActivityEvent } from '../platform/types'

/**
 * One exchange on the audit trail.
 *
 * The contract models an A2A hop as three kinds of row sharing a `taskId` —
 * the request, the agent's own `agent.log` notes, and the response. They
 * belong to one moment, so they render as one entry rather than three.
 */
export interface Exchange {
  /** The row that anchors the entry — a request, or a standalone row. */
  head: ActivityEvent
  response?: ActivityEvent
  logs: ActivityEvent[]
}

/**
 * Groups a flat activity list into exchanges.
 *
 * Rows that share a `taskId` are one hop. Everything else stands alone. The
 * list is already in `seq` order and stays that way — a request's position is
 * where the exchange belongs, even though its response arrived later.
 */
/**
 * Rows that belong to another part of the screen.
 *
 * `artifact.created` is the contract's own example: the artifact column
 * already shows what was produced, so a line saying it was produced is a
 * second mention of the same fact. `agent.status` is registry chatter.
 */
const SILENT = new Set(['artifact.created', 'agent.status', 'signal.raised'])

export function toExchanges(activity: ActivityEvent[]): Exchange[] {
  const exchanges: Exchange[] = []
  const byTask = new Map<string, Exchange>()

  for (const row of activity) {
    if (!row.taskId) {
      if (SILENT.has(row.type)) continue

      // A machine state change is already on the stage rail; repeating it in
      // prose is noise. A person's decision is not — that entry is the point
      // of the record, and it renders in the same language as the agents'.
      if (row.type === 'run.state' && row.fromAgent !== 'human') continue

      exchanges.push({ head: row, logs: [] })
      continue
    }

    const existing = byTask.get(row.taskId)

    if (!existing) {
      const exchange: Exchange = { head: row, logs: [] }
      byTask.set(row.taskId, exchange)
      exchanges.push(exchange)
      continue
    }

    if (row.type === 'agent.log') existing.logs.push(row)
    else if (row.type === 'a2a.response') existing.response = row
  }

  return exchanges
}
