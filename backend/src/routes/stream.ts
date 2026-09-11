import type { Response } from 'express'
import { bus, type BrainEvent } from '../events.js'
import { store } from '../store.js'

/**
 * Server-Sent Events.
 *
 * Fifteen lines, survives proxies, reconnects for free, and both surfaces can
 * watch the same run without either polling. Each `ticket.updated` carries the
 * whole detail, so a consumer never has to re-fetch to stay consistent — which
 * is also why a browser refresh mid-run rebuilds an identical timeline.
 */
export function openStream(
  response: Response,
  filter: (event: BrainEvent) => boolean,
): void {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Nginx and friends buffer text/event-stream by default, which turns a
    // live run into one burst at the end.
    'X-Accel-Buffering': 'no',
  })
  response.flushHeaders()
  response.write(': connected\n\n')

  const send = (event: string, data: unknown) => {
    response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  const unsubscribe = bus.subscribe((event) => {
    if (!filter(event)) return

    if (event.type === 'ticket.updated') {
      const detail = store.getDetail(event.ticketRef)
      if (detail) send('ticket.updated', detail)
      return
    }

    send('board.updated', { workspaceId: event.workspaceId })
  })

  // A comment every 20s keeps intermediaries from closing an idle stream.
  const ping = setInterval(() => response.write(': ping\n\n'), 20_000)

  response.on('close', () => {
    clearInterval(ping)
    unsubscribe()
    response.end()
  })
}
