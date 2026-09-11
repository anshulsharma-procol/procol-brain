import type {
  A2AResponse,
  A2AStatus,
  A2ATask,
  A2ATaskContext,
  A2ATaskType,
  AgentActivity,
  AgentDescriptor,
  AgentId,
  ApprovalResult,
  McpToolBinding,
} from '../types/a2a'
import type {
  BrainContext,
  BrainReply,
  BrainTicket,
  InvestigationProgressUpdate,
  InvestigationStep,
  InvestigationStepStatus,
  Resolution,
  ResolutionCheck,
  SimilarIssue,
  TicketStatus,
} from '../types/brain'
import type { BrainApi, BrainClientOptions } from './brainApi'
import { delay } from '../utils/delay'
import { createId } from '../utils/id'

/**
 * HTTP adapter for the Brain gateway the backend is building.
 *
 *   POST {base}/issues/search        -> SimilarIssue[]
 *   POST {base}/tickets              -> BrainTicket
 *   GET  {base}/tickets              -> BrainTicket[]
 *   GET  {base}/tickets/:id          -> BrainTicket
 *   GET  {base}/tickets/:id/activity -> { steps?, activity?, resolution? }
 *   POST {base}/tickets/:id/approve  -> ApprovalResult
 *   POST {base}/a2a/tasks            -> A2AResponse
 *   GET  {base}/tasks/:id            -> { task, response }
 *   GET  {base}/agents               -> AgentDescriptor[]
 *   POST {base}/messages             -> BrainReply
 *
 * Every response is normalised through a mapper below, each documented with the
 * JSON it expects. Nothing here throws on a missing field: the backend is being
 * written while the demo runs, and a half-built response should degrade to a
 * quieter UI rather than to an error bubble.
 */

/* ----------------------------------------------------------------- contract */

/**
 * Same shape as {@link BrainClientOptions}, so this client is a drop-in swap
 * for `createBrainClient` - hosts configure it identically.
 */
export type RestBrainClientOptions = BrainClientOptions

/** `GET /tasks/:id` - one A2A envelope plus whatever the agent answered. */
export interface A2ATaskRecord {
  task?: A2ATask
  response?: A2AResponse
}

/** Extra fields the console can attach when a human signs off. */
export interface ApprovalRequest {
  approver?: string
  note?: string
}

/**
 * The widget is not itself an agent: it is the customer-facing surface that
 * asks the orchestrator to do the work, so it addresses Brain under its own id
 * instead of impersonating one of the registered agents.
 */
const WIDGET_AGENT_ID: AgentId = 'brain-chat'
const ORCHESTRATOR_AGENT_ID: AgentId = 'procol-brain'

const DEFAULT_POLL_INTERVAL_MS = 1500

/**
 * Consecutive `/activity` failures tolerated before an investigation gives up.
 * A single 502 between two good polls should not kill a run the customer is
 * watching, but a backend that is down should still surface an error.
 */
const MAX_POLL_FAILURES = 4

interface PipelineStage {
  id: string
  label: string
  /** Display name under the step. */
  agent?: string
  /** A2A id whose response completes the stage. */
  agentId?: AgentId
}

/**
 * The five stages the customer watches. Step statuses are derived from the
 * activity feed rather than trusted from the backend, so a gateway that only
 * streams A2A hops and MCP tool calls still drives the progress list.
 */
const PIPELINE: PipelineStage[] = [
  { id: 'understand', label: 'Understanding the issue' },
  { id: 'context', label: 'Fetching product context', agent: 'Clara', agentId: 'clara' },
  { id: 'code', label: 'Investigating code', agent: 'Development Agent', agentId: 'dev-agent' },
  { id: 'validate', label: 'Running validation', agent: 'QA Agent', agentId: 'qa-agent' },
  { id: 'approval', label: 'Waiting for approval', agent: 'Manager', agentId: 'manager' },
]

