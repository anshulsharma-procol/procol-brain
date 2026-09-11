import type { Response } from 'express'
import { bus, type BrainEvent } from '../events.js'
import type { ActivityType as StreamEventName } from '../contract.js'

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
    // `id:` lets EventSource replay what a dropped connection missed via
    // Last-Event-ID, which is the difference between a reconnect that heals
    // and one that leaves a hole in the timeline.
    const activityId = (data as { id?: string } | undefined)?.id
    response.write(
      `${activityId ? `id: ${activityId}\n` : ''}event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
    )
  }

  const unsubscribe = bus.subscribe((event) => {
    if (!filter(event)) return

    if (event.type === 'board.updated') {
      // Not in the contract: a hint that a list is stale, for a board that
      // would rather re-read than reconstruct. Ignorable.
      send('board.updated', { workspaceId: event.workspaceId })
      return
    }

    // The stored row *is* the payload. Nothing is assembled here, which is
    // why `/activities` and the stream cannot disagree.
    send(event.activity.type as StreamEventName, event.activity)
  })

  // A comment every 20s keeps intermediaries from closing an idle stream.
  const ping = setInterval(() => response.write(': ping\n\n'), 20_000)

  response.on('close', () => {
    clearInterval(ping)
    unsubscribe()
    response.end()
  })
}
