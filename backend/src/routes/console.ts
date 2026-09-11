import { Router } from 'express'
import { z } from 'zod'
import { createTicket, decide, startRun } from '../brain/orchestrator.js'
import {
  activityView,
  agentView,
  artifactView,
  connectorView,
  runView,
  taskView,
  ticketRowView,
  ticketView,
} from '../brain/contractView.js'
import { agentCard } from '../agents/server.js'
import { describeRegistry } from '../brain/registry.js'
import { store } from '../store.js'
import { PROCESSES } from '../domain/processes.js'
import { answerQuestion } from '../domain/analytics.js'
import { getPlaybook } from '../domain/playbooks.js'
import { CONNECTION_TYPES } from '../domain/connectionTypes.js'
import { WORKSPACES, findAgent, getWorkspace } from '../domain/workspaces.js'
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

    const artifacts = store.getArtifacts(ticket.id)
    const impact = artifacts.find((artifact) => artifact.kind === 'IMPACT')

    response.json({
      ticket: ticketView(ticket),
      run: runView(store.runForTicket(ticket.id)),
      artifacts: artifacts.map(artifactView),
      insight: impact
        ? {
            affectedTenants: Number(impact.data.affectedTenants),
            affectedRecords: Number(impact.data.affectedRecords),
          }
        : null,
    })
  })

  router.get('/tickets/:id/activities', (request, response) => {
    if (!store.getTicket(request.params.id)) {
      return fail(response, 404, 'NOT_FOUND', `Ticket ${request.params.id} does not exist`)
    }
    // Already in seq order: the store appends, and seq is allocated on insert.
    response.json({ data: store.getActivity(request.params.id).map(activityView) })
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
    // double-click on stage is safe and cannot fork a second run.
    response
      .status(started.joined ? 200 : 202)
      .json({ runId: started.run.id, state: started.run.state })
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
    response.json({
      ticket: ticketView(after),
      run: runView(store.runForTicket(after.id)),
      artifacts: store.getArtifacts(after.id).map(artifactView),
    })
  })

  // -- the registry -------------------------------------------------------

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
        agent: agentView(agent, store.tasksTodayFor(agent.id)),
        // Served verbatim, exactly as the agent published it. Normalising it
        // would defeat the point of the screen that shows it.
        card: agentCard(agent, workspace),
        recentTasks: store.recentTasksFor(agent.id).map(taskView),
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
    })
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
    startRun(ticket.id)

    response.status(201).json({ signal: { ...signal, ticketId: ticket.id }, ticket: ticketView(ticket) })
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
    })
  })

  // -- streams ------------------------------------------------------------

  router.get('/stream', (request, response) => {
    const scope = scopeOf(request.query.workspace)
    openStream(response, (event) => !scope || event.workspaceId === scope)
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
