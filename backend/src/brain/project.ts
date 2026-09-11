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
    case 'RUNNING':
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
    id: ticket.id,
    reference: ticket.id,
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
    ticketId: ticket.id,
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
  const text = (value: unknown) => (typeof value === 'string' ? value : '')
  const line = {
    id: row.id,
    from: 'brain',
    to: 'brain',
    via: 'A2A' as 'A2A' | 'MCP',
    taskId: text(row.taskId) || undefined,
    at: row.at,
  }

  // The widget's feed shows the conversation, not the machinery: a run.state
  // line or an artifact row is noise to a customer watching their own ticket.
  switch (row.type) {
    case 'brain.thought':
      return [{ ...line, text: text(row.text), kind: 'response' }]

    case 'a2a.request':
      return [
        { ...line, from: 'brain', to: text(row.to), text: text(row.summary), kind: 'request' },
      ]

    case 'a2a.response':
      return [
        {
          ...line,
          from: text(row.from),
          to: 'brain',
          text: [text(row.summary), text(row.detail)].filter(Boolean).join(' '),
          kind: 'response',
        },
      ]

    case 'agent.log':
      return [
        { ...line, from: text(row.agent), text: text(row.line), via: 'MCP', kind: 'tool' },
      ]

    default:
      return []
  }
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
    ticketId: ticket.id,
    summary:
      ticket.status === 'RESOLVED'
        ? String(reply?.data.subject ?? 'Your issue has been resolved.')
        : 'A fix is ready and waiting for a human to approve it.',
    rootCause: rootCause
      ? String(rootCause.data.rootCause)
      : config
        ? String(config.data.title)
        : undefined,
    checks,
    tests: tests ? { passed: Number(tests.data.passed), total: Number(tests.data.total) } : undefined,
    pr: pr
      ? {
          number: Number(String(pr.data.number).replace('#', '')),
          // Only a pull request that was really opened can be called merged.
          // A consumer that reads `status` without checking `real` must still
          // be told something true, so an unopened one stays 'created' — a
          // fix exists, nothing has been merged — however the run ended.
          status: !pr.data.real
            ? 'created'
            : ticket.status === 'RESOLVED'
              ? 'merged'
              : 'open',
          title: String(pr.data.title),
          url: String(pr.data.url ?? ''),
          // `state: 'mock'` is our internal word and does not belong in a
          // customer's view. What they need is only whether the link goes
          // anywhere, which is what this says.
          real: pr.data.real === true,
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
