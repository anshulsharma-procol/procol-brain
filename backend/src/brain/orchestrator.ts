import { env } from '../env.js'
import { store } from '../store.js'
import { getPlaybook, type Playbook } from '../domain/playbooks.js'
import type {
  Decision,
  MemoryEntry,
  Run,
  Stage,
  StageId,
  Ticket,
} from '../domain/types.js'
import type {
  ArtifactData,
  ArtifactKind,
  Channel,
  Priority,
  ResolutionPath,
  RunState,
  TaskType,
} from '../contract.js'
import { getWorkspace } from '../domain/workspaces.js'
import { createTask, sendTask } from './a2aClient.js'
import { classify } from './classify.js'
import { policyFor } from './policy.js'
import { resolve } from './registry.js'
import * as timeline from './timeline.js'
import { artifactView, ticketView } from './contractView.js'

/**
 * ============================================================================
 *  THE ORCHESTRATOR
 * ============================================================================
 *
 * A plain async state machine. It classifies, asks the registry who can help,
 * delegates over real HTTP, collects artifacts, stops at the human gate, and
 * writes every transition to the audit trail in the contract's vocabulary.
 *
 * Rules that are not negotiable, because the demo rests on them:
 *
 *  - every transition writes an Activity row and therefore emits an event
 *  - `attempt` caps at 2; an unbounded dev↔QA loop in front of judges is
 *    unrecoverable
 *  - nothing reaches RESOLVED without a human POST, except a pure answer
 *  - a second investigate on an active run joins it rather than forking it
 *  - an agent that is missing, slow or broken produces a calm timeline entry,
 *    never a stack trace and never a stuck ticket
 */

export interface CreateTicketInput {
  workspaceId?: string
  /** Only the seeder sets this, so the canonical demo tickets keep their ids. */
  id?: string
  /** The customer's own words. Drives classification. */
  message: string
  title?: string
  description?: string
  customer?: string | null
  reportedBy?: string
  priority?: Priority
  channel?: Channel
  processKey?: string | null
  origin?: Ticket['origin']
}

export interface RunOptions {
  /** 0 plays the run out instantly — used to seed the board at boot. */
  speed?: number
}

/** The hard cap on the dev↔QA loop, asserted in a test. */
export const MAX_ATTEMPTS = 2

/** Tickets currently being walked, so a double click cannot fork a run. */
const active = new Map<string, Promise<void>>()

// ---------------------------------------------------------------------------
// Intake
// ---------------------------------------------------------------------------

/**
 * Creates a ticket from a message. This is the single entry point for both
 * surfaces: the customer's chat widget and the console's raise-a-ticket form
 * both land here, so a ticket raised from a client dashboard is
 * indistinguishable from one raised internally — same record, same board,
 * same timeline.
 */