const TICKET_STATUSES: TicketStatus[] = [
  'open',
  'investigating',
  'awaiting_approval',
  'resolved',
]
const STEP_STATUSES: InvestigationStepStatus[] = ['pending', 'active', 'complete']
const A2A_STATUSES: A2AStatus[] = ['pending', 'running', 'completed', 'failed']
const A2A_TASK_TYPES: A2ATaskType[] = [
  'GET_PRODUCT_CONTEXT',
  'INVESTIGATE_BUG',
  'RUN_TESTS',
  'REQUEST_APPROVAL',
]

/* ------------------------------------------------------------------ client */

/** Brain API client backed by the real gateway. */
export function createRestBrainClient(options: RestBrainClientOptions): BrainApi {
  const transport = createTransport(options)
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS

  return {
    async searchSimilarIssues(request) {
      return toSimilarIssues(await transport.post('/issues/search', request))
    },

    async createTicket(request) {
      // The customer's own words are the last-resort title, so a backend that
      // persists nothing but an id still renders a recognisable ticket.
      return toTicket(await transport.post('/tickets', request), request.message)
    },

    async getTicketStatus({ ticketId }) {
      const payload = await transport.get(`/tickets/${encodeURIComponent(ticketId)}`)
      return toTicketStatus(asRecord(payload).status)
    },

    async sendMessage(request) {
      return toReply(await transport.post('/messages', request))
    },

    /** `GET /tickets/:id/activity`, read for its resolution alone. */
    async getResolution({ ticketId }) {
      const payload = await transport.get(`/tickets/${encodeURIComponent(ticketId)}/activity`)
      return toProgressUpdate(payload, ticketId).resolution
    },

    async startInvestigation({ ticketId, identity, context }, investigation) {
      const signal = investigation?.signal
      const task: A2ATask = {
        taskId: createId('task'),
        from: WIDGET_AGENT_ID,
        to: ORCHESTRATOR_AGENT_ID,
        type: 'INVESTIGATE_BUG',
        context: { ...context, ticketId, identity },
      }

      // Two ways to start the same pipeline. The ticket-scoped route is the
      // documented one; if the backend has not built it yet we fall back to
      // posting the A2A envelope straight at the orchestrator. Either way
      // progress is read from the activity feed.
      const investigatePath = `/tickets/${encodeURIComponent(ticketId)}/investigate`
      let accepted: A2AResponse | undefined

      try {
        accepted = toA2AResponse(
          await transport.post(investigatePath, { identity, context, task }, signal),
        )
      } catch (error) {
        if (!isNotFound(error)) throw error
        accepted = toA2AResponse(await transport.post('/a2a/tasks', task, signal))
      }

      if (accepted?.status === 'failed') {
        throw new Error(
          `Brain API rejected the investigation: ${accepted.error ?? 'no reason given'}`,
        )
      }

      const path = `/tickets/${encodeURIComponent(ticketId)}/activity`
      let failures = 0

      for (;;) {
        throwIfAborted(signal)

        let update: InvestigationProgressUpdate
        try {
          update = toProgressUpdate(await transport.get(path, signal), ticketId)
          failures = 0
        } catch (error) {
          if (isAbortError(error) || ++failures > MAX_POLL_FAILURES) throw error
          await delay(pollIntervalMs, signal)
          continue
        }

        investigation?.onProgress?.(update)
        if (update.resolution) return update.resolution

        await delay(pollIntervalMs, signal)
      }
    },
  }
}

/* ----------------------------------------------------------------- helpers */

/**
 * `GET /agents` - the A2A registry. The widget does not need it, but the
 * internal console lists who is connected and which MCP tools they may call.
 */
export async function fetchAgentRegistry(
  options: RestBrainClientOptions,
): Promise<AgentDescriptor[]> {
  const payload = await createTransport(options).get('/agents')
  return toList(payload, 'agents', 'registry').map(toAgentDescriptor).filter(isPresent)
}

