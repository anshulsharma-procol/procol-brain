import { Router } from 'express'
import { z } from 'zod'
import { createTicket, decide, startRun } from '../brain/orchestrator.js'
import { describeRegistry } from '../brain/registry.js'
import { store } from '../store.js'
import { WORKSPACES, getWorkspace } from '../domain/workspaces.js'
import { openStream } from './stream.js'
import { fail } from './errors.js'

/**
 * The internal console's API — see docs/CONSOLE_API_CONTRACT.md.
 *
 * Lists answer `{ data }`, errors answer `{ error: { code, message } }`, and
 * no stack trace ever reaches a screen.
 */
export function consoleRouter(): Router {
  const router = Router()

  // -- workspaces ---------------------------------------------------------

  router.get('/workspaces', (_request, response) => {
    response.json({ data: WORKSPACES })
  })

  router.get('/workspaces/:id', (request, response) => {
    response.json(getWorkspace(request.params.id))
  })

  router.get('/workspaces/:id/stats', (request, response) => {
    response.json(store.stats(getWorkspace(request.params.id).id))
  })

  router.get('/workspaces/:id/tickets', (request, response) => {
    const workspaceId = getWorkspace(request.params.id).id
    const statuses = String(request.query.status ?? '')
      .split(',')
      .map((status) => status.trim())
      .filter(Boolean)

    const tickets = store.listTickets(workspaceId)
    response.json({
      data: statuses.length ? tickets.filter((ticket) => statuses.includes(ticket.status)) : tickets,
    })
  })

  router.get('/workspaces/:id/memory', (request, response) => {
    response.json({ data: store.listMemory(getWorkspace(request.params.id).id) })
  })

  const searchSchema = z.object({ query: z.string().min(1) })

  router.post('/workspaces/:id/memory/search', (request, response) => {
    const parsed = searchSchema.safeParse(request.body)
    if (!parsed.success) return fail(response, 400, 'bad_request', 'A query is required')

    response.json(store.searchMemory(getWorkspace(request.params.id).id, parsed.data.query))
  })

  router.get('/workspaces/:id/knowledge', (request, response) => {
    response.json({ data: store.listKnowledge(getWorkspace(request.params.id).id) })
  })

  // -- the registry -------------------------------------------------------

  router.get('/agents', (_request, response) => {
    response.json({ data: describeRegistry() })
  })

  router.get('/connectors', (_request, response) => {
    response.json({
      data: WORKSPACES.flatMap((workspace) =>
        workspace.connectors.map((connector) => ({ ...connector, workspaceId: workspace.id })),
      ),
    })
  })

  // -- tickets ------------------------------------------------------------

  const createSchema = z.object({
    workspaceId: z.string().optional(),
    title: z.string().min(1).optional(),
    description: z.string().min(1),
    customer: z.string().min(1).optional(),
    reportedBy: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
    channel: z.enum(['chat', 'email', 'portal', 'signal', 'event']).optional(),
    /** Start the run immediately. The console's raise-a-ticket form does. */
    investigate: z.boolean().optional(),
  })

  router.post('/tickets', (request, response) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return fail(response, 400, 'bad_request', 'A description is required')
    }

    const input = parsed.data
    const ticket = createTicket({
      workspaceId: input.workspaceId,
      message: input.description,
      title: input.title,
      description: input.description,
      customer: input.customer,
      reportedBy: input.reportedBy,
      priority: input.priority,
      channel: input.channel ?? 'portal',
    })

    if (input.investigate) startRun(ticket.reference)
    response.status(201).json(ticket)
  })

  router.get('/tickets/:ref', (request, response) => {
    const detail = store.getDetail(request.params.ref)
    if (!detail) return fail(response, 404, 'not_found', `Ticket ${request.params.ref} not found`)
    response.json(detail)
  })

  router.get('/tickets/:ref/tasks', (request, response) => {
    response.json({ data: store.listTasks(request.params.ref) })
  })

  router.post('/tickets/:ref/investigate', (request, response) => {
    const ticket = store.getTicket(request.params.ref)
    if (!ticket) return fail(response, 404, 'not_found', `Ticket ${request.params.ref} not found`)

    // Idempotent: a second POST while a run is active joins it instead of
    // forking one. Someone always double-clicks on stage.
    const started = startRun(ticket.reference)
    if ('error' in started) return fail(response, 409, 'conflict', started.error)

    response.status(202).json(started)
  })

  const decisionSchema = z.object({
    outcome: z.enum(['APPROVED', 'REJECTED']),
    by: z.string().min(1),
    note: z.string().optional(),
  })

  router.post('/tickets/:ref/decision', (request, response) => {
    const parsed = decisionSchema.safeParse(request.body)
    if (!parsed.success) {
      return fail(response, 400, 'bad_request', 'outcome and by are required')
    }

    const result = decide(request.params.ref, parsed.data)
    if (!result.ok) return fail(response, 409, 'conflict', result.error)

    response.json(store.getDetail(request.params.ref))
  })

  // -- streams ------------------------------------------------------------

  router.get('/tickets/:ref/stream', (request, response) => {
    const ref = request.params.ref
    openStream(response, (event) => event.type === 'ticket.updated' && event.ticketRef === ref)
  })

  router.get('/workspaces/:id/stream', (request, response) => {
    const workspaceId = getWorkspace(request.params.id).id
    openStream(response, (event) => event.workspaceId === workspaceId)
  })

  /** Everything, for a wall display or a debugging tab. */
  router.get('/stream', (_request, response) => {
    openStream(response, () => true)
  })

  return router
}
