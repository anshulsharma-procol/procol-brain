import { Router } from 'express'
import type { ActivityType, ArtifactKind, RunState } from '../contract.js'
import { z } from 'zod'
import { createTicket, decide, startRun } from '../brain/orchestrator.js'
import {
  agentView,
  artifactView,
  connectorView,
  runView,
  stageView,
  taskView,
  ticketRowView,
  ticketView,
} from '../brain/contractView.js'
import { agentCard } from '../agents/server.js'
import { describeRegistry } from '../brain/registry.js'
import { store } from '../store.js'
import { PROCESSES } from '../domain/processes.js'
import { ASK_EXAMPLES, answerQuestion } from '../domain/analytics.js'
import { getPlaybook } from '../domain/playbooks.js'
import { CONNECTION_TYPES } from '../domain/connectionTypes.js'
import { WORKSPACES, findAgent, getWorkspace } from '../domain/workspaces.js'
import * as timeline from '../brain/timeline.js'
import { openStream } from './stream.js'
import { fail } from './errors.js'

/**
 * ============================================================================
 *  THE CONTRACT — docs/API_CONTRACT.md §2
 * ============================================================================
 *
 * Base /api. Lists are wrapped in `{ data }`, single objects are bare, errors
 * are `{ error: { code, message } }`, and no stack trace ever reaches a
 * client. Every response body is built by `brain/contractView.ts`, so there is
 * one place to read when asking whether this service conforms.
 *
 * Endpoints below the "extensions" heading are NOT in the contract. They are
 * additive, and every consumer treats them as optional — which is what keeps
 * the promise that pointing the console at another compliant backend is a URL
 * change and nothing more.
 */
/**
 * The enums, as values.
 *
 * `satisfies Record<...>` is what makes these honest: add a member to the
 * contract's union and this stops compiling until it is listed here, so
 * `GET /api/contract` cannot quietly describe a server that has moved on.
 */
const ACTIVITY_TYPES = Object.keys({
  'ticket.created': 0,
  'run.started': 0,
  'run.state': 0,
  'brain.thought': 0,
  'a2a.request': 0,
  'a2a.response': 0,
  'agent.log': 0,
  'artifact.created': 0,
  'run.awaiting_approval': 0,
  'run.completed': 0,
  'agent.status': 0,
  'signal.raised': 0,
} satisfies Record<ActivityType, 0>) as ActivityType[]

const ARTIFACT_KINDS = Object.keys({
  ROOT_CAUSE: 0,
  PR: 0,
  TEST_RESULT: 0,
  CONFIG_FIX: 0,
  CUSTOMER_REPLY: 0,
  IMPACT: 0,
  PROCESS_RESULT: 0,
} satisfies Record<ArtifactKind, 0>) as ArtifactKind[]

/** Names the field actually at fault rather than one generic sentence. */
function describeIssue(error: z.ZodError): string {
  const issue = error.issues[0]
  if (!issue) return 'Invalid request body'
  const path = issue.path.join('.')
  return path ? `${path}: ${issue.message}` : issue.message
}