/** `GET /tickets` - every ticket Brain knows about, newest first per the backend. */
export async function fetchTickets(options: RestBrainClientOptions): Promise<BrainTicket[]> {
  const payload = await createTransport(options).get('/tickets')
  return toList(payload, 'tickets', 'items', 'results').map((row) => toTicket(row))
}

/** `GET /tasks/:id` - one A2A envelope and its response, for the task inspector. */
export async function fetchTask(
  options: RestBrainClientOptions,
  taskId: string,
): Promise<A2ATaskRecord> {
  const payload = await createTransport(options).get(`/tasks/${encodeURIComponent(taskId)}`)
  return toTaskRecord(payload)
}

/**
 * `POST /a2a/tasks` - send an envelope to any agent. Exposed so the console can
 * replay a hop (ask Clara again, re-run QA) without a bespoke endpoint.
 */
export async function sendA2ATask(
  options: RestBrainClientOptions,
  task: A2ATask,
): Promise<A2AResponse | undefined> {
  return toA2AResponse(await createTransport(options).post('/a2a/tasks', task))
}

/**
 * `POST /tickets/:id/approve` - the manager gate. Approval happens in the
 * internal console, not in the customer's widget, which is why this is a
 * standalone helper rather than part of {@link BrainApi}.
 */
export async function approveResolution(
  options: RestBrainClientOptions,
  ticketId: string,
  request: ApprovalRequest = {},
): Promise<ApprovalResult> {
  const payload = await createTransport(options).post(
    `/tickets/${encodeURIComponent(ticketId)}/approve`,
    request,
  )
  return toApprovalResult(payload, request.approver)
}

/* --------------------------------------------------------------- transport */

interface Transport {
  get(path: string, signal?: AbortSignal): Promise<unknown>
  post(path: string, body: unknown, signal?: AbortSignal): Promise<unknown>
}

function createTransport(options: RestBrainClientOptions): Transport {
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  // Bound to the global: detached `fetch` throws "Illegal invocation" in some
  // browsers, and a host-supplied fetch is already bound by its owner.
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)

  async function send(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const response = await doFetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const reason = response.statusText ? ` ${response.statusText}` : ''
      throw new Error(`Brain API ${method} ${path} failed (${response.status}${reason})`)
    }

    return readJson(response)
  }

  return {
    get: (path, signal) => send('GET', path, undefined, signal),
    post: (path, body, signal) => send('POST', path, body, signal),
  }
}

/**
 * Reads a JSON body without trusting the backend to send one: `POST /a2a/tasks`
 * may answer `202` with an empty body while the pipeline is being wired, and an
 * unparseable body is a missing payload rather than a crash.
 */
async function readJson(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '')
  if (!text.trim()) return undefined

  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

/* ----------------------------------------------------------------- mappers */

/**
 * `POST /issues/search`:
 * `[{ id, reference, title, customer, solution, confidence?, url? }]`
 *
 * A bare array, `{ issues: [...] }` and `{ results: [...] }` are all accepted -
 * that wrapper is the shape most likely to change while the API is young.
 */
function toSimilarIssues(payload: unknown): SimilarIssue[] {
  return toList(payload, 'issues', 'results', 'matches').map(toSimilarIssue).filter(isPresent)
}

/** One row of {@link toSimilarIssues}. Rows with nothing to show are dropped. */
function toSimilarIssue(payload: unknown, index: number): SimilarIssue | undefined {
  const raw = asRecord(payload)
  const title = pickString(raw, 'title', 'subject', 'summary')
  const solution = pickString(raw, 'solution', 'resolution', 'fix')
  if (!title && !solution) return undefined

  const reference = pickString(raw, 'reference', 'number', 'ref')

  return {
    id: pickString(raw, 'id', 'issueId', 'ticketId') ?? `issue-${reference ?? index}`,
    reference: reference ?? '',
    title: title ?? 'Previously resolved issue',
    customer: pickString(raw, 'customer', 'company', 'account') ?? '',
    solution: solution ?? '',
    confidence: asNumber(raw.confidence ?? raw.score),
    url: pickString(raw, 'url', 'link'),
  }
}

