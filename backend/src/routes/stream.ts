import type { Response } from 'express'
import { bus, type BrainEvent } from '../events.js'
import type { StreamEventName } from '../contract.js'

/**
 * ============================================================================
 *  SSE — docs/API_CONTRACT.md §4
 * ============================================================================
 *
 * The event name travels on the `event:` line; the payload on `data:`.
 *
 * Every payload carries `activityId` and `seq`, and that is the whole point:
 * a client fetches `/activities`, opens the stream, and drops any event whose
 * `activityId` it already holds. Without those two fields the entry at the
 * history/stream boundary renders twice, which is the commonest bug in this
 * kind of UI and the hardest to notice in a demo.
 */
/**
 * Payload fields the contract names that fall straight out of the stored row,
 * so the orchestrator does not have to repeat them at every call site.
 */
function derived(event: Extract<BrainEvent, { type: 'activity' }>): Record<string, unknown> {
  const { activity } = event

  switch (activity.type) {
    case 'brain.thought':
      return { text: [activity.title, activity.body].filter(Boolean).join(' — ') }
    case 'agent.log':
      return { agent: activity.fromAgent, line: activity.title }
    default:
      return {}
  }
}

export function openStream(response: Response, filter: (event: BrainEvent) => boolean): void {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Proxies buffer text/event-stream by default, which turns a live run
    // into one burst at the end.
    'X-Accel-Buffering': 'no',
  })
  response.flushHeaders()
  response.write(': connected\n\n')

  const send = (event: StreamEventName | 'board.updated', data: unknown) => {
    response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  const unsubscribe = bus.subscribe((event) => {
    if (!filter(event)) return

    if (event.type === 'board.updated') {
      // Not in the contract: a hint that a list is stale, for a board that
      // would rather re-read than reconstruct. Ignorable.
      send('board.updated', { workspaceId: event.workspaceId })
      return
    }

    const { activity, wire } = event
    send(activity.type, {
      ticketId: activity.ticketId,
      seq: activity.seq,
      activityId: activity.id,
      ...derived(event),
      ...wire,
    })
  })

  // A comment every 20s keeps intermediaries from closing an idle stream.
  const ping = setInterval(() => response.write(': ping\n\n'), 20_000)

  response.on('close', () => {
    clearInterval(ping)
    unsubscribe()
    response.end()
  })
}
