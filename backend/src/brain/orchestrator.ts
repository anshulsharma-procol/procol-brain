import { env } from '../env.js'
import { buildStages, store } from '../store.js'
import { getPlaybook, PATH_ARTIFACTS, type Playbook } from '../domain/playbooks.js'
import type {
  A2ATaskType,
  ActivityEvent,
  ArtifactKind,
  Decision,
  MemoryEntry,
  Stage,
  StageId,
  Ticket,
  TicketChannel,
  TicketPriority,
} from '../domain/types.js'
import { getWorkspace } from '../domain/workspaces.js'
import { createTask, sendTask } from './a2aClient.js'
import { classify } from './classify.js'
import { policyFor } from './policy.js'
import { resolve } from './registry.js'

/**
 * ============================================================================
 *  THE ORCHESTRATOR
 * ============================================================================
 *
 * A plain async state machine. It classifies, asks the registry who can help,
 * delegates over real HTTP, collects artifacts, stops at the human gate, and
 * writes every single transition to the audit trail.
 *
 * Rules that are not negotiable, because the demo rests on them:
 *
 *  - every transition writes an Activity row and therefore emits an event
 *  - nothing reaches RESOLVED without a human POST, except a pure answer
 *  - a second investigate on an active run joins it rather than forking it
 *  - an agent that is missing, slow or broken produces a calm timeline entry,
 *    never a stack trace and never a stuck ticket
 */

export interface CreateTicketInput {
  workspaceId?: string
  /** Only the seeder sets this, so the canonical demo tickets keep their ids. */
  reference?: string
  /** The customer's own words. Drives classification. */
  message: string
  title?: string
  description?: string
  customer?: string
  reportedBy?: string
  priority?: TicketPriority
  channel?: TicketChannel
  origin?: Ticket['origin']
}

export interface RunOptions {
  /** 0 plays the run out instantly — used to seed the board at boot. */
  speed?: number
}

/** Tickets currently being walked, so a double click cannot fork a run. */
const active = new Map<string, Promise<void>>()

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

/**
 * Creates a ticket from a message. This is the single entry point for both
 * surfaces: the customer's chat widget and the console's "raise a ticket" both
 * land here, so a ticket raised from a client dashboard is indistinguishable
 * from one raised internally — same record, same board, same timeline.
 */
