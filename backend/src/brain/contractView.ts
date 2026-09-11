import type {
  Activity,
  Agent as ContractAgent,
  Artifact as ContractArtifact,
  Connector as ContractConnector,
  Run as ContractRun,
  Stage as ContractStage,
  Ticket as ContractTicket,
  TicketListRow,
  Task as ContractTask,
} from '../contract.js'
import type { ConnectionDef } from '../domain/connections.js'
import type {
  ActivityEvent,
  AgentDef,
  Artifact,
  Run,
  Stage,
  TaskRecord,
  Ticket,
} from '../domain/types.js'
import { baseUrlFor } from './registry.js'

/**
 * ============================================================================
 *  THE CONTRACT BOUNDARY
 * ============================================================================
 *
 * Everything the API returns under /api is shaped here, and nowhere else.
 * If a field is not in docs/API_CONTRACT.md it does not leave this file —
 * except where it is explicitly additive, which is marked at each site.
 *
 * Keeping the projection in one module is what makes conformance checkable:
 * there is a single place to read when asking "does this match the contract",
 * and a single place to change when the contract does.
 */

/** Additive fields this deployment sends. A contract client ignores them. */
interface TicketExtras {
  categoryLabel?: string
  workspaceId?: string
  reportedBy?: string
  impact?: string
  issueQuote?: string[]
  attachment?: string
  /** Who holds the work right now. Derivable from run.state without it. */
  currentAgentId?: string
  currentAgentAction?: string
}

export function ticketView(ticket: Ticket): ContractTicket & TicketExtras {
  return {
    id: ticket.id,
    customer: ticket.customer,
    title: ticket.title,
    description: ticket.description,
    channel: ticket.channel,
    priority: ticket.priority,
    status: ticket.status,
    category: ticket.category,
    processKey: ticket.processKey,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,

    // additive
    categoryLabel: ticket.categoryLabel,
    workspaceId: ticket.workspaceId,
    reportedBy: ticket.reportedBy,
    impact: ticket.impact,
    issueQuote: ticket.issueQuote,
    attachment: ticket.attachment,
    currentAgentId: ticket.currentAgentId,
    currentAgentAction: ticket.currentAgentAction,
  }
}

export function runView(run: Run | undefined): ContractRun | null {
  if (!run) return null
  return {
    id: run.id,
    ticketId: run.ticketId,
    state: run.state,
    path: run.path,
    attempt: run.attempt,
    summary: run.summary,
    policyReason: run.policyReason,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
  }
}

/**
 * Which agent completed each stage, or null if it has not been reached.
 *
 * A stage this path skips is also null: the contract has one way to say "no
 * dot here yet", and a consumer distinguishes skipped from pending by reading
 * `run.path` — a CONFIG_FIX never had an investigate stage to reach.
 */
export function stageView(stages: Stage[]): ContractStage {
  const agentFor = (id: Stage['id']) => {
    const stage = stages.find((candidate) => candidate.id === id)
    return stage?.status === 'complete' ? (stage.agentId ?? null) : null
  }

  return {
    context: agentFor('context'),
    investigate: agentFor('investigate'),
    verify: agentFor('verify'),
    approve: agentFor('approve'),
  }
}

export function ticketRowView(ticket: Ticket, run: Run | undefined): TicketListRow & TicketExtras {
  const view = runView(run)

  return {
    ...ticketView(ticket),
    run: view
      ? {
          id: view.id,
          state: view.state,
          path: view.path,
          attempt: view.attempt,
          startedAt: view.startedAt,
        }
      : null,
    stage: stageView(ticket.stages),
  }
}

export function activityView(row: ActivityEvent): Activity {
  return {
    id: row.id,
    ticketId: row.ticketId,
    runId: row.runId,
    seq: row.seq,
    type: row.type,
    fromAgent: row.fromAgent,
    toAgent: row.toAgent,
    title: row.title,
    body: row.body,
    level: row.level,
    taskId: row.taskId,
    durationMs: row.durationMs,
    createdAt: row.createdAt,
  }
}

/** Additive: which agent produced it. */
export function artifactView(artifact: Artifact): ContractArtifact & { createdBy?: string } {
  return {
    id: artifact.id,
    ticketId: artifact.ticketId,
    kind: artifact.kind,
    title: artifact.title,
    data: artifact.data as unknown as ContractArtifact['data'],
    createdAt: artifact.createdAt,
    createdBy: artifact.createdBy,
  }
}

export function taskView(record: TaskRecord): ContractTask {
  const failed = record.response?.status === 'failed'

  return {
    id: record.task.taskId,
    ticketId: record.ticketId,
    runId: record.runId ?? '',
    fromAgent: record.task.from,
    toAgent: record.task.to,
    type: record.task.type,
    status: record.response ? (failed ? 'FAILED' : 'COMPLETED') : 'WORKING',
    input: record.task.context,
    output: record.response?.result ?? null,
    error: record.response?.error ?? null,
    durationMs: record.response?.durationMs ?? null,
    startedAt: record.startedAt,
    endedAt: record.endedAt ?? null,
  }
}

/**
 * The contract's four agent kinds. Roles this deployment uses that the
 * contract has no word for — the orchestrator itself, the human gate, the
 * analytics copilot — are all "ops", which is what that value is for.
 */
const KIND_BY_ROLE: Record<AgentDef['role'], ContractAgent['kind']> = {
  knowledge: 'knowledge',
  engineering: 'engineering',
  validation: 'validation',
  orchestrator: 'ops',
  approval: 'ops',
  analytics: 'ops',
  process: 'ops',
}

const STATUS: Record<AgentDef['status'], ContractAgent['status']> = {
  connected: 'ONLINE',
  offline: 'OFFLINE',
  degraded: 'UNKNOWN',
}

/** Additive: the role this deployment assigns, which drives the UI's colour. */
export function agentView(
  agent: AgentDef,
  tasksToday: number,
): ContractAgent & { role: AgentDef['role']; workspaceId?: string; ownership?: string } {
  return {
    id: agent.id,
    name: agent.name,
    kind: KIND_BY_ROLE[agent.role],
    baseUrl: baseUrlFor(agent) ?? '',
    protocol: 'A2A',
    status: STATUS[agent.status],
    capabilities: agent.capabilities,
    tools: agent.tools.map((tool) => ({
      name: tool.name,
      via: tool.via === 'MCP' ? 'MCP' : 'CONNECTOR',
    })),
    description: agent.description ?? null,
    lastSeenAt: agent.lastSeenAt ?? null,
    tasksToday,

    // additive
    role: agent.role,
    ownership: agent.ownership,
  }
}

/**
 * A connection, in the contract's four fields plus everything the Connections
 * screen reads. All of the latter is additive: a client that knows only the
 * contract gets id, kind, capabilities and health, and renders a card from
 * them.
 */
export function connectorView(connection: ConnectionDef): ContractConnector & Partial<ConnectionDef> {
  return {
    // contract
    id: connection.id,
    kind: connection.kind,
    capabilities: connection.capabilities,
    health: connection.health,

    // additive
    name: connection.name,
    description: connection.description,
    category: connection.category,
    typeLabel: connection.typeLabel,
    status: connection.status,
    statusDetail: connection.statusDetail,
    usedBy: connection.usedBy,
    logo: connection.logo,
    endpoint: connection.endpoint,
    dataMode: connection.dataMode,
    addedAt: connection.addedAt,
  }
}
