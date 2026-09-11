import { createTicket, decide, runToCompletion } from './brain/orchestrator.js'
import { store } from './store.js'

/**
 * ============================================================================
 *  SEEDING
 * ============================================================================
 *
 * The board a demo opens on. Every seeded ticket is produced by running the
 * real orchestrator against the real agents with the clock removed
 * (`speed: 0`) — so the seeded state is not a second, hand-written version of
 * what a run looks like. If a run would produce it, the seed has it; if the
 * orchestrator changes, the seed changes with it.
 *
 * Two tickets are deliberately left untouched, because a board where
 * everything has already been worked does not look like a real morning.
 */
export async function seed(): Promise<void> {
  store.reset()

  // -- Procol -------------------------------------------------------------

  const gst = createTicket({
    id: 'PRO-1245',
    workspaceId: 'procol',
    message:
      'Our March invoices are showing GST of 12% instead of 18%. The discount looks right but the tax is wrong on every PO raised this month. This is holding up our payment run.',
    customer: 'ABC Corp',
    reportedBy: 'John Doe · Finance',
    channel: 'portal',
  })
  await runToCompletion(gst.id, { speed: 0 })

  const auction = createTicket({
    id: 'PRO-1238',
    workspaceId: 'procol',
    message:
      'We invited Sharma Steels to the MS Plate auction but they say nothing shows in their dashboard. The auction closes Friday and we need them bidding before then.',
    customer: 'XYZ Metals',
    reportedBy: 'Rahul Menon · Sourcing',
    channel: 'portal',
  })
  await runToCompletion(auction.id, { speed: 0 })

  // A question, answered and closed without an approval gate.
  const howto = createTicket({
    id: 'PRO-1251',
    workspaceId: 'procol',
    message: 'How do I extend an auction deadline once it is already live?',
    customer: 'Kanti Metals',
    reportedBy: 'Buyer',
    channel: 'portal',
  })
  await runToCompletion(howto.id, { speed: 0 })

  // Raised by monitoring and not yet touched: the board's "nobody has looked
  // at this" row, and the one to open when showing a run from the beginning.
  createTicket({
    id: 'PRO-1242',
    workspaceId: 'procol',
    title: 'PO approval webhook failing',
    message:
      '143 PO approval webhook deliveries failed across 6 tenants since 02:14. No customer has reported it yet.',
    customer: 'Detected by monitoring',
    reportedBy: 'Monitoring',
    channel: 'signal',
    priority: 'CRITICAL',
  })

  // -- AcmeCloud ----------------------------------------------------------

  const auth = createTicket({
    id: 'ACME-7821',
    workspaceId: 'acmecloud',
    message:
      'Since yesterday’s deployment, all our users are getting 401 Unauthorized when trying to log into AcmeCloud. Nothing changed on our side.',
    customer: 'XYZ Corp',
    reportedBy: 'Priya Raman · IT Operations',
    channel: 'portal',
  })
  await runToCompletion(auth.id, { speed: 0 })

  // Already closed, so the tower has a resolved run and a reused memory.
  const webhook = createTicket({
    id: 'ACME-7804',
    workspaceId: 'acmecloud',
    message:
      'Our webhook endpoint stopped receiving events for tenant northwind. We are not getting any error, the deliveries just stop.',
    customer: 'Northwind Ltd',
    reportedBy: 'Platform team',
    channel: 'email',
  })
  await runToCompletion(webhook.id, { speed: 0 })
  decide(webhook.id, {
    decision: 'APPROVE',
    by: 'Dana Whitfield',
    note: 'Budget raised and deliveries replayed. Alert added.',
  })

  createTicket({
    id: 'ACME-7833',
    workspaceId: 'acmecloud',
    title: 'CSV export missing the last column',
    message: 'The CSV export is missing the last column when we download more than 500 rows.',
    customer: 'XYZ Corp',
    reportedBy: 'Reporting team',
    channel: 'portal',
    priority: 'LOW',
  })

  const procol = store.stats('procol')
  const acme = store.stats('acmecloud')
  console.log(
    `[seed] procol: ${procol.activeTickets} active, ${procol.awaitingApproval} at the gate · ` +
      `acmecloud: ${acme.activeTickets} active, ${acme.awaitingApproval} at the gate`,
  )
}