export function createTicket(input: CreateTicketInput): Ticket {
  const { workspace, playbook, recognised, matched, confidence } = classify({
    message: input.message,
    workspaceId: input.workspaceId,
  })

  // An explicit id is the seeder's, and it must not land on an existing
  // ticket: overwriting one silently merges two audit trails.
  if (input.id && store.hasTicket(input.id)) {
    throw new Error(`Ticket ${input.id} already exists`)
  }

  const id = input.id ?? store.nextReference(workspace.id)
  const now = new Date().toISOString()

  const ticket: Ticket = {
    id,
    customer: input.customer === undefined ? playbook.ticket.defaultCustomer : input.customer,
    title: input.title ?? playbook.ticket.title,
    description: input.description ?? input.message,
    channel: input.channel ?? playbook.ticket.channel ?? 'portal',
    priority: input.priority ?? playbook.ticket.priority,
    status: 'NEW',
    category: recognised ? playbook.ticket.category : null,
    processKey: input.processKey ?? null,
    createdAt: now,
    updatedAt: now,

    categoryLabel: playbook.ticket.categoryLabel,
    workspaceId: workspace.id,
    reportedBy: input.reportedBy ?? playbook.ticket.reportedBy,
    impact: playbook.ticket.impact,
    issueQuote: [input.message],
    progress: 0,
    stages: buildStages(stagesFor(playbook)),
    origin: input.origin,
  }

  store.putTicket(ticket)
  store.setRun(id, { playbookId: playbook.id, active: false })

  timeline.ticketCreated(id, ticketView(ticket), channelLabel(ticket.channel))

  timeline.thought(
    id,
    recognised ? `Recognised as “${playbook.ticket.title}”` : 'I do not recognise this symptom',
    recognised
      ? `Matched on ${matched.slice(0, 4).join(', ')} with ${Math.round(confidence * 100)}% confidence. I will confirm it against product context before acting on it.`
      : 'Nothing in this control tower matches these symptoms, so I am working from the customer’s description alone and will say plainly what I am unsure about.',
  )

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
): { run: Run; joined: boolean } | { error: string } {
  const ticket = store.getTicket(reference)
  if (!ticket) return { error: `Ticket ${reference} not found` }

  // Idempotent: a second click joins the run in flight rather than forking it.
  if (active.has(reference)) {
    const existing = store.runForTicket(reference)
    if (existing) return { run: existing, joined: true }
  }

  // A ticket that has already reached the gate or been closed is not
  // re-investigated on a whim: that would append a second run to the same
  // audit trail and leave two contradictory timelines on one record.
  if (ticket.status !== 'NEW' && ticket.status !== 'NEEDS_HUMAN') {
    return { error: `Ticket ${reference} is ${ticket.status}; a run cannot be started from there` }
  }

  const previous = store.runForTicket(reference)
  const attempt = Math.min(previous ? previous.attempt + 1 : 1, MAX_ATTEMPTS)
  const run = store.startRunRecord(reference, attempt)

  const promise = walk(reference, run.id, options).finally(() => {
    active.delete(reference)
    const state = store.getRun(reference)
    if (state) store.setRun(reference, { ...state, active: false })
  })

  active.set(reference, promise)

  // Unhandled rejections must not take the process down mid-demo.
  promise.catch((error: unknown) => {
    console.error(`[run ${reference}]`, error)
  })

  return { run, joined: false }
}

/** Awaits the run — used by seeding and by tests, never by a route. */
export async function runToCompletion(reference: string, options: RunOptions = {}): Promise<void> {
  const started = startRun(reference, options)
  if ('error' in started) throw new Error(started.error)
  await active.get(reference)
}

