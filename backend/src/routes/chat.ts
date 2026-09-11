import { Router } from 'express'
import { z } from 'zod'
import { classify, resolveWorkspace } from '../brain/classify.js'
import { createTicket, decide, startRun } from '../brain/orchestrator.js'
import { widgetAgent, widgetProgress, widgetTicket } from '../brain/project.js'
import { describeRegistry } from '../brain/registry.js'
import { store } from '../store.js'
import { getWorkspace } from '../domain/workspaces.js'
import { fail } from './errors.js'

/**
 * ============================================================================
 *  THE CUSTOMER-FACING API
 * ============================================================================
 *
 * What the embeddable chat widget calls from inside a client's own dashboard
 * (docs/BACKEND_API_CONTRACT.md). Mounted under `/api/chat` so it can keep its
 * own vocabulary without colliding with the console's.
 *
 * The important thing about this file is what it does *not* do: there is no
 * separate ticket table, no sync job and no mirroring. A customer writing in
 * their own dashboard calls `createTicket` — the same function the console
 * calls — so the ticket is on our board before the reply finishes rendering,
 * and every step after that is visible on both sides at once.
 */

const identity = z.object({
  companyId: z.string().optional(),
  userId: z.string().optional(),
})

const context = z
  .object({
    currentPage: z.string().optional(),
    currentModule: z.string().optional(),
    recordId: z.string().optional(),
  })
  .passthrough()

const messageBody = z.object({
  message: z.string().min(1),
  identity: identity.optional(),
  context: context.optional(),
})

export function chatRouter(): Router {
  const router = Router()

  // -- institutional memory, before any work is started -------------------

  /**
   * The first thing that happens to a customer's sentence. If this control
   * tower has solved it before, the customer gets the answer in seconds and
   * no agent is woken at all — which is the entire return on the memory.
   */
  router.post('/issues/search', (request, response) => {
    const parsed = messageBody.safeParse(request.body)
    if (!parsed.success) return fail(response, 400, 'bad_request', 'A message is required')

    const workspace = resolveWorkspace(parsed.data.identity?.companyId)
    const matches = store.searchMemory(workspace.id, parsed.data.message)

    response.json(
      matches.map((match) => ({
        id: match.entry.id,
        reference: match.entry.sourceTicketRef,
        title: match.entry.title,
        customer: '',
        solution: match.entry.resolution,
        confidence: match.confidence,
      })),
    )
  })

  // -- raising a ticket ---------------------------------------------------

  router.post('/tickets', (request, response) => {
    const parsed = messageBody.safeParse(request.body)
    if (!parsed.success) return fail(response, 400, 'bad_request', 'A message is required')

    const { message, identity: who, context: where } = parsed.data

    const ticket = createTicket({
      workspaceId: who?.companyId,
      message,
      channel: 'chat',
      origin: {
        userId: who?.userId,
        page: where?.currentPage,
        module: where?.currentModule,
        recordId: where?.recordId,
      },
    })

    response.status(201).json(widgetTicket(ticket))
  })

  router.get('/tickets', (request, response) => {
    const workspace = resolveWorkspace(
      typeof request.query.companyId === 'string' ? request.query.companyId : undefined,
    )
    response.json(store.listTickets(workspace.id).map(widgetTicket))
  })

  router.get('/tickets/:ref', (request, response) => {
    const ticket = store.getTicket(request.params.ref)
    if (!ticket) return fail(response, 404, 'not_found', 'No such ticket')
    response.json(widgetTicket(ticket))
  })

  // -- the run ------------------------------------------------------------

  router.post('/tickets/:ref/investigate', (request, response) => {
    const ticket = store.getTicket(request.params.ref)
    if (!ticket) return fail(response, 404, 'not_found', 'No such ticket')

    const started = startRun(ticket.reference)
    if ('error' in started) return fail(response, 409, 'conflict', started.error)

    response.status(202).json(started)
  })

  /**
   * The widget polls this while a run is in flight. It is a projection of the
   * same audit trail the console renders, so the customer and the support team
   * are never looking at different versions of what happened.
   */
  router.get('/tickets/:ref/activity', (request, response) => {
    const detail = store.getDetail(request.params.ref)
    if (!detail) return fail(response, 404, 'not_found', 'No such ticket')
    response.json(widgetProgress(detail))
  })

  /** Live updates for a widget that would rather stream than poll. */
  router.get('/tickets/:ref/stream', (request, response) => {
    const ref = request.params.ref
    void ref
    response.status(501).json({
      error: {
        code: 'not_implemented',
        message: 'The widget polls /activity. The console stream is at /api/tickets/:ref/stream.',
      },
    })
  })

  // -- approval, for a console embedded in the client's own dashboard -----

  const approveBody = z.object({ approver: z.string().optional(), note: z.string().optional() })

  router.post('/tickets/:ref/approve', (request, response) => {
    const parsed = approveBody.safeParse(request.body ?? {})
    const approver = (parsed.success ? parsed.data.approver : undefined) ?? 'Manager'

    const result = decide(request.params.ref, {
      outcome: 'APPROVED',
      by: approver,
      note: parsed.success ? parsed.data.note : undefined,
    })

    if (!result.ok) return fail(response, 409, 'conflict', result.error)

    const detail = store.getDetail(request.params.ref)
    response.json({
      approved: true,
      approver,
      ticketId: request.params.ref,
      resolution: detail ? widgetProgress(detail).resolution : undefined,
    })
  })

  // -- questions that are not tickets -------------------------------------

  /**
   * A message that is a question rather than a problem. Brain answers from
   * memory or from the documentation this control tower holds, and says
   * plainly when it does not know — which is worth more than a confident
   * paragraph of invention.
   */
  router.post('/messages', (request, response) => {
    const parsed = messageBody.safeParse(request.body)
    if (!parsed.success) return fail(response, 400, 'bad_request', 'A message is required')

    const workspace = resolveWorkspace(parsed.data.identity?.companyId)
    const { playbook, recognised } = classify({
      message: parsed.data.message,
      workspaceId: workspace.id,
    })

    if (recognised && playbook.answer) {
      response.json({ message: playbook.answer.detail.join('\n\n') })
      return
    }

    const [best] = store.searchMemory(workspace.id, parsed.data.message)
    if (best && best.confidence > 0.5) {
      response.json({
        message: `We have seen this before on ${best.entry.sourceTicketRef}: ${best.entry.resolution}\n\nIf that does not match what you are seeing, tell me and I will start a fresh investigation.`,
      })
      return
    }

    response.json({
      message:
        'I do not have an answer to that from what this workspace has recorded. Describe what you are seeing and I will open a ticket and put the agents on it.',
    })
  })

  // -- the registry, so a client can see who would touch their data -------

  router.get('/agents', (request, response) => {
    const companyId = typeof request.query.companyId === 'string' ? request.query.companyId : undefined
    const workspaceId = getWorkspace(companyId).id

    response.json(
      describeRegistry()
        .filter((agent) => agent.workspaceId === workspaceId)
        .map(widgetAgent),
    )
  })

  router.get('/tasks/:taskId', (request, response) => {
    const record = store.getTask(request.params.taskId)
    if (!record) return fail(response, 404, 'not_found', 'No such task')
    response.json({ task: record.task, response: record.response })
  })

  return router
}