/**
 * `POST /tickets` and `GET /tickets/:id`:
 * `{ id, reference, title, status, createdAt, context? }`
 *
 * `ticketId` / `_id` are accepted for the id and `number` for the reference,
 * because those are the names an ORM tends to leak first.
 */
function toTicket(payload: unknown, fallbackTitle?: string): BrainTicket {
  const raw = asRecord(payload)
  const id = pickString(raw, 'id', 'ticketId', 'ticket_id', '_id') ?? createId('ticket')
  const context = raw.context

  return {
    id,
    reference: pickString(raw, 'reference', 'number', 'ref') ?? id,
    title:
      pickString(raw, 'title', 'subject', 'summary') ??
      summarise(fallbackTitle) ??
      'Support request',
    status: toTicketStatus(raw.status),
    createdAt: pickString(raw, 'createdAt', 'created_at') ?? new Date().toISOString(),
    context: isRecord(context) ? (context as BrainContext) : undefined,
  }
}

/** `status` on a ticket. Unknown or missing reads as `open`. */
function toTicketStatus(value: unknown): TicketStatus {
  const status = asString(value)?.toLowerCase().replace(/[\s-]+/g, '_')
  if (status === 'in_progress' || status === 'investigation') return 'investigating'
  if (status === 'closed' || status === 'done') return 'resolved'
  return TICKET_STATUSES.find((known) => known === status) ?? 'open'
}

/**
 * `GET /tickets/:id/activity`:
 * `{ ticketId, steps?: [...], activity?: [...], resolution?: {...}, status? }`
 *
 * `steps` is optional on purpose: when the backend sends only the agent
 * conversation, progress is derived from it, so the pipeline in the UI never
 * has to be kept in sync with the orchestrator by hand.
 */
function toProgressUpdate(payload: unknown, ticketId: string): InvestigationProgressUpdate {
  const raw = asRecord(payload)
  const activity = toList(payload, 'activity', 'activities', 'events', 'timeline')
    .map(toActivity)
    .filter(isPresent)

  const reportedStatus = pickString(raw, 'status') ?? pickString(asRecord(raw.ticket), 'status')
  const status = reportedStatus ? toTicketStatus(reportedStatus) : undefined
  const resolution =
    toResolution(raw.resolution, ticketId) ??
    (status === 'resolved' || status === 'awaiting_approval'
      ? synthesiseResolution(ticketId, activity, status)
      : undefined)

  const backendSteps = toSteps(raw.steps)

  return {
    ticketId: pickString(raw, 'ticketId', 'ticket_id') ?? ticketId,
    steps: backendSteps.length > 0 ? backendSteps : deriveSteps(activity, resolution),
    activity,
    resolution,
  }
}

/**
 * `activity` rows:
 * `{ id, from, to, text, via: 'A2A' | 'MCP', kind: 'request' | 'response' | 'tool',
 *    taskId?, tool?: { server, call }, at? }`
 *
 * `via` is inferred from the presence of `tool` when it is missing, because
 * A2A-versus-MCP is the whole point of the feed. Ids fall back to the row's
 * position: the contract says the full array is re-sent on every poll, so
 * position is stable and React keys do not churn between polls.
 */
function toActivity(payload: unknown, index: number): AgentActivity | undefined {
  const raw = asRecord(payload)
  const text = pickString(raw, 'text', 'message', 'summary', 'detail')
  if (!text) return undefined

  const tool = toToolCall(raw.tool)
  const declaredVia = pickString(raw, 'via')?.toUpperCase()
  const via: AgentActivity['via'] =
    declaredVia === 'MCP' || (declaredVia === undefined && tool !== undefined) ? 'MCP' : 'A2A'
  const from = pickString(raw, 'from', 'fromAgent', 'from_agent') ?? ORCHESTRATOR_AGENT_ID

  return {
    id: pickString(raw, 'id', 'activityId', 'event_id') ?? `activity-${index}`,
    from,
    to: pickString(raw, 'to', 'toAgent', 'to_agent') ?? ORCHESTRATOR_AGENT_ID,
    text,
    via,
    kind: toActivityKind(raw.kind, via, from),
    taskId: pickString(raw, 'taskId', 'task_id'),
    tool,
    at: pickString(raw, 'at', 'timestamp', 'createdAt', 'created_at'),
  }
}