export function createTicket(input: CreateTicketInput): Ticket {
  const { workspace, playbook, recognised, matched, confidence } = classify({
    message: input.message,
    workspaceId: input.workspaceId,
  })

  const reference = input.reference ?? store.nextReference(workspace.id)
  const now = new Date().toISOString()

  const ticket: Ticket = {
    id: reference,
    reference,
    workspaceId: workspace.id,
    title: input.title ?? playbook.ticket.title,
    description: input.description ?? playbook.ticket.description,
    customer: input.customer ?? playbook.ticket.defaultCustomer,
    reportedBy: input.reportedBy ?? playbook.ticket.reportedBy,
    channel: input.channel ?? playbook.ticket.channel ?? 'chat',
    priority: input.priority ?? playbook.ticket.priority,
    status: 'NEW',
    category: playbook.ticket.category,
    impact: playbook.ticket.impact,
    issueQuote: [input.message],
    createdAt: now,
    updatedAt: now,
    progress: 0,
    stages: buildStages(stagesFor(playbook)),
    origin: input.origin,
  }

  store.putTicket(ticket)
  store.setRun(reference, { playbookId: playbook.id, active: false })

  store.appendActivity(reference, {
    type: 'ticket.created',
    fromAgent: 'customer',
    title: `${reference} raised via ${channelLabel(ticket.channel)}`,
    body: [input.message],
    level: 'info',
  })

  store.appendActivity(reference, {
    type: 'brain.thought',
    fromAgent: 'brain',
    title: recognised
      ? `Recognised as “${playbook.ticket.title}”`
      : 'I do not recognise this symptom',
    body: recognised
      ? [
          `Matched on ${matched.slice(0, 4).join(', ')} with ${Math.round(confidence * 100)}% confidence. I will confirm it against product context before acting on it.`,
        ]
      : [
          'Nothing in this control tower matches these symptoms, so I am working from the customer’s description alone and will say plainly what I am unsure about.',
        ],
    level: recognised ? 'info' : 'warn',
  })

  return ticket
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------

/**
 * Starts the run and returns immediately. The surfaces follow over SSE — a
 * frontend blocked on a 40-second request is how demos die.
 */
export function startRun(
  reference: string,
  options: RunOptions = {},
): { runId: string; joined: boolean } | { error: string } {
  const existing = active.get(reference)
  // Idempotent: a second click joins the run in flight rather than forking it.
  if (existing) return { runId: `run-${reference}`, joined: true }

  const ticket = store.getTicket(reference)
  if (!ticket) return { error: `Ticket ${reference} not found` }

  // A ticket that has already reached the gate or been closed is not
  // re-investigated on a whim: that would append a second run to the same
  // audit trail and leave two contradictory timelines on one record.
  if (ticket.status !== 'NEW' && ticket.status !== 'NEEDS_HUMAN') {
    return { error: `Ticket ${reference} is ${ticket.status}; a run cannot be started from there` }
  }

  const promise = walk(reference, options).finally(() => {
    active.delete(reference)
    const run = store.getRun(reference)
    if (run) store.setRun(reference, { ...run, active: false })
  })

  active.set(reference, promise)

  // Unhandled rejections must not take the process down mid-demo.
  promise.catch((error: unknown) => {
    console.error(`[run ${reference}]`, error)
  })

  return { runId: `run-${reference}`, joined: false }
}

/** Awaits the run — used by seeding and by tests, never by a route. */
export async function runToCompletion(reference: string, options: RunOptions = {}): Promise<void> {
  const started = startRun(reference, options)
  if ('error' in started) throw new Error(started.error)
  await active.get(reference)
}

async function walk(reference: string, options: RunOptions): Promise<void> {
  const ticket = store.getTicket(reference)
  const run = store.getRun(reference)
  if (!ticket || !run) return

  const speed = options.speed ?? env.RUN_SPEED
  const playbook = getPlaybook(run.playbookId)
  const workspace = getWorkspace(ticket.workspaceId)
  const pause = (ms: number) => (speed === 0 ? Promise.resolve() : delay(ms / speed))

  store.setRun(reference, { ...run, active: true })
  patch(reference, { status: 'INVESTIGATING', currentAgentId: 'brain', currentAgentAction: 'Classifying' })

  say(reference, {
    type: 'run.started',
    fromAgent: 'brain',
    title: 'Investigation started',
    body: playbook.narration.received,
    level: 'info',
  })
  await pause(600)

  // -- context ------------------------------------------------------------
  say(reference, {
    type: 'brain.thought',
    fromAgent: 'brain',
    title: 'Looking for an agent that can answer product questions',
    body: playbook.narration.routing,
    level: 'info',
  })
  await pause(400)

  const knowledge = resolve(workspace, 'product_knowledge')
  if (!knowledge) {
    return stall(reference, 'No agent in this control tower declares product_knowledge.')
  }

  patch(reference, { currentAgentId: knowledge.agent.id, currentAgentAction: 'Fetching product context' })

  const contextHop = await hop(reference, {
    baseUrl: knowledge.baseUrl,
    to: knowledge.agent.id,
    type: 'GET_PRODUCT_CONTEXT',
    requestTitle: questionFor(playbook),
    speed,
    context: {
      ticketId: reference,
      customer: ticket.customer,
      issue: ticket.title,
      message: ticket.issueQuote[0],
      playbookId: playbook.id,
    },
  })

  if (!contextHop.ok) return stall(reference, contextHop.error)
  completeStage(reference, 'context', knowledge.agent.id)

  const isProductDefect = Boolean(contextHop.result?.isProductDefect)
  const isQuestion = Boolean(contextHop.result?.isQuestion)
  await pause(500)

  // The knowledge agent can say "I have nothing on this". Brain stops there
  // rather than picking a branch on no evidence.
  if (contextHop.result?.needsHuman) {
    return stall(reference, 'Nothing on file in this workspace covers this symptom.', {
      title: 'Nothing on file — handing this to a person',
      body: playbook.narration.decision,
    })
  }

  // -- decide -------------------------------------------------------------
  const path = isQuestion ? 'ANSWER_ONLY' : isProductDefect ? 'CODE_FIX' : 'CONFIG_FIX'

  say(reference, {
    type: 'brain.thought',
    fromAgent: 'brain',
    title: decisionTitle(path),
    body: playbook.narration.decision,
    level: 'info',
  })
  patch(reference, { path, currentAgentId: 'brain', currentAgentAction: 'Deciding' })
  await pause(500)

  const produced: ArtifactKind[] = []

  // -- the branch ---------------------------------------------------------
  if (path === 'CODE_FIX') {
    const engineering = resolve(workspace, 'create_pr')
    if (!engineering) return stall(reference, 'No agent in this control tower declares create_pr.')

    patch(reference, { currentAgentId: engineering.agent.id, currentAgentAction: 'Investigating the code' })

    const devHop = await hop(reference, {
      baseUrl: engineering.baseUrl,
      to: engineering.agent.id,
      type: 'INVESTIGATE_BUG',
      requestTitle: 'Trace the defect and open a pull request',
      speed,
      context: {
        ticketId: reference,
        issue: ticket.title,
        productContext: contextHop.result,
        playbookId: playbook.id,
      },
    })

    if (!devHop.ok) return stall(reference, devHop.error)
    produced.push(...store.getArtifacts(reference).map((artifact) => artifact.kind))
    completeStage(reference, 'investigate', engineering.agent.id)
    await pause(500)

    const validation = resolve(workspace, 'run_tests')
    if (!validation) return stall(reference, 'No agent in this control tower declares run_tests.')

    patch(reference, { currentAgentId: validation.agent.id, currentAgentAction: 'Running the suite' })

    const qaHop = await hop(reference, {
      baseUrl: validation.baseUrl,
      to: validation.agent.id,
      type: 'VALIDATE_FIX',
      requestTitle: 'Validate the fix against the regression suite',
      speed,
      context: { ticketId: reference, playbookId: playbook.id },
    })

    if (!qaHop.ok) return stall(reference, qaHop.error)
    completeStage(reference, 'verify', validation.agent.id)
    await pause(400)

    // Blast radius. The analytics copilot runs inside Brain and reads through
    // the connector layer, so there is no A2A hop to make here.
    if (playbook.impact) {
      const lens = workspace.agents.find((agent) => agent.role === 'analytics')
      say(reference, {
        type: 'a2a.response',
        fromAgent: lens?.id ?? 'brain',
        toAgent: 'brain',
        taskType: 'IMPACT_ANALYSIS',
        title: playbook.impact.summary,
        body: playbook.impact.detail,
        logs: playbook.impact.logs,
        durationMs: playbook.impact.durationMs,
        level: 'warn',
      })
      artifact(reference, {
        kind: 'IMPACT',
        title: 'Blast radius',
        createdBy: lens?.id ?? 'brain',
        data: {
          affectedTenants: playbook.impact.affectedTenants,
          affectedRecords: playbook.impact.affectedRecords,
          recordLabel: playbook.impact.recordLabel,
          firstSeen: playbook.impact.firstSeen,
          trend: playbook.impact.trend,
        },
      })
      await pause(400)
    }
  }

  if (path === 'CONFIG_FIX' && playbook.configFix) {
    artifact(reference, {
      kind: 'CONFIG_FIX',
      title: 'Configuration remediation',
      createdBy: 'brain',
      data: {
        summary: playbook.configFix.summary,
        change: playbook.configFix.change,
        steps: playbook.configFix.steps,
      },
    })
    await pause(400)
  }

  if (path === 'ANSWER_ONLY' && playbook.answer) {
    say(reference, {
      type: 'brain.thought',
      fromAgent: 'brain',
      title: playbook.answer.summary,
      body: playbook.answer.detail,
      level: 'success',
    })
    await pause(300)
  }

  // -- the customer reply, drafted before anyone is asked to approve -------
  artifact(reference, {
    kind: 'CUSTOMER_REPLY',
    title: 'Customer reply',
    createdBy: 'brain',
    data: {
      subject: `${playbook.reply.subject} — ${reference}`,
      body: [`Hi ${ticket.customer},`, ...playbook.reply.body],
      signature: `${workspace.name} Support`,
      sent: false,
    },
  })

  const kinds = store.getArtifacts(reference).map((row) => row.kind)
  const policy = policyFor(workspace, path, kinds, ticket)
  store.setRun(reference, {
    playbookId: playbook.id,
    active: true,
    approvalPolicyId: policy?.id,
  })

  // -- the gate ------------------------------------------------------------
  if (!policy) {
    // A pure answer changes nothing, so it closes itself and says why.
    say(reference, {
      type: 'run.completed',
      fromAgent: 'brain',
      title: 'Answered and closed without an approval gate',
      body: [
        'Nothing was changed in the product or the tenant’s configuration, so there is nothing for a person to approve. The answer has gone to the customer.',
      ],
      level: 'success',
    })
    finish(reference, { outcome: 'APPROVED', by: 'Brain (no change required)', at: new Date().toISOString() }, playbook, { silentDecision: true })
    return
  }

  activateStage(reference, 'approve')
  patch(reference, {
    status: 'AWAITING_APPROVAL',
    currentAgentId: 'human-approver',
    currentAgentAction: 'Waiting for your approval',
    progress: progressOf(reference),
  })

  say(reference, {
    type: 'run.awaiting_approval',
    fromAgent: 'brain',
    title: 'Stopping for human approval',
    body: playbook.narration.gate.length ? playbook.narration.gate : [policy.reason],
    level: 'warn',
    payload: { policy },
  })
}

// ---------------------------------------------------------------------------
// The human gate
// ---------------------------------------------------------------------------

export function decide(
  reference: string,
  input: { outcome: 'APPROVED' | 'REJECTED'; by: string; note?: string },
): { ok: true } | { ok: false; error: string } {
  const ticket = store.getTicket(reference)
  if (!ticket) return { ok: false, error: `Ticket ${reference} not found` }
  if (ticket.status !== 'AWAITING_APPROVAL') {
    return { ok: false, error: `Ticket ${reference} is ${ticket.status}, not awaiting approval` }
  }

  const run = store.getRun(reference)
  const playbook = getPlaybook(run?.playbookId ?? '')
  const decision: Decision = { ...input, at: new Date().toISOString() }

  store.setDecision(reference, decision)

  say(reference, {
    type: 'human.decision',
    fromAgent: 'human',
    title:
      input.outcome === 'APPROVED'
        ? `${input.by} approved the fix`
        : `${input.by} sent this back for a human`,
    body: input.note ? [input.note] : undefined,
    level: input.outcome === 'APPROVED' ? 'success' : 'warn',
  })

  if (input.outcome === 'REJECTED') {
    patch(reference, {
      status: 'NEEDS_HUMAN',
      currentAgentId: undefined,
      currentAgentAction: 'Waiting on a person',
    })
    return { ok: true }
  }

  finish(reference, decision, playbook)
  return { ok: true }
}

/** Notify the customer, close the ticket, and keep what the run learned. */
function finish(
  reference: string,
  decision: Decision,
  playbook: Playbook,
  options: { silentDecision?: boolean } = {},
): void {
  const ticket = store.getTicket(reference)
  if (!ticket) return

  if (!options.silentDecision) store.setDecision(reference, decision)

  const reply = store.getArtifacts(reference).find((row) => row.kind === 'CUSTOMER_REPLY')
  if (reply) {
    store.addArtifact(reference, {
      kind: 'CUSTOMER_REPLY',
      title: reply.title,
      createdBy: reply.createdBy,
      data: { ...reply.data, sent: true },
    })

    say(reference, {
      type: 'customer.notified',
      fromAgent: 'brain',
      title: `Customer notified — ${String(reply.data.subject)}`,
      body: ['The reply drafted at the gate has been sent to the contact on this ticket.'],
      level: 'success',
    })
  }

  const memory = rememberRun(reference, playbook)

  say(reference, {
    type: 'run.completed',
    fromAgent: 'brain',
    title: 'Ticket closed, and what we learned is kept',
    body: [
      memory
        ? `Written to institutional memory as “${memory.title}”. The next ticket with this symptom starts from the answer instead of the beginning.`
        : 'Run archived on the audit trail.',
    ],
    level: 'success',
  })

  completeStage(reference, 'approve', 'human-approver')
  patch(reference, {
    status: 'RESOLVED',
    currentAgentId: undefined,
    currentAgentAction: 'Closed',
    progress: 100,
  })
}

function rememberRun(reference: string, playbook: Playbook): MemoryEntry | undefined {
  const ticket = store.getTicket(reference)
  if (!ticket || !playbook.memory) return undefined

  const entry: MemoryEntry = {
    ...playbook.memory,
    id: `mem-${playbook.id}`,
    workspaceId: ticket.workspaceId,
    sourceTicketRef: reference,
    path: ticket.path ?? 'CODE_FIX',
    reuseCount: 0,
    learnedAt: new Date().toISOString().slice(0, 10),
  }

  store.remember(entry)
  return entry
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

interface HopInput {
  baseUrl: string
  to: string
  type: A2ATaskType
  requestTitle: string
  context: Record<string, unknown>
  /** Passed to the agent so a seeded run does not wait out real latency. */
  speed: number
}

/**
 * One A2A exchange: the request on the timeline, the real HTTP call, then the
 * response with the agent's own log lines and its measured latency.
 */
async function hop(
  reference: string,
  input: HopInput,
): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  // The envelope is built first so the request row carries the exact payload
  // that goes over the wire, rather than one patched in afterwards.
  const task = createTask({ from: 'brain', to: input.to, type: input.type, context: input.context })

  say(reference, {
    type: 'a2a.request',
    fromAgent: 'brain',
    toAgent: input.to,
    taskType: input.type,
    title: input.requestTitle,
    level: 'info',
    taskId: task.taskId,
    payload: task,
  })

  const { response, durationMs, error } = await sendTask({
    baseUrl: input.baseUrl,
    ticketRef: reference,
    task,
    speed: input.speed,
  })

  if (error || !response || response.status === 'failed') {
    const message = error ?? response?.error ?? `${input.to} could not complete the task`
    say(reference, {
      type: 'a2a.response',
      fromAgent: input.to,
      toAgent: 'brain',
      taskType: input.type,
      title: message,
      body: ['I could not get what I needed, so I am handing this to a person rather than guessing.'],
      level: 'error',
      durationMs,
      taskId: task.taskId,
      payload: { taskId: task.taskId, status: 'failed', error: message },
    })
    return { ok: false, error: message }
  }

  say(reference, {
    type: 'a2a.response',
    fromAgent: input.to,
    toAgent: 'brain',
    taskType: input.type,
    title: String(response.result?.summary ?? `${input.to} responded`),
    body: (response.result?.detail as string[]) ?? undefined,
    logs: response.log,
    level: 'success',
    // Normally the measured round trip — that is what makes the latency on
    // screen worth trusting. A fast-forwarded run (the boot seed) records the
    // agent's own declared work time instead, because a seeded ticket stands
    // for a run that happened at full speed, and putting 1ms against it would
    // be the one number on the timeline that is not true.
    durationMs: input.speed === 0 ? (response.durationMs ?? durationMs) : durationMs,
    taskId: task.taskId,
    tool: response.result?.tool as { server: string; call: string } | undefined,
    payload: response,
  })

  for (const produced of response.artifacts ?? []) {
    artifact(reference, {
      kind: produced.kind,
      title: produced.title,
      createdBy: input.to,
      data: produced.data,
    })
  }

  return { ok: true, result: response.result }
}

/** A step could not be completed: say so calmly and hand over to a person. */
function stall(
  reference: string,
  reason: string | undefined,
  copy?: { title: string; body: string[] },
): void {
  say(reference, {
    type: 'brain.thought',
    fromAgent: 'brain',
    title: copy?.title ?? 'Handing this to a person',
    body: copy?.body ?? [
      reason ?? 'A step could not be completed.',
      'The run has stopped here rather than guessing. Everything gathered so far is on this timeline.',
    ],
    level: copy ? 'warn' : 'error',
  })

  patch(reference, {
    status: 'NEEDS_HUMAN',
    currentAgentId: undefined,
    currentAgentAction: 'Waiting on a person',
  })
}

// ---------------------------------------------------------------------------
// Small helpers over the store
// ---------------------------------------------------------------------------

function say(
  reference: string,
  event: Omit<ActivityEvent, 'id' | 'seq' | 'ticketId' | 'timestamp'>,
): ActivityEvent | undefined {
  return store.appendActivity(reference, event)
}

function artifact(
  reference: string,
  input: { kind: ArtifactKind; title: string; createdBy: string; data: Record<string, unknown> },
): void {
  const row = store.addArtifact(reference, input)
  if (!row) return

  say(reference, {
    type: 'artifact.created',
    fromAgent: input.createdBy,
    title: `${input.title} recorded`,
    level: input.kind === 'IMPACT' ? 'warn' : 'success',
  })
}

function patch(reference: string, changes: Partial<Ticket>): void {
  store.patchTicket(reference, { ...changes, progress: changes.progress ?? progressOf(reference) })
}

function completeStage(reference: string, id: StageId, agentId: string): void {
  updateStages(reference, (stage) =>
    stage.id === id ? { ...stage, status: 'complete', agentId } : stage,
  )
}

function activateStage(reference: string, id: StageId): void {
  updateStages(reference, (stage) => (stage.id === id ? { ...stage, status: 'active' } : stage))
}

function updateStages(reference: string, map: (stage: Stage) => Stage): void {
  const ticket = store.getTicket(reference)
  if (!ticket?.stages) return

  const stages = ticket.stages.map(map)
  const nextOpen = stages.find((stage) => stage.status === 'pending')
  const withActive = stages.map((stage) =>
    stage.id === nextOpen?.id && !stages.some((other) => other.status === 'active')
      ? { ...stage, status: 'active' as const }
      : stage,
  )

  store.patchTicket(reference, { stages: withActive, progress: progressFrom(withActive) }, { silent: true })
}

function progressOf(reference: string): number {
  return progressFrom(store.getTicket(reference)?.stages ?? [])
}

function progressFrom(stages: Stage[]): number {
  const live = stages.filter((stage) => stage.status !== 'skipped')
  if (live.length === 0) return 0

  const complete = live.filter((stage) => stage.status === 'complete').length
  const inFlight = live.some((stage) => stage.status === 'active') ? 0.5 : 0
  return Math.round(((complete + inFlight) / live.length) * 100)
}

function stagesFor(playbook: Playbook): StageId[] {
  if (playbook.stages) return playbook.stages
  return PATH_ARTIFACTS[playbook.path].includes('PR')
    ? ['context', 'investigate', 'verify', 'approve']
    : ['context', 'approve']
}

function questionFor(playbook: Playbook): string {
  switch (playbook.id) {
    case 'invoice-tax':
      return 'What is the expected tax configuration for this tenant?'
    case 'vendor-access':
      return 'Is this vendor on the invited list for the auction?'
    case 'auth-401':
      return 'What changed in the last deployment, and have we seen this before?'
    case 'auction-howto':
      return 'How is an auction deadline extended?'
    default:
      return 'What product context do you have for this issue?'
  }
}

function decisionTitle(path: string): string {
  switch (path) {
    case 'CODE_FIX':
      return 'Decision: this is a code fix, not a configuration change'
    case 'CONFIG_FIX':
      return 'Decision: configuration fix — engineering is not involved'
    case 'ANSWER_ONLY':
      return 'Decision: this needs an answer, not a change'
    default:
      return 'Decision made'
  }
}

function channelLabel(channel: TicketChannel): string {
  const labels: Record<TicketChannel, string> = {
    chat: 'the customer chat',
    email: 'email',
    portal: 'the customer portal',
    signal: 'a monitoring signal',
    event: 'a business event',
  }
  return labels[channel]
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
