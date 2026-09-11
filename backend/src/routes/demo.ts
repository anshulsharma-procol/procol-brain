import { Router } from 'express'
import { z } from 'zod'
import { createTicket, startRun } from '../brain/orchestrator.js'
import { seed } from '../seed.js'
import { store } from '../store.js'
import { PLAYBOOKS } from '../domain/playbooks.js'
import { fail } from './errors.js'

/**
 * Demo controls. Not glamorous, and the difference between a rehearsal you
 * can repeat and one you cannot.
 */
export function demoRouter(): Router {
  const router = Router()

  /** Back to the opening board, in under a second. Use it between run-throughs. */
  router.post('/reset', async (_request, response) => {
    await seed()
    response.json({
      ok: true,
      workspaces: ['procol', 'acmecloud'].map((id) => ({ id, stats: store.stats(id) })),
    })
  })

  /** What this deployment can currently handle, and the words that route to it. */
  router.get('/playbooks', (_request, response) => {
    response.json({
      data: PLAYBOOKS.map((playbook) => ({
        id: playbook.id,
        workspaceId: playbook.workspaceId,
        title: playbook.ticket.title,
        path: playbook.path,
        priority: playbook.ticket.priority,
        matches: [...(playbook.match.strong ?? []), ...playbook.match.terms],
      })),
    })
  })

  const simulateBody = z.object({
    workspaceId: z.string().optional(),
    message: z.string().min(1),
    customer: z.string().optional(),
    /** Leave false to create the ticket and start it by hand from the console. */
    investigate: z.boolean().default(true),
  })

  /**
   * Raise a ticket exactly as a customer's chat would, without a browser.
   * This is what to curl when rehearsing: it proves the whole path from a
   * client dashboard to our board with one command.
   */
  router.post('/simulate', (request, response) => {
    const parsed = simulateBody.safeParse(request.body)
    if (!parsed.success) return fail(response, 400, 'bad_request', 'A message is required')

    const ticket = createTicket({
      workspaceId: parsed.data.workspaceId,
      message: parsed.data.message,
      customer: parsed.data.customer,
      channel: 'chat',
    })

    if (parsed.data.investigate) startRun(ticket.reference)


    response.status(201).json({
      ticket,
      watch: {
        console: `/api/tickets/${ticket.reference}`,
        stream: `/api/tickets/${ticket.reference}/stream`,
        chat: `/api/chat/tickets/${ticket.reference}/activity`,
      },
    })
  })

  return router
}