/** `kind` on an activity row. Brain hands work out; everyone else reports back. */
function toActivityKind(
  value: unknown,
  via: AgentActivity['via'],
  from: AgentId,
): AgentActivity['kind'] {
  const kind = asString(value)?.toLowerCase()
  if (kind === 'request' || kind === 'response' || kind === 'tool') return kind
  if (via === 'MCP') return 'tool'
  return from === ORCHESTRATOR_AGENT_ID ? 'request' : 'response'
}

/** `tool` on an MCP activity row: `{ server, call }`, e.g. `github` / `create_pr`. */
function toToolCall(value: unknown): AgentActivity['tool'] {
  const raw = asRecord(value)
  const server = pickString(raw, 'server', 'name')
  const call = pickString(raw, 'call', 'tool', 'capability', 'function')
  if (!server && !call) return undefined

  return { server: server ?? 'mcp', call: call ?? 'tool_call' }
}

/**
 * `steps` on the activity payload:
 * `[{ id, label, status: 'pending' | 'active' | 'complete', agent?, detail? }]`
 *
 * Rows without a label are dropped rather than rendered blank; an empty result
 * sends {@link toProgressUpdate} to {@link deriveSteps} instead.
 */
function toSteps(payload: unknown): InvestigationStep[] {
  return toList(payload).map(toStep).filter(isPresent)
}

function toStep(payload: unknown, index: number): InvestigationStep | undefined {
  const raw = asRecord(payload)
  const label = pickString(raw, 'label', 'title', 'name')
  if (!label) return undefined

  return {
    id: pickString(raw, 'id', 'key') ?? `step-${index}`,
    label,
    agent: pickString(raw, 'agent', 'agentName', 'owner'),
    status: toStepStatus(raw.status),
    detail: pickString(raw, 'detail', 'description'),
  }
}

/** `status` on a step or a resolution check. Unknown or missing reads as `pending`. */
function toStepStatus(value: unknown): InvestigationStepStatus {
  const status = asString(value)?.toLowerCase().replace(/[\s-]+/g, '_')
  if (status === 'done' || status === 'completed' || status === 'passed') return 'complete'
  if (status === 'running' || status === 'in_progress' || status === 'working') return 'active'
  return STEP_STATUSES.find((known) => known === status) ?? 'pending'
}

/**
 * Progress as a function of who has spoken: a stage is `complete` once its
 * agent has sent an A2A response, `active` once Brain has addressed it (or it
 * has started calling MCP tools), and `pending` before that.
 *
 * Stages never move backwards, so a late tool call from Clara cannot un-complete
 * the Dev stage. Approval stays `active` until a human actually approves - it is
 * the one step no agent can finish.
 */
function deriveSteps(activity: AgentActivity[], resolution?: Resolution): InvestigationStep[] {
  const reported = new Set<string>()
  const engaged = new Set<string>()

  for (const row of activity) {
    engaged.add(row.from)
    engaged.add(row.to)
    if (row.kind === 'response') reported.add(row.from)
  }

  const steps: InvestigationStep[] = PIPELINE.map((stage) => ({
    id: stage.id,
    label: stage.label,
    agent: stage.agent,
    status: stageStatus(stage, reported, engaged, activity.length > 0),
  }))

  // Backfill: anything before a stage that has started must already be done.
  let laterStageStarted = false
  for (let index = steps.length - 1; index >= 0; index--) {
    const step = steps[index]
    if (!step) continue
    if (laterStageStarted) step.status = 'complete'
    else if (step.status !== 'pending') laterStageStarted = true
  }

  if (!resolution) return steps

  return steps.map((step, index) => ({
    ...step,
    status: index === steps.length - 1 && !resolution.approved ? 'active' : 'complete',
  }))
}

