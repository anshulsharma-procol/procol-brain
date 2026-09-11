import type {
  AgentDto,
  ArtifactDto,
  ConnectorDto,
  RunDto,
  TaskDto,
  TicketDto,
} from '../contract.js'
import type { ConnectionDef } from '../domain/connections.js'
import type { AgentDef, Artifact, Run, Stage, TaskRecord, Ticket } from '../domain/types.js'
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
 * one place to read when asking "does this match", one place to change when
 * the contract does.
 */

/**
 * Additive fields this deployment sends on a ticket.
 *
 * `stage` and `run` are the ones worth knowing about: the contract's ticket
 * list is bare `TicketDto[]`, so a board reading a compliant backend has only
 * the status to work from. Sending these lets our board draw the four-dot
 * rail without a request per row — and a client that does not see them falls
 * back to the status, which is why they are safe to add.
 */
interface TicketExtras {
  categoryLabel?: string
  workspaceId?: string
  reportedBy?: string
  impact?: string
  issueQuote?: string[]
  attachment?: string
  currentAgentId?: string
  currentAgentAction?: string
  run?: Pick<RunDto, 'id' | 'state' | 'path' | 'attempt' | 'startedAt'> | null
  stage?: Record<Stage['id'], string | null>
}

export function ticketView(ticket: Ticket): TicketDto & TicketExtras {
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

export function runView(run: Run | undefined): RunDto | null {
  if (!run) return null
  return {
    id: run.id,
    ticketId: run.ticketId,
    state: run.state,
    path: run.path,
    attempt: run.attempt,
    summary: run.summary,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
  }
}

/**
 * Which agent completed each stage, or null if it has not been reached.
 *
 * A stage the chosen path skips is also null: there is one way to say "no dot
 * here yet", and a consumer separates skipped from pending by reading
 * `run.path` — a CONFIG_FIX never had an investigate stage to reach.
 */
export function stageView(stages: Stage[]): Record<Stage['id'], string | null> {
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

/** A list row: the contract's ticket, with the run and rail added. */
export function ticketRowView(ticket: Ticket, run: Run | undefined): TicketDto & TicketExtras {
  const view = runView(run)

  return {
    ...ticketView(ticket),
    run: view
      ? { id: view.id, state: view.state, path: view.path, attempt: view.attempt, startedAt: view.startedAt }
      : null,
    stage: stageView(ticket.stages),
  }
}

/** Additive: which agent produced it. */
export function artifactView(artifact: Artifact): ArtifactDto & { createdBy?: string } {
  return {
    id: artifact.id,
    ticketId: artifact.ticketId,
    kind: artifact.kind,
    title: artifact.title,
    data: artifact.data as unknown as ArtifactDto['data'],
    createdAt: artifact.createdAt,
    createdBy: artifact.createdBy,
  }
}

export function taskView(record: TaskRecord): TaskDto {
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
 * The contract has four agent kinds and they describe what an agent is for.
 * Roles this deployment uses that it has no word for — the orchestrator, the
 * human gate, the analytics copilot — are all "ops", which is what that value
 * exists for.
 */
const KIND_BY_ROLE: Record<AgentDef['role'], AgentDto['kind']> = {
  knowledge: 'knowledge',
  engineering: 'engineering',
  validation: 'validation',
  orchestrator: 'ops',
  approval: 'ops',
  analytics: 'ops',
  process: 'ops',
}

const STATUS: Record<AgentDef['status'], AgentDto['status']> = {
  connected: 'ONLINE',
  offline: 'OFFLINE',
  degraded: 'UNKNOWN',
}

/** Additive: the role this deployment assigns, which drives the UI's colour. */
export function agentView(
  agent: AgentDef,
  tasksToday: number,
): AgentDto & { role: AgentDef['role']; workspaceId?: string; ownership?: string } {
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
 * contract gets id, kind, capabilities and health, and renders a card.
 */
export function connectorView(connection: ConnectionDef): ConnectorDto & Partial<ConnectionDef> {
  return {
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
