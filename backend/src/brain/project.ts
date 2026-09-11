import type { Artifact, Stage, Ticket, TicketDetail } from '../domain/types.js'
import { findAgent, getWorkspace } from '../domain/workspaces.js'

/**
 * Projections into the customer-facing chat widget's contract
 * (docs/BACKEND_API_CONTRACT.md).
 *
 * The console and the widget read the same store; this file is the only place
 * that knows their vocabularies differ. The widget speaks of a five-stage
 * pipeline and a `resolution`; the console speaks of stages and artifacts.
 * Neither has to learn the other's words, and the customer sees the same run
 * the internal team is watching.
 */

/** The widget's four ticket statuses. */
export function widgetStatus(status: Ticket['status']): string {
  switch (status) {
    case 'NEW':
      return 'open'
    case 'INVESTIGATING':
      return 'investigating'
    case 'AWAITING_APPROVAL':
      return 'awaiting_approval'
    case 'RESOLVED':
      return 'resolved'
    default:
      // Rejected and needs-a-human are both "a person has it now", which for
      // the customer is still an open ticket rather than a resolved one.
      return 'open'
  }
}

export function widgetTicket(ticket: Ticket) {
  return {
    id: ticket.reference,
    reference: ticket.reference,
    title: ticket.title,
    status: widgetStatus(ticket.status),
    createdAt: ticket.createdAt,
    customer: ticket.customer,
    priority: ticket.priority,
  }
}

/** Stage ids the widget's pipeline uses, in its order. */
const WIDGET_STEPS: { id: string; label: string; from?: Stage['id'] }[] = [
  { id: 'understand', label: 'Understanding the issue' },
  { id: 'context', label: 'Fetching product context', from: 'context' },
  { id: 'code', label: 'Investigating code', from: 'investigate' },
  { id: 'validate', label: 'Running validation', from: 'verify' },
  { id: 'approval', label: 'Waiting for approval', from: 'approve' },
]

export function widgetProgress(detail: TicketDetail) {
  const { ticket, activity, stages } = detail
  const started = activity.some((row) => row.type === 'run.started')

  const steps = WIDGET_STEPS.flatMap((step) => {
    if (!step.from) {
      return [
        {
          id: step.id,
          label: step.label,
          status: started ? 'complete' : 'pending',
        },
      ]
    }

    const stage = stages.find((candidate) => candidate.id === step.from)
    // A stage this path does not need is not shown to the customer at all —
    // which is how they see that engineering was never involved.
    if (!stage || stage.status === 'skipped') return []

    const agent = stage.agentId
      ? detailAgentName(ticket.workspaceId, stage.agentId)
      : undefined

    return [
      {
        id: step.id,
        label: step.label,
        agent,
        status: stage.status,
      },
    ]
  })

  return {
    ticketId: ticket.reference,
    status: widgetStatus(ticket.status),
    steps,
    activity: activity.flatMap(widgetActivity),
    resolution: widgetResolution(detail),
  }
}

/**
 * The agent conversation, in the widget's row shape. Brain's own reasoning is
 * included: the customer seeing *why* something is happening is most of the
 * reason the widget is worth having.
 */
function widgetActivity(row: TicketDetail['activity'][number]) {
  const kind =
    row.type === 'a2a.request'
      ? 'request'
      : row.type === 'a2a.response'
        ? 'response'
        : row.tool
          ? 'tool'
          : 'response'

  const text = [row.title, ...(row.body ?? [])].join(' ')
  if (!text.trim()) return []

  return [
    {
      id: row.id,
      from: row.fromAgent ?? 'brain',
      to: row.toAgent ?? 'brain',
      text,
      via: row.tool ? 'MCP' : 'A2A',
      kind,
      taskId: row.taskId,
      tool: row.tool ? { server: row.tool.server, call: row.tool.call } : undefined,
      at: row.timestamp,
    },
  ]
}

function widgetResolution(detail: TicketDetail) {
  const { ticket, artifacts, decision } = detail
  if (ticket.status !== 'AWAITING_APPROVAL' && ticket.status !== 'RESOLVED') return undefined

  const find = (kind: Artifact['kind']) => artifacts.find((artifact) => artifact.kind === kind)
  const rootCause = find('ROOT_CAUSE')
  const pr = find('PR')
  const tests = find('TEST_RESULT')
  const config = find('CONFIG_FIX')
  const reply = find('CUSTOMER_REPLY')

  const checks = [
    rootCause && { label: 'Root cause identified', status: 'complete' },
    pr && { label: `Fix prepared — ${String(pr.data.number)}`, status: 'complete' },
    tests && {
      label: `${String(tests.data.passed)} / ${String(tests.data.total)} tests passed`,
      status: 'complete',
    },
    config && { label: 'Configuration change prepared', status: 'complete' },
    {
      label: ticket.status === 'RESOLVED' ? 'Approved by a person' : 'Waiting for approval',
      status: ticket.status === 'RESOLVED' ? 'complete' : 'active',
    },
  ].filter(Boolean)

  return {
    ticketId: ticket.reference,
    summary:
      ticket.status === 'RESOLVED'
        ? String(reply?.data.subject ?? 'Your issue has been resolved.')
        : 'A fix is ready and waiting for a human to approve it.',
    rootCause: rootCause ? String(rootCause.data.headline) : config ? String(config.data.summary) : undefined,
    checks,
    tests: tests ? { passed: Number(tests.data.passed), total: Number(tests.data.total) } : undefined,
    pr: pr
      ? {
          number: Number(String(pr.data.number).replace('#', '')),
          status: ticket.status === 'RESOLVED' ? 'merged' : 'open',
          title: String(pr.data.title),
          url: String(pr.data.url ?? ''),
        }
      : undefined,
    filesChanged: pr ? (pr.data.filesChanged as string[]) : undefined,
    approved: decision?.outcome === 'APPROVED',
    approver: decision?.by,
  }
}

/**
 * The customer is shown the agent's name, which is the company's own name for
 * it — "Company Knowledge Agent", not "clara" and not an internal id.
 */
function detailAgentName(workspaceId: string, agentId: string): string {
  return findAgent(getWorkspace(workspaceId), agentId)?.name ?? agentId
}

/** `GET /agents` in the widget's descriptor shape. */
export function widgetAgent(agent: {
  id: string
  name: string
  role: string
  capabilities: string[]
  protocol: string
  status: string
  tools: { server?: string; name: string }[]
}) {
  return {
    id: agent.id,
    name: agent.name,
    role: agent.role,
    capabilities: agent.capabilities,
    protocol: agent.protocol,
    status: agent.status === 'connected' ? 'connected' : 'offline',
    tools: agent.tools
      .filter((tool) => tool.server)
      .map((tool) => ({ server: tool.server!, capabilities: [tool.name] })),
  }
}
