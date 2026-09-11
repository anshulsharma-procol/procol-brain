import { EventEmitter } from 'node:events'

/**
 * The event bus. Everything that changes state emits here, and the SSE hub is
 * just a subscriber — which is why the console and the customer's chat widget
 * cannot drift apart: they are watching the same events, not two code paths.
 */
export type BrainEvent =
  | { type: 'ticket.updated'; ticketRef: string; workspaceId: string }
  | { type: 'board.updated'; workspaceId: string }

class Bus {
  private emitter = new EventEmitter()

  constructor() {
    // A demo with four services and one user will never need more, but an
    // unbounded listener warning mid-run is noise nobody needs on stage.
    this.emitter.setMaxListeners(200)
  }

  emit(event: BrainEvent): void {
    this.emitter.emit('event', event)
  }

  subscribe(listener: (event: BrainEvent) => void): () => void {
    this.emitter.on('event', listener)
    return () => this.emitter.off('event', listener)
  }
}

export const bus = new Bus()