async function walk(reference: string, runId: string, options: RunOptions): Promise<void> {
  const ticket = store.getTicket(reference)
  const state = store.getRun(reference)
  if (!ticket || !state) return

  const speed = options.speed ?? env.RUN_SPEED
  const playbook = getPlaybook(state.playbookId)
  const workspace = getWorkspace(ticket.workspaceId)
  const pause = (ms: number) => (speed === 0 ? Promise.resolve() : delay(ms / speed))

  store.setRun(reference, { ...state, active: true })
  store.patchTicket(reference, { status: 'RUNNING' }, { silent: true })

  timeline.runStarted(reference, runId)
  timeline.thought(reference, 'Investigation started', playbook.narration.received.join(' '))

  transition(reference, runId, 'CLASSIFYING', 'Classifying')
  await pause(600)

  // -- context ------------------------------------------------------------
  timeline.thought(
    reference,
    'Looking for an agent that can answer product questions',
    playbook.narration.routing.join(' '),
  )
  await pause(400)

  const knowledge = resolve(workspace, 'product_knowledge')
  if (!knowledge) {
    return stall(reference, runId, 'No agent in this control tower declares product_knowledge.')
  }

  transition(reference, runId, 'GATHERING_CONTEXT', 'Fetching product context', knowledge.agent.id)

  const contextHop = await hop(reference, runId, {
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

  if (!contextHop.ok) return stall(reference, runId, contextHop.error)
  completeStage(reference, 'context', knowledge.agent.id)

  const isProductDefect = Boolean(contextHop.result?.isProductDefect)
  const isQuestion = Boolean(contextHop.result?.isQuestion)
  await pause(500)

  // The knowledge agent can say "I have nothing on this". Brain stops there
  // rather than picking a branch on no evidence.
  if (contextHop.result?.needsHuman) {
    return stall(reference, runId, 'Nothing on file in this workspace covers this symptom.', {
      title: 'Nothing on file — handing this to a person',
      body: playbook.narration.decision.join(' '),
    })
  }

  // -- decide -------------------------------------------------------------
  const path: ResolutionPath = isQuestion ? 'ANSWER_ONLY' : isProductDefect ? 'CODE_FIX' : 'CONFIG_FIX'

  transition(reference, runId, 'DECIDING', 'Deciding')
  timeline.thought(reference, decisionTitle(path), playbook.narration.decision.join(' '))
  store.patchRun(runId, { path })
  await pause(500)

  // -- the branch ---------------------------------------------------------
  if (path === 'CODE_FIX') {
    const engineering = resolve(workspace, 'create_pr')
    if (!engineering) return stall(reference, runId, 'No agent declares create_pr.')

    transition(reference, runId, 'INVESTIGATING', 'Investigating the code', engineering.agent.id)

    const devHop = await hop(reference, runId, {
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

    if (!devHop.ok) return stall(reference, runId, devHop.error)
    completeStage(reference, 'investigate', engineering.agent.id)
    await pause(500)

    const validation = resolve(workspace, 'run_tests')
    if (!validation) return stall(reference, runId, 'No agent declares run_tests.')

    transition(reference, runId, 'VERIFYING', 'Running the suite', validation.agent.id)

    const qaHop = await hop(reference, runId, {
      baseUrl: validation.baseUrl,
      to: validation.agent.id,
      type: 'VALIDATE_FIX',
      requestTitle: 'Validate the fix against the regression suite',
      speed,
      context: { ticketId: reference, playbookId: playbook.id },
    })

    if (!qaHop.ok) return stall(reference, runId, qaHop.error)
    completeStage(reference, 'verify', validation.agent.id)
    await pause(400)

    // Blast radius. The analytics copilot runs inside Brain and reads through
    // the connector layer, so there is no A2A hop to make here.
    if (playbook.impact) {
      const lens = workspace.agents.find((agent) => agent.role === 'analytics')
      timeline.thought(reference, playbook.impact.summary, playbook.impact.detail.join(' '))
      artifact(reference, 'IMPACT', 'Blast radius', lens?.id ?? 'brain', {
        affectedTenants: playbook.impact.affectedTenants,
        affectedRecords: playbook.impact.affectedRecords,
        firstSeen: playbook.impact.firstSeen,
        trend: playbook.impact.trend,
        sql: playbook.impact.sql,
        source: playbook.impact.source,
      })
      await pause(400)
    }
  }

  if (path === 'CONFIG_FIX' && playbook.configFix) {
    transition(reference, runId, 'DRAFTING_REMEDIATION', 'Drafting the remediation')
    artifact(reference, 'CONFIG_FIX', 'Configuration remediation', 'brain', {
      title: playbook.configFix.title,
      steps: playbook.configFix.steps,
      rationale: playbook.configFix.rationale,
      // The point of this branch: Brain decided engineering was not needed.
      requiresCodeChange: false,
      citations: playbook.configFix.citations,
      customer: ticket.customer ?? 'the customer',
    })
    await pause(400)
  }

  if (path === 'ANSWER_ONLY' && playbook.answer) {
    transition(reference, runId, 'DRAFTING_REPLY', 'Drafting the answer')
    timeline.thought(reference, playbook.answer.summary, playbook.answer.detail.join(' '))
    await pause(300)
  }

  // -- the customer reply, drafted before anyone is asked to approve -------
  artifact(reference, 'CUSTOMER_REPLY', 'Customer reply', 'brain', {
    subject: `${playbook.reply.subject} — ${reference}`,
    body: [`Hi ${ticket.customer ?? 'there'},`, ...playbook.reply.body].join('\n\n'),
    citations: playbook.reply.citations,
    // additive: who it goes to. Filled in at the gate; `sentAt` and
    // `approvedBy` are added by finish(), once it has actually gone.
    sentTo: contactFor(ticket, workspace.supportEmailDomain),
  })

  const kinds = store.getArtifacts(reference).map((row) => row.kind)
  const policy = policyFor(workspace, path, kinds, ticket)
  store.setRun(reference, { playbookId: playbook.id, active: true, approvalPolicyId: policy?.id })

  // -- the gate ------------------------------------------------------------
  if (!policy) {
    // A pure answer changes nothing, so it closes itself and says why.
    finish(reference, runId, {
      outcome: 'APPROVED',
      by: 'Brain (no change required)',
      at: new Date().toISOString(),
    }, playbook, {
      closingNote:
        'Nothing was changed in the product or the tenant’s configuration, so there is nothing for a person to approve. The answer has gone to the customer.',
    })
    return
  }

  store.patchRun(runId, { policyReason: policy.reason })
  activateStage(reference, 'approve')
  store.patchTicket(reference, {
    status: 'AWAITING_APPROVAL',
    currentAgentId: 'human-approver',
    currentAgentAction: 'Waiting for your approval',
    progress: progressOf(reference),
  })
  store.setRunState(runId, 'AWAITING_APPROVAL')

  timeline.thought(
    reference,
    'Stopping for human approval',
    (playbook.narration.gate.length ? playbook.narration.gate : [policy.reason]).join(' '),
  )
  timeline.awaitingApproval(reference, {
    runId,
    policyId: policy.id,
    policyReason: policy.reason,
  })
}

// ---------------------------------------------------------------------------
// The human gate
// ---------------------------------------------------------------------------

export function decide(
  reference: string,
  input: { decision: 'APPROVE' | 'REJECT'; by: string; note?: string },
): { ok: true } | { ok: false; error: string } {
  const ticket = store.getTicket(reference)
  if (!ticket) return { ok: false, error: `Ticket ${reference} not found` }

  const run = store.runForTicket(reference)
  if (!run || ticket.status !== 'AWAITING_APPROVAL') {
    return { ok: false, error: `Ticket ${reference} is ${ticket.status}, not awaiting approval` }
  }

  const state = store.getRun(reference)
  const playbook = getPlaybook(state?.playbookId ?? '')
  const decision: Decision = {
    outcome: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    by: input.by,
    note: input.note,
    at: new Date().toISOString(),
  }

  store.setDecision(reference, decision)

  // The person's action lands on the same record as the agents', in the same
  // vocabulary. That peer status is the closing argument of the product.
  const verdict =
    input.decision === 'APPROVE'
      ? `${input.by} approved the fix`
      : `${input.by} sent this back for a human`

  timeline.thought(reference, verdict, input.note ?? null)
  timeline.runState(reference, {
    runId: run.id,
    state: input.decision === 'APPROVE' ? 'RESOLVED' : 'NEEDS_HUMAN',
    path: run.path,
    attempt: run.attempt,
    action: verdict,
  })

  if (input.decision === 'REJECT') {
    store.setRunState(run.id, 'NEEDS_HUMAN')
    store.patchTicket(reference, {
      status: 'NEEDS_HUMAN',
      currentAgentId: undefined,
      currentAgentAction: 'Waiting on a person',
    })
    timeline.runCompleted(reference, {
      runId: run.id,
      outcome: 'NEEDS_HUMAN',
      summary: 'The proposed fix was rejected. Nothing has been released.',
    })
    return { ok: true }
  }

  finish(reference, run.id, decision, playbook)
  return { ok: true }
}

/** Notify the customer, close the ticket, and keep what the run learned. */
function finish(
  reference: string,
  runId: string,
  decision: Decision,
  playbook: Playbook,
  options: { closingNote?: string } = {},
): void {
  const ticket = store.getTicket(reference)
  if (!ticket) return

  store.setDecision(reference, decision)

  // The reply drafted at the gate goes out unchanged, and the artifact is
  // stamped with when and by whom — so the record shows the approval and the
  // send as one act rather than two unrelated events.
  const reply = store.getArtifacts(reference).find((row) => row.kind === 'CUSTOMER_REPLY')
  if (reply) {
    store.patchArtifact(reference, reply.id, {
      sentAt: decision.at,
      approvedBy: decision.by,
    })

    timeline.thought(
      reference,
      `Customer notified — ${String(reply.data.subject)}`,
      `Sent to ${String(reply.data.sentTo)}. The reply drafted at the gate has gone out unchanged.`,
    )
  }

  const memory = rememberRun(reference, playbook)

  completeStage(reference, 'approve', 'human-approver')
  store.setRunState(runId, 'RESOLVED')
  store.patchRun(runId, { summary: playbook.reply.subject })
  store.patchTicket(reference, {
    status: 'RESOLVED',
    currentAgentId: undefined,
    currentAgentAction: 'Closed',
    progress: 100,
  })

  timeline.runCompleted(reference, {
    runId,
    outcome: 'RESOLVED',
    summary:
      options.closingNote ??
      (memory
        ? `Written to institutional memory as “${memory.title}”. The next ticket with this symptom starts from the answer instead of the beginning.`
        : 'Run archived on the audit trail.'),
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
    path: store.runForTicket(reference)?.path ?? 'CODE_FIX',
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
  type: TaskType
  requestTitle: string
  context: Record<string, unknown>
  /** Passed to the agent so a seeded run does not wait out real latency. */
  speed: number
}

/**
 * One A2A exchange: the request on the timeline with its envelope attached,
 * the real HTTP call, the agent's own working notes as their own rows, then
 * the response with its measured latency.
 */
async function hop(
  reference: string,
  runId: string,
  input: HopInput,
): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  // The envelope is built first so the request row carries the exact payload
  // that goes over the wire, rather than one patched in afterwards.
  const task = createTask({ from: 'brain', to: input.to, type: input.type, context: input.context })

  timeline.request(reference, {
    taskId: task.taskId,
    to: input.to,
    taskType: input.type,
    summary: input.requestTitle,
    // The envelope itself, which is what the "show payload" disclosure
    // reveals — the exact bytes that went over the wire, not a retelling.
    payload: task,
  })

  const { response, durationMs, error } = await sendTask({
    baseUrl: input.baseUrl,
    ticketRef: reference,
    runId,
    task,
    speed: input.speed,
  })

  if (error || !response || response.status === 'failed') {
    const message = error ?? response?.error ?? `${input.to} could not complete the task`
    timeline.response(reference, {
      taskId: task.taskId,
      from: input.to,
      status: 'failed',
      summary: message,
      durationMs,
      detail:
        'I could not get what I needed, so I am handing this to a person rather than guessing.',
    })
    return { ok: false, error: message }
  }

  // The agent's working notes, each its own row carrying the parent task id.
  for (const line of response.log ?? []) {
    timeline.log(reference, task.taskId, input.to, line)
  }

  const summary = String(response.result?.summary ?? `${input.to} responded`)
  const detail = (response.result?.detail as string[] | undefined)?.join(' ') ?? null

  timeline.response(reference, {
    taskId: task.taskId,
    from: input.to,
    status: 'completed',
    summary,
    detail,
    // Normally the measured round trip — that is what makes the latency on
    // screen worth trusting. A fast-forwarded run (the boot seed) records the
    // agent's own declared work time instead, because a seeded ticket stands
    // for a run that happened at full speed, and putting 1ms against it would
    // be the one number on the timeline that is not true.
    durationMs: input.speed === 0 ? (response.durationMs ?? durationMs) : durationMs,
  })

  for (const produced of response.artifacts ?? []) {
    // An agent is a separate service, so what it sends back is unknown until
    // it is checked. The conformance checker (tools/conform.ts) is where the
    // payloads are validated against the contract; here the cast is the
    // boundary being named rather than hidden.
    artifact(
      reference,
      produced.kind,
      produced.title,
      input.to,
      produced.data as ArtifactData & Record<string, unknown>,
    )
  }

  return { ok: true, result: response.result }
}

/** A step could not be completed: say so calmly and hand over to a person. */
function stall(
  reference: string,
  runId: string,
  reason: string | undefined,
  copy?: { title: string; body: string },
): void {
  timeline.thought(
    reference,
    copy?.title ?? 'Handing this to a person',
    copy?.body ??
      `${reason ?? 'A step could not be completed.'} The run has stopped here rather than guessing. Everything gathered so far is on this timeline.`,
  )

  store.setRunState(runId, 'NEEDS_HUMAN')
  store.patchTicket(reference, {
    status: 'NEEDS_HUMAN',
    currentAgentId: undefined,
    currentAgentAction: 'Waiting on a person',
  })

  timeline.runCompleted(reference, { runId, outcome: 'NEEDS_HUMAN', summary: reason ?? null })
}

// ---------------------------------------------------------------------------
// Small helpers over the store
// ---------------------------------------------------------------------------

/** Moves the run to a new state and says so, in one step. */
function transition(
  reference: string,
  runId: string,
  state: RunState,
  action: string,
  agentId?: string,
): void {
  const run = store.setRunState(runId, state)
  store.patchTicket(
    reference,
    { currentAgentId: agentId ?? 'brain', currentAgentAction: action, progress: progressOf(reference) },
    { silent: true },
  )

  timeline.runState(reference, {
    runId,
    state,
    path: run?.path ?? null,
    attempt: run?.attempt ?? 1,
    action,
  })
}

/**
 * Records an artifact and puts it on the timeline carrying its whole payload,
 * so a client watching the stream renders the PR or the test run without a
 * second request.
 */
function artifact(
  reference: string,
  kind: ArtifactKind,
  title: string,
  createdBy: string,
  data: ArtifactData & Record<string, unknown>,
): void {
  const row = store.addArtifact(reference, { kind, title, createdBy, data })
  if (!row) return

  timeline.artifactCreated(reference, artifactView(row))
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

function buildStages(needed: StageId[]): Stage[] {
  const all: { id: StageId; label: string }[] = [
    { id: 'context', label: 'Context' },
    { id: 'investigate', label: 'Investigate' },
    { id: 'verify', label: 'Verify' },
    { id: 'approve', label: 'Approve' },
  ]

  return all.map((stage) => ({
    ...stage,
    status: needed.includes(stage.id) ? 'pending' : 'skipped',
    ...(needed.includes(stage.id) ? {} : { detail: 'Not needed on this path' }),
  }))
}

function stagesFor(playbook: Playbook): StageId[] {
  return playbook.stages ?? ['context', 'investigate', 'verify', 'approve']
}

function contactFor(ticket: Ticket, domain: string): string {
  if (ticket.origin?.userId) return ticket.origin.userId
  if (!ticket.customer) return `alerts@${domain}`
  return `${ticket.customer.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.com`
}

function questionFor(playbook: Playbook): string {
  switch (playbook.id) {
    case 'invoice-tax':
      return 'What is the expected tax configuration for this tenant?'
    case 'vendor-access':
      return 'Is this vendor on the invited list for the auction?'
    case 'auth-401':
      return 'What changed in the last deployment, and have we seen this before?'
    case 'webhook-retry':
      return 'What does the delivery log say, and what is this tenant’s retry budget?'
    case 'auction-howto':
      return 'How is an auction deadline extended?'
    default:
      return 'What product context do you have for this issue?'
  }
}

function decisionTitle(path: ResolutionPath): string {
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

function channelLabel(channel: Channel): string {
  const labels: Record<Channel, string> = {
    email: 'email',
    portal: 'the customer portal',
    slack: 'Slack',
    signal: 'a monitoring signal',
    event: 'a business event',
  }
  return labels[channel] ?? channel
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
