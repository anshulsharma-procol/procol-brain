import type {
  ActivityBase,
  ActivityDto,
  ActivityOf,
  ActivityType,
  AgentId,
  AgentStatus,
  ArtifactDto,
  ResolutionPath,
  RunState,
  SignalDto,
  TaskType,
  TicketDto,
} from '../contract.js'
import { bus } from '../events.js'
import { cuid } from '../ids.js'
import { store } from '../store.js'

/**
 * ============================================================================
 *  THE TIMELINE
 * ============================================================================
 *
 * Every activity row is written through one of these functions, and they are
 * typed against the contract's own union: `thought()` takes exactly what a
 * `brain.thought` carries, `response()` exactly what an `a2a.response`
 * carries. Getting a field name wrong is a compile error rather than a
 * payload a client silently fails to render.
 *
 * A few fields here are additive, and each one is marked. The rule they all
 * follow: the contract field must stand on its own. A client that knows only
 * the contract renders `text` and gets the whole thought — the extra fields
 * let our console split it into a heading and a detail, and nothing more.
 */

/** Everything a row carries beyond the five envelope fields. */
type Body<T extends ActivityType> = Omit<ActivityOf<T>, keyof ActivityBase>

function emit<T extends ActivityType>(
  reference: string,
  type: T,
  body: Body<T> & Record<string, unknown>,
): ActivityDto | undefined {
  return store.appendActivity(reference, type, body) as ActivityDto | undefined
}

export function ticketCreated(reference: string, ticket: TicketDto, via: string): void {
  emit(reference, 'ticket.created', {
    ticket,
    // additive: the channel in words, for a timeline that reads as prose.
    via,
  })
}

export function runStarted(reference: string, runId: string): void {
  emit(reference, 'run.started', { runId })
}

/**
 * The Brain's reasoning.
 *
 * `text` is the whole thought because that is the only field the contract
 * defines; `heading` and `detail` are the same words split where our console
 * wants to bold them.
 */
export function thought(reference: string, heading: string, detail?: string | null): void {
  emit(reference, 'brain.thought', {
    text: [heading, detail].filter(Boolean).join('\n\n'),
    heading,
    detail: detail ?? null,
  })
}

export function request(
  reference: string,
  input: {
    taskId: string
    to: AgentId
    taskType: TaskType
    summary: string
    /** additive: the A2A envelope, behind the "show payload" disclosure. */
    payload: unknown
  },
): void {
  emit(reference, 'a2a.request', {
    taskId: input.taskId,
    from: 'brain',
    to: input.to,
    taskType: input.taskType,
    summary: input.summary,
    payload: input.payload,
  })
}

export function response(
  reference: string,
  input: {
    taskId: string
    from: AgentId
    status: 'completed' | 'failed'
    summary: string
    durationMs: number | null
    /** additive: the agent's longer prose, under the summary line. */
    detail?: string | null
  },
): void {
  emit(reference, 'a2a.response', {
    taskId: input.taskId,
    from: input.from,
    to: 'brain',
    status: input.status,
    summary: input.summary,
    durationMs: input.durationMs,
    detail: input.detail ?? null,
  })
}

export function log(reference: string, taskId: string, agent: AgentId, line: string): void {
  emit(reference, 'agent.log', { taskId, agent, line })
}

export function artifactCreated(reference: string, artifact: ArtifactDto): void {
  emit(reference, 'artifact.created', { artifact })
}

export function runState(
  reference: string,
  input: {
    runId: string
    state: RunState
    path: ResolutionPath | null
    attempt: number
    /** additive: what the Brain is doing, for the board's status line. */
    action: string
  },
): void {
  emit(reference, 'run.state', input)
}

export function awaitingApproval(
  reference: string,
  input: { runId: string; policyId: string; policyReason: string },
): void {
  emit(reference, 'run.awaiting_approval', input)
}

export function runCompleted(
  reference: string,
  input: {
    runId: string
    outcome: string
    /** additive: one line on how it ended. */
    summary?: string | null
  },
): void {
  emit(reference, 'run.completed', {
    runId: input.runId,
    outcome: input.outcome,
    summary: input.summary ?? null,
  })
}

export function signalRaised(reference: string, signal: SignalDto): void {
  emit(reference, 'signal.raised', { signal })
}

/**
 * An agent came up or went down.
 *
 * Not ticket-scoped, so it is not written to any ticket's trail — it goes
 * straight to the bus with `seq: -1`, which is the contract's marker for "do
 * not put this in a timeline". A console uses it to repaint a status dot.
 */
export function agentStatus(agentId: AgentId, status: AgentStatus): void {
  const activity: ActivityOf<'agent.status'> & Record<string, unknown> = {
    id: cuid('act'),
    seq: -1,
    type: 'agent.status',
    ticketId: '',
    at: new Date().toISOString(),
    agentId,
    status,
  }

  bus.emit({ type: 'activity', ticketRef: '', workspaceId: null, activity })
}
