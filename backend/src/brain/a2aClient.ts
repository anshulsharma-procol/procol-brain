import { randomUUID } from 'node:crypto'
import { env } from '../env.js'
import { store } from '../store.js'
import type { A2AResponse, A2ATask, A2ATaskType } from '../domain/types.js'

/**
 * The A2A client. Brain never imports agent code — it knows a base URL from
 * the registry and speaks JSON over HTTP, which is what makes it honest to
 * say the agents could be anyone's, running anywhere.
 *
 * Every call is timed and recorded, so `GET /api/tasks/:id` can show the exact
 * envelope that went out and the exact one that came back.
 */
export interface SendTaskOptions {
  baseUrl: string
  ticketRef: string
  task: A2ATask
  /**
   * How fast the caller wants this run played out. Sent as a header rather
   * than in the envelope, because how quickly a demo runs is a property of
   * the transport, not of the work being asked for — the protocol stays
   * clean, and an agent that ignores it still behaves correctly.
   */
  speed?: number
}

/**
 * Builds the envelope without sending it, so the caller can put the exact
 * payload on the timeline before the hop leaves — rather than backfilling a
 * row that has already been emitted.
 */
export function createTask(input: {
  from: string
  to: string
  type: A2ATaskType
  context: Record<string, unknown>
}): A2ATask {
  return { taskId: `TASK-${randomUUID().slice(0, 8)}`, ...input }
}

export interface SendTaskResult {
  task: A2ATask
  response?: A2AResponse
  /** Measured, not scripted: how long the hop actually took. */
  durationMs: number
  error?: string
}

export async function sendTask(options: SendTaskOptions): Promise<SendTaskResult> {
  const { task } = options
  const startedAt = new Date()
  store.putTask({ task, ticketId: options.ticketRef, startedAt: startedAt.toISOString() })

  const started = performance.now()

  try {
    const response = await fetch(`${options.baseUrl}/a2a/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.speed === undefined ? {} : { 'X-Brain-Run-Speed': String(options.speed) }),
      },
      body: JSON.stringify(task),
      // A hang is worse than a failure, because a failure renders.
      signal: AbortSignal.timeout(env.A2A_TIMEOUT_MS),
    })

    const durationMs = Math.round(performance.now() - started)

    if (!response.ok) {
      const error = `${task.to} answered ${response.status}`
      store.putTask({
        task,
        ticketId: options.ticketRef,
        startedAt: startedAt.toISOString(),
        endedAt: new Date().toISOString(),
        response: { taskId: task.taskId, status: 'failed', agent: task.to, error },
      })
      return { task, durationMs, error }
    }

    const body = (await response.json()) as A2AResponse
    store.putTask({
      task,
      ticketId: options.ticketRef,
      startedAt: startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      response: body,
    })

    return { task, response: body, durationMs }
  } catch (cause) {
    const durationMs = Math.round(performance.now() - started)
    const error =
      cause instanceof Error && cause.name === 'TimeoutError'
        ? `${task.to} did not answer within ${env.A2A_TIMEOUT_MS / 1000}s`
        : `${task.to} is unreachable`

    store.putTask({
      task,
      ticketId: options.ticketRef,
      startedAt: startedAt.toISOString(),
      endedAt: new Date().toISOString(),
      response: { taskId: task.taskId, status: 'failed', agent: task.to, error },
    })

    return { task, durationMs, error }
  }
}