function stageStatus(
  stage: PipelineStage,
  reported: Set<string>,
  engaged: Set<string>,
  hasActivity: boolean,
): InvestigationStepStatus {
  // Brain's own classification: done the moment it starts talking to anyone.
  if (!stage.agentId) return hasActivity ? 'complete' : 'active'
  if (reported.has(stage.agentId)) return 'complete'
  return engaged.has(stage.agentId) ? 'active' : 'pending'
}

/**
 * `resolution` on the activity payload:
 * `{ ticketId, summary, rootCause?, checks?: [{ label, status }],
 *    tests?: { passed, total }, pr?: { number, status, title?, url? },
 *    filesChanged?: string[], approved?, approver? }`
 *
 * Returns undefined for `null` or an empty object so the poll loop keeps
 * waiting instead of ending the investigation on a blank card.
 */
function toResolution(payload: unknown, ticketId: string): Resolution | undefined {
  const raw = asRecord(payload)
  const summary = pickString(raw, 'summary', 'message', 'headline')
  const rootCause = pickString(raw, 'rootCause', 'root_cause', 'cause')
  const checks = toChecks(raw.checks)
  const pr = toPullRequest(raw.pr ?? raw.pullRequest)
  const tests = toTestTotals(raw.tests)
  if (!summary && !rootCause && !pr && !tests && checks.length === 0) return undefined

  return {
    ticketId: pickString(raw, 'ticketId', 'ticket_id') ?? ticketId,
    summary: summary ?? 'Your issue has been fixed and is ready for approval.',
    rootCause,
    checks,
    tests,
    pr,
    filesChanged: toStringList(raw.filesChanged ?? raw.files_changed),
    approved: raw.approved === true,
    approver: pickString(raw, 'approver', 'approvedBy'),
  }
}

/** `checks` on a resolution: `[{ label, status }]`. */
function toChecks(payload: unknown): ResolutionCheck[] {
  return toList(payload)
    .map((entry) => {
      const raw = asRecord(entry)
      const label = pickString(raw, 'label', 'title', 'name')
      return label ? { label, status: toStepStatus(raw.status) } : undefined
    })
    .filter(isPresent)
}

/**
 * `tests` on a resolution: `{ passed, total }`.
 *
 * `QaAgentResult` names the same number `tests`, so `{ tests: 47, passed: 47 }`
 * is accepted too and the QA envelope can be forwarded unchanged.
 */
function toTestTotals(payload: unknown): Resolution['tests'] {
  const raw = asRecord(payload)
  const passed = asNumber(raw.passed)
  const total = asNumber(raw.total ?? raw.tests)
  if (passed === undefined && total === undefined) return undefined

  return { passed: passed ?? total ?? 0, total: total ?? passed ?? 0 }
}

/**
 * `pr` on a resolution: `{ number, status: 'created' | 'open' | 'merged', title?, url? }`
 *
 * A PR without a number cannot be linked or labelled, so it is dropped instead
 * of rendering as "PR #NaN".
 */
function toPullRequest(payload: unknown): Resolution['pr'] {
  const raw = asRecord(payload)
  const number = asNumber(raw.number ?? raw.id)
  if (number === undefined) return undefined

  const status = asString(raw.status)?.toLowerCase()

  return {
    number,
    status: status === 'created' || status === 'merged' ? status : 'open',
    title: pickString(raw, 'title', 'name'),
    url: pickString(raw, 'url', 'html_url', 'link'),
  }
}

/**
 * The backend can flip a ticket to `resolved` / `awaiting_approval` before it
 * has a `resolution` object to return. Rather than polling forever, build the
 * card from the agent conversation that is already on screen.
 */