export function consoleRouter(): Router {
  const router = Router()

  /** Optional tenant scope. A single-tenant backend ignores it. */
  const scopeOf = (value: unknown) =>
    typeof value === 'string' && value ? getWorkspace(value).id : undefined

  // -- tickets ------------------------------------------------------------

  router.get('/tickets', (request, response) => {
    const scope = scopeOf(request.query.workspace)
    const statuses = String(request.query.status ?? '')
      .split(',')
      .map((status) => status.trim())
      .filter(Boolean)

    const tickets = store
      .listTickets(scope)
      .filter((ticket) => statuses.length === 0 || statuses.includes(ticket.status))

    response.json({
      data: tickets.map((ticket) => ticketRowView(ticket, store.runForTicket(ticket.id))),
    })
  })

  const createSchema = z.object({
    customer: z.string().min(1).nullable().optional(),
    title: z.string().min(1).optional(),
    description: z.string().min(1),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    channel: z.enum(['email', 'portal', 'slack', 'signal', 'event']).optional(),
    /** Additive: which control tower, and whether to start the run at once. */
    workspaceId: z.string().optional(),
    investigate: z.boolean().optional(),
  })

  router.post('/tickets', (request, response) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) return fail(response, 400, 'BAD_REQUEST', 'A description is required')

    const input = parsed.data
    const ticket = createTicket({
      workspaceId: input.workspaceId,
      message: input.description,
      title: input.title,
      description: input.description,
      customer: input.customer ?? null,
      priority: input.priority,
      channel: input.channel ?? 'portal',
    })

    if (input.investigate) startRun(ticket.id)
    response.status(201).json(ticketView(store.getTicket(ticket.id) ?? ticket))
  })

  router.get('/tickets/:id', (request, response) => {
    const ticket = store.getTicket(request.params.id)
    if (!ticket) return fail(response, 404, 'NOT_FOUND', `Ticket ${request.params.id} does not exist`)

    const run = store.runForTicket(ticket.id)
    const control = store.getRun(ticket.id)
    const policy = getWorkspace(ticket.workspaceId).approvalPolicies.find(
      (candidate) => candidate.id === control?.approvalPolicyId,
    )

    response.json({
      ticket: ticketView(ticket),
      run: runView(run),
      artifacts: store.getArtifacts(ticket.id).map(artifactView),
      // `required` is false once the decision is in, but the policy stays on
      // the response: the page still has to say which rule stopped this run
      // after it has been approved.
      approval: policy
        ? {
            required: ticket.status === 'AWAITING_APPROVAL',
            policyId: policy.id,
            reason: policy.reason,
          }
        : null,
      signal: store.signalForTicket(ticket.id) ?? null,

      // additive: the stage rail and the person who decided.
      stage: stageView(ticket.stages),
      decision: store.getDecision(ticket.id) ?? null,
    })
  })

  router.get('/tickets/:id/activities', (request, response) => {
    if (!store.getTicket(request.params.id)) {
      return fail(response, 404, 'NOT_FOUND', `Ticket ${request.params.id} does not exist`)
    }
    // The stored rows are the payloads, already in seq order — the store
    // appends and allocates seq on insert. Nothing is reshaped on the way
    // out, which is precisely why this and the stream cannot disagree.
    response.json({ data: store.getActivity(request.params.id) })
  })

  router.get('/tickets/:id/tasks', (request, response) => {
    if (!store.getTicket(request.params.id)) {
      return fail(response, 404, 'NOT_FOUND', `Ticket ${request.params.id} does not exist`)
    }
    response.json({ data: store.listTasks(request.params.id).map(taskView) })
  })

  router.post('/tickets/:id/investigate', (request, response) => {
    const started = startRun(request.params.id)
    if ('error' in started) {
      const missing = started.error.includes('not found')
      return fail(response, missing ? 404 : 409, missing ? 'NOT_FOUND' : 'CONFLICT', started.error)
    }

    // 202 for a new run; 200 when joining the one already in flight, so a
    // double-click on stage is safe and cannot fork a second run. `started`
    // is how the caller tells the two apart without reading the status code.
    response.status(started.joined ? 200 : 202).json({
      runId: started.run.id,
      started: !started.joined,

      // additive
      state: started.run.state,
    })
  })

  const decisionSchema = z.object({
    decision: z.enum(['APPROVE', 'REJECT']),
    note: z.string().optional(),
    /** Additive: who decided. Falls back to a generic approver. */
    by: z.string().optional(),
  })

  router.post('/tickets/:id/decision', (request, response) => {
    const parsed = decisionSchema.safeParse(request.body)
    if (!parsed.success) {
      return fail(response, 400, 'BAD_REQUEST', 'decision must be APPROVE or REJECT')
    }

    const ticket = store.getTicket(request.params.id)
    if (!ticket) return fail(response, 404, 'NOT_FOUND', `Ticket ${request.params.id} does not exist`)

    const result = decide(request.params.id, {
      decision: parsed.data.decision,
      by: parsed.data.by ?? 'Manager',
      note: parsed.data.note,
    })
    if (!result.ok) return fail(response, 409, 'CONFLICT', result.error)

    const after = store.getTicket(request.params.id)!
    const artifacts = store.getArtifacts(after.id)
    const reply = artifacts.find((artifact) => artifact.kind === 'CUSTOMER_REPLY')

    response.json({
      decision: parsed.data.decision,
      ticketStatus: after.status,
      runState: store.runForTicket(after.id)?.state ?? 'RESOLVED',
      // The reply as it actually went out — stamped with when and by whom, so
      // the caller can show the sent message rather than the draft.
      reply: reply ? artifactView(reply) : undefined,

      // additive: the whole record after the decision, so a console repaints
      // the page from this response instead of refetching it.
      ticket: ticketView(after),
      run: runView(store.runForTicket(after.id)),
      artifacts: artifacts.map(artifactView),
    })
  })

  // -- runs ---------------------------------------------------------------

  /**
   * One run, with the tasks it delegated and the states it passed through.
   *
   * `steps` is read back off the audit trail rather than kept as a second
   * list, so the state history and the timeline are the same record and
   * cannot contradict each other.
   */
  router.get('/runs/:runId', (request, response) => {
    const run = store.getRunRecord(request.params.runId)
    if (!run) return fail(response, 404, 'NOT_FOUND', `No run ${request.params.runId}`)

    const steps = store
      .getActivity(run.ticketId)
      .filter((row) => row.type === 'run.state' && row.runId === run.id)
      .map((row) => ({ id: row.id, state: row.state as RunState, at: row.at }))

    response.json({
      run: runView(run)!,
      tasks: store.listTasks(run.ticketId).map(taskView),
      steps,
    })
  })

  // -- the registry -------------------------------------------------------

  /**
   * Who can do what.
   *
   * This is the routing table the orchestrator actually consults: it asks the
   * registry which agent declares a capability, never which agent it knows by
   * name. Serving it is what lets a reader check that claim.
   */
  router.get('/agents/capabilities', (request, response) => {
    const scope = scopeOf(request.query.workspace)
    const byCapability = new Map<string, string[]>()

    for (const agent of describeRegistry()) {
      if (scope && agent.workspaceId !== scope) continue
      for (const capability of agent.capabilities) {
        byCapability.set(capability, [...(byCapability.get(capability) ?? []), agent.id])
      }
    }

    response.json({
      data: [...byCapability.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([capability, agentIds]) => ({ capability, agentIds })),
    })
  })

  router.get('/agents', (request, response) => {
    const scope = scopeOf(request.query.workspace)
    response.json({
      data: describeRegistry()
        .filter((agent) => !scope || agent.workspaceId === scope)
        .map((agent) => agentView(agent, store.tasksTodayFor(agent.id))),
    })
  })

  router.get('/agents/:id', (request, response) => {
    for (const workspace of WORKSPACES) {
      const agent = findAgent(workspace, request.params.id)
      if (!agent) continue

      return response.json({
        // Served verbatim, exactly as the agent published it. Normalising it
        // would defeat the point of the screen that shows it.
        card: agentCard(agent, workspace),
        recentTasks: store.recentTasksFor(agent.id).map(taskView),

        // additive: the registry's own view, which carries the role and the
        // task count the card does not.
        agent: agentView(agent, store.tasksTodayFor(agent.id)),
      })
    }

    return fail(response, 404, 'NOT_FOUND', `No agent ${request.params.id}`)
  })

  /**
   * The contract's connector registry. A connection carries the four fields
   * the contract names plus everything the Connections screen needs, all of
   * it additive — a client that only knows the contract sees four fields and
   * renders a perfectly usable card from them.
   */
  router.get('/connectors', (request, response) => {
    const scope = scopeOf(request.query.workspace) ?? WORKSPACES[0]!.id
    response.json({ data: store.listConnections(scope).map(connectorView) })
  })

  // -- aggregates ---------------------------------------------------------

  router.get('/stats', (request, response) => {
    response.json(store.contractStats(scopeOf(request.query.workspace)))
  })

  router.get('/insights', (request, response) => {
    const ticketId = String(request.query.ticketId ?? '')
    const ticket = store.getTicket(ticketId)
    if (!ticket) return fail(response, 404, 'NOT_FOUND', `Ticket ${ticketId} does not exist`)

    const impact = store.getArtifacts(ticketId).find((artifact) => artifact.kind === 'IMPACT')
    const run = store.getRun(ticketId)
    const trend = run ? (getPlaybook(run.playbookId).impact?.trend ?? []) : []

    if (!impact) return fail(response, 404, 'NOT_FOUND', `No impact recorded for ${ticketId}`)

    response.json({
      affectedTenants: Number(impact.data.affectedTenants),
      affectedRecords: Number(impact.data.affectedRecords),
      firstSeen: String(impact.data.firstSeen),
      trend,
      // The query the number came from. A figure with its SQL attached is
      // evidence; the same figure on its own is something a reader assumes
      // was invented.
      sql: String(impact.data.sql ?? ''),
    })
  })

  /** Questions this deployment can answer, for an empty Lens screen. */
  router.get('/ask/examples', (_request, response) => {
    response.json({ data: ASK_EXAMPLES })
  })

  const askSchema = z.object({ question: z.string().min(1) })

  router.post('/ask', (request, response) => {
    const parsed = askSchema.safeParse(request.body)
    if (!parsed.success) return fail(response, 400, 'BAD_REQUEST', 'A question is required')
    response.json(answerQuestion(parsed.data.question))
  })

  // -- signals ------------------------------------------------------------

  const signalSchema = z.object({
    source: z.string().min(1),
    kind: z.string().min(1),
    summary: z.string().min(1),
    metrics: z.record(z.unknown()).default({}),
    escalate: z.boolean().optional(),
    workspaceId: z.string().optional(),
  })

  /** Everything monitoring has raised, newest first. */
  router.get('/signals', (_request, response) => {
    response.json({ data: store.listSignals() })
  })

  router.post('/signals', (request, response) => {
    const parsed = signalSchema.safeParse(request.body)
    if (!parsed.success) return fail(response, 400, 'BAD_REQUEST', 'source, kind and summary are required')

    const input = parsed.data
    const signal = store.addSignal({
      source: input.source,
      kind: input.kind,
      summary: input.summary,
      metrics: input.metrics,
    })

    if (!input.escalate) return response.status(201).json({ signal, ticket: null })

    // A signal nobody raised still becomes a ticket, and the run starts
    // itself. That is the case where the customer is told before they notice.
    const ticket = createTicket({
      workspaceId: input.workspaceId,
      message: input.summary,
      customer: null,
      channel: 'signal',
      priority: 'CRITICAL',
      reportedBy: input.source,
    })

    store.attachSignal(signal.id, ticket.id)
    timeline.signalRaised(ticket.id, { ...signal, ticketId: ticket.id })
    startRun(ticket.id)

    response.status(201).json({ signal: { ...signal, ticketId: ticket.id }, ticket: ticketView(ticket) })
  })

  // -- policies -----------------------------------------------------------

  /**
   * The approval rules, in the words they are rendered in above the buttons.
   *
   * A rule nobody can read is not governance, which is the whole argument for
   * serving these rather than hard-coding the gate.
   */
  router.get('/policies', (request, response) => {
    const scope = scopeOf(request.query.workspace)
    const workspaces = scope ? [getWorkspace(scope)] : WORKSPACES

    response.json({
      data: workspaces.flatMap((workspace) =>
        workspace.approvalPolicies.map((policy) => ({
          id: policy.id,
          reason: policy.reason,

          // additive
          workspaceId: workspace.id,
          appliesTo: policy.appliesTo,
          risk: policy.risk,
        })),
      ),
    })
  })

  // -- the contract itself ------------------------------------------------

  /**
   * What this server actually serves.
   *
   * The contract names `GET /api/contract` as the authority when a written
   * document and a running server disagree, and the reason is worth stating:
   * a frontend integrating against a backend it cannot read needs one request
   * that answers "which endpoints exist here, and what does this deployment
   * add". The `extensions` list is the honest half — those are ours, a
   * compliant backend serves none of them, and a client that depends on one
   * has quietly stopped being portable.
   */
  router.get('/contract', (_request, response) => {
    response.json({
      version: '1.0.0',
      endpoints: [
        'GET    /api/tickets',
        'POST   /api/tickets',
        'GET    /api/tickets/:id',
        'GET    /api/tickets/:id/activities',
        'GET    /api/tickets/:id/tasks',
        'POST   /api/tickets/:id/investigate',
        'POST   /api/tickets/:id/decision',
        'GET    /api/tickets/:id/stream',
        'GET    /api/runs/:runId',
        'GET    /api/agents',
        'GET    /api/agents/capabilities',
        'GET    /api/agents/:id',
        'GET    /api/connectors',
        'GET    /api/stats',
        'GET    /api/insights?ticketId=',
        'POST   /api/ask',
        'GET    /api/ask/examples',
        'GET    /api/signals',
        'POST   /api/signals',
        'GET    /api/policies',
        'GET    /api/processes',
        'POST   /api/processes/:key/run',
        'GET    /api/stream',
      ],
      extensions: [
        'GET    /api/workspaces',
        'GET    /api/memory',
        'POST   /api/memory/search',
        'GET    /api/knowledge',
        'GET    /api/connection-types',
        'POST   /api/connectors',
        'POST   /api/connectors/:id/reconnect',
        'DELETE /api/connectors/:id',
        'POST   /api/demo/reset',
        'POST   /api/demo/simulate',
      ],
      activityTypes: ACTIVITY_TYPES,
      artifactKinds: ARTIFACT_KINDS,
      /** Query parameter accepted on every list endpoint. Ignored if absent. */
      tenancy: { query: 'workspace', workspaces: WORKSPACES.map((w) => w.id) },
    })
  })

  // -- processes ----------------------------------------------------------

  router.get('/processes', (_request, response) => {
    response.json({ data: PROCESSES })
  })

  router.post('/processes/:key/run', (request, response) => {
    const definition = PROCESSES.find((process) => process.key === request.params.key)
    if (!definition) return fail(response, 404, 'NOT_FOUND', `No process ${request.params.key}`)

    const input = (request.body?.input ?? {}) as Record<string, unknown>
    const ticket = createTicket({
      workspaceId: typeof input.workspaceId === 'string' ? input.workspaceId : undefined,
      message: `${definition.name}: ${JSON.stringify(input)}`,
      title: definition.name,
      description: `Triggered by a business event. ${definition.name}.`,
      customer: typeof input.customer === 'string' ? input.customer : null,
      channel: 'event',
      processKey: definition.key,
    })

    const started = startRun(ticket.id)
    response.status(202).json({
      ticketId: ticket.id,
      runId: 'error' in started ? '' : started.run.id,
      started: !('error' in started),
      processKey: definition.key,
    })
  })

  // -- streams ------------------------------------------------------------

  router.get('/stream', (request, response) => {
    const scope = scopeOf(request.query.workspace)
    openStream(response, (event) => !scope || !event.workspaceId || event.workspaceId === scope)
  })

  router.get('/tickets/:id/stream', (request, response) => {
    const id = request.params.id
    openStream(response, (event) => event.type === 'activity' && event.ticketRef === id)
  })

  // =======================================================================
  //  EXTENSIONS — not in the contract; optional for any client
  // =======================================================================

  /** The five things a company can plug in, and what each one asks for. */
  router.get('/connection-types', (_request, response) => {
    response.json({ data: CONNECTION_TYPES })
  })

  const addConnectionSchema = z.object({
    name: z.string().min(1),
    category: z.enum(['agent', 'mcp', 'database', 'saas', 'knowledge']),
    description: z.string().optional(),
    endpoint: z.string().optional(),
    logo: z.string().optional(),
    workspaceId: z.string().optional(),
  })

  router.post('/connectors', (request, response) => {
    const parsed = addConnectionSchema.safeParse(request.body)
    if (!parsed.success) {
      return fail(response, 400, 'BAD_REQUEST', describeIssue(parsed.error))
    }

    const workspaceId = getWorkspace(parsed.data.workspaceId).id
    response.status(201).json(store.addConnection(workspaceId, parsed.data))
  })

  router.post('/connectors/:id/reconnect', (request, response) => {
    const workspaceId = getWorkspace(String(request.query.workspace ?? '')).id
    const reconnected = store.reconnect(workspaceId, request.params.id)
    if (!reconnected) return fail(response, 404, 'NOT_FOUND', `No connection ${request.params.id}`)
    response.json(reconnected)
  })

  router.delete('/connectors/:id', (request, response) => {
    const workspaceId = getWorkspace(String(request.query.workspace ?? '')).id
    if (!store.removeConnection(workspaceId, request.params.id)) {
      return fail(response, 404, 'NOT_FOUND', `No connection ${request.params.id}`)
    }
    response.status(204).end()
  })

  router.get('/workspaces', (_request, response) => {
    response.json({
      data: WORKSPACES.map((workspace) => ({
        id: workspace.id,
        name: workspace.name,
        product: workspace.product,
        ticketPrefix: workspace.ticketPrefix,
        tagline: workspace.tagline,
        accent: workspace.accent,
      })),
    })
  })

  router.get('/memory', (request, response) => {
    response.json({ data: store.listMemory(getWorkspace(String(request.query.workspace ?? '')).id) })
  })

  router.post('/memory/search', (request, response) => {
    const query = String(request.body?.query ?? '')
    if (!query) return fail(response, 400, 'BAD_REQUEST', 'A query is required')
    response.json({
      data: store.searchMemory(getWorkspace(String(request.query.workspace ?? '')).id, query),
    })
  })

  router.get('/knowledge', (request, response) => {
    response.json({
      data: store.listKnowledge(getWorkspace(String(request.query.workspace ?? '')).id),
    })
  })

  return router
}