function synthesiseResolution(
  ticketId: string,
  activity: AgentActivity[],
  status: TicketStatus,
): Resolution {
  const lastReport = activity
    .filter((row) => row.via === 'A2A' && row.kind === 'response')
    .slice(-1)[0]

  return {
    ticketId,
    summary: lastReport?.text ?? 'The agent team has finished working on your issue.',
    // Only stages that actually reported: a card titled "Resolution" must not
    // list work no agent did.
    checks: deriveSteps(activity)
      .filter((step) => step.agent !== undefined && step.status === 'complete')
      .map((step) => ({ label: step.label, status: step.status })),
    approved: status === 'resolved',
  }
}

/**
 * `GET /agents`:
 * `[{ id, name, role, capabilities: string[], protocol: 'A2A',
 *    status: 'connected' | 'degraded' | 'offline', tools?, avatar? }]`
 *
 * An agent with no id cannot be addressed over A2A, so it is dropped.
 */
function toAgentDescriptor(payload: unknown): AgentDescriptor | undefined {
  const raw = asRecord(payload)
  const id = pickString(raw, 'id', 'agentId', 'agent_id')
  if (!id) return undefined

  return {
    id,
    name: pickString(raw, 'name', 'title') ?? id,
    role: pickString(raw, 'role', 'description') ?? 'Agent',
    capabilities: toStringList(raw.capabilities ?? raw.skills),
    protocol: 'A2A',
    status: toAgentStatus(raw.status),
    tools: toToolBindings(raw.tools),
    avatar: pickString(raw, 'avatar', 'emoji', 'icon'),
  }
}

/**
 * `status` on an agent. A registry that lists an agent without a status is
 * assumed to be listing a live one; anything unrecognised is reported as
 * `degraded` rather than silently shown as healthy.
 */
function toAgentStatus(value: unknown): AgentDescriptor['status'] {
  const status = asString(value)?.toLowerCase()
  if (status === undefined) return 'connected'
  if (status === 'connected' || status === 'online' || status === 'ready') return 'connected'
  if (status === 'offline' || status === 'disconnected' || status === 'down') return 'offline'
  return 'degraded'
}

/** `tools` on an agent: `[{ server, capabilities: string[] }]` - the MCP side. */
function toToolBindings(payload: unknown): McpToolBinding[] | undefined {
  const bindings = toList(payload, 'tools')
    .map((entry) => {
      const raw = asRecord(entry)
      const server = pickString(raw, 'server', 'name')
      return server
        ? { server, capabilities: toStringList(raw.capabilities ?? raw.tools) }
        : undefined
    })
    .filter(isPresent)

  // The contract omits `tools` for agents that only answer from knowledge.
  return bindings.length > 0 ? bindings : undefined
}

/**
 * `GET /tasks/:id`:
 * `{ task: { taskId, from, to, type, context }, response: { taskId, status, result?, error? } }`
 *
 * A flat envelope carrying both halves at the top level is accepted too - the
 * backend has not settled on which it returns.
 */
function toTaskRecord(payload: unknown): A2ATaskRecord {
  const raw = asRecord(payload)
  return {
    task: toA2ATask(raw.task ?? payload),
    response: toA2AResponse(raw.response ?? payload),
  }
}

/** `POST /a2a/tasks` request half: `{ taskId, from, to, type, context }`. */
function toA2ATask(payload: unknown): A2ATask | undefined {
  const raw = asRecord(payload)
  const taskId = pickString(raw, 'taskId', 'task_id', 'id')
  const type = pickString(raw, 'type')?.toUpperCase()
  if (!taskId && !type) return undefined

  return {
    taskId: taskId ?? '',
    from: pickString(raw, 'from') ?? ORCHESTRATOR_AGENT_ID,
    to: pickString(raw, 'to') ?? ORCHESTRATOR_AGENT_ID,
    type: A2A_TASK_TYPES.find((known) => known === type) ?? 'INVESTIGATE_BUG',
    context: toTaskContext(raw.context),
  }
}

/** `context` on a task envelope: `{ ticketId, customer?, issue?, ...anything }`. */
function toTaskContext(payload: unknown): A2ATaskContext {
  const raw = asRecord(payload)
  return { ...raw, ticketId: pickString(raw, 'ticketId', 'ticket_id') ?? '' }
}

/**
 * `POST /a2a/tasks` response half: `{ taskId, status, result?, error? }`.
 *
 * Returns undefined when the body carries neither - a `202 { ok: true }` means
 * "accepted", not "failed", and must not abort the investigation.
 */
/**
 * True for a 404, so a missing endpoint can be retried elsewhere. Matches the
 * `failed (404 Not Found)` suffix this module's transport produces.
 */
function isNotFound(error: unknown): boolean {
  return error instanceof Error && /\(404\b/.test(error.message)
}

function toA2AResponse(payload: unknown): A2AResponse | undefined {
  const raw = asRecord(payload)
  const taskId = pickString(raw, 'taskId', 'task_id', 'id')
  const status = pickString(raw, 'status')?.toLowerCase()
  if (!taskId && !status) return undefined

  return {
    taskId: taskId ?? '',
    status: A2A_STATUSES.find((known) => known === status) ?? 'pending',
    result: raw.result,
    error: pickString(raw, 'error', 'message'),
  }
}

/**
 * `POST /tickets/:id/approve`: `{ approved, approver, note? }`
 *
 * A 2xx with an unreadable body counts as approval: the endpoint exists only to
 * approve, and the console has already shown the manager what they signed off.
 */
function toApprovalResult(payload: unknown, requestedBy?: string): ApprovalResult {
  const raw = asRecord(payload)
  return {
    approved: raw.approved === undefined ? true : raw.approved === true,
    approver: pickString(raw, 'approver', 'approvedBy') ?? requestedBy ?? 'Manager',
    note: pickString(raw, 'note', 'comment'),
  }
}

/**
 * `POST /messages`: `{ message }`.
 *
 * The fallback text is deliberately honest rather than invented - the widget
 * must never put an answer in Brain's mouth that no agent produced.
 */
function toReply(payload: unknown): BrainReply {
  const raw = asRecord(payload)
  const message =
    (typeof payload === 'string' ? payload : undefined) ??
    pickString(raw, 'message', 'reply', 'text', 'answer')

  return {
    message: message ?? "I couldn't read a reply from support just now. Please try again.",
  }
}

/* ------------------------------------------------------------------ shapes */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Index into an unknown payload without trusting it to be an object. */
function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined
}

/** Numbers arrive as JSON numbers, or as strings from a loosely typed ORM. */
function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined

  const parsed = typeof value === 'string' ? Number(value.trim()) : Number.NaN
  return Number.isFinite(parsed) ? parsed : undefined
}

/** First non-empty string among `keys`, so renamed fields keep working. */
function pickString(source: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(source[key])
    if (value !== undefined) return value
  }
  return undefined
}

/**
 * Accepts either a bare array or the array nested under one of `keys`:
 * "is it `[...]` or `{ items: [...] }`?" is the shape most likely to change.
 */
function toList(payload: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload

  const raw = asRecord(payload)
  for (const key of keys) {
    const value = raw[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function toStringList(value: unknown): string[] {
  return toList(value).filter((entry): entry is string => typeof entry === 'string')
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined
}

function summarise(message?: string): string | undefined {
  const trimmed = message?.trim().replace(/\s+/g, ' ')
  if (!trimmed) return undefined
  return trimmed.length > 72 ? `${trimmed.slice(0, 69)}...` : trimmed
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Investigation aborted', 'AbortError')
}

/** Abort errors are DOMExceptions in the browser and plain Errors in Node. */
function isAbortError(error: unknown): boolean {
  return asString(asRecord(error).name) === 'AbortError'
}
