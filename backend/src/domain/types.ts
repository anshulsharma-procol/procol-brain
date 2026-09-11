/**
 * ============================================================================
 *  DOMAIN MODEL
 * ============================================================================
 *
 * The same shapes the console consumes (see frontend/src/platform/types.ts and
 * docs/CONSOLE_API_CONTRACT.md). Duplicated across the process boundary on
 * purpose: the contract document is the bridge, not a shared package, so
 * either side can be deployed without the other.
 *
 * Nothing here names a company. A control tower for Procol and one for any
 * other customer are the same shapes with different rows.
 */

export type AgentRole =
  | 'orchestrator'
  | 'knowledge'
  | 'engineering'
  | 'validation'
  | 'approval'
  | 'analytics'
  | 'process'

export interface AgentTool {
  name: string
  server?: string
  via: 'MCP' | 'CONNECTOR' | 'A2A' | 'internal'
  description: string
}

export interface AgentDef {
  id: string
  name: string
  shortLabel: string
  role: AgentRole
  summary: string
  description: string
  protocol: 'A2A' | 'MCP' | 'REST' | 'internal'
  protocolNote: string
  /** Brain routes on these, never on the agent id. */
  capabilities: string[]
  tools: AgentTool[]
  status: 'connected' | 'degraded' | 'offline'
  ownership: 'procol' | 'customer' | 'third-party'
  /** Set by discovery: where this agent answers A2A tasks. */
  baseUrl?: string
  lastSeenAt?: string
  sampleInteraction?: { from: string; text: string }[]
}

export type ConnectorKind = 'database' | 'warehouse' | 'saas-api' | 'code-host' | 'mcp' | 'file'

export interface ConnectorDef {
  id: string
  name: string
  kind: ConnectorKind
  dataMode: 'query-in-place' | 'pushdown' | 'replicated' | 'metadata-only'
  capabilities: string[]
  status: 'connected' | 'degraded' | 'offline'
  latencyMs?: number
}

export interface ApprovalPolicy {
  id: string
  appliesTo: ArtifactKind[]
  reason: string
  risk: 'low' | 'medium' | 'high'
}

export interface Workspace {
  id: string
  name: string
  product: string
  ticketPrefix: string
  tagline: string
  accent: 'violet' | 'blue' | 'green' | 'amber'
  agents: AgentDef[]
  connectors: ConnectorDef[]
  approvalPolicies: ApprovalPolicy[]
  supportEmailDomain: string
}

/**
 * The contract's vocabulary, re-exported so nothing internal invents its own
 * spelling of a value that crosses the wire. `src/contract.ts` is generated
 * from contracts/api.ts and is the only definition of these.
 */
export type {
  Category,
  Channel as TicketChannel,
  Level,
  Priority as TicketPriority,
  RunPath as ResolutionPath,
  RunState,
  TaskType as A2ATaskType,
  TicketStatus,
} from '../contract.js'

import type {
  Category,
  Channel,
  Priority,
  RunPath,
  RunState,
  TaskType,
  TicketStatus,
} from '../contract.js'

export type StageId = 'context' | 'investigate' | 'verify' | 'approve'

export interface Stage {
  id: StageId
  label: string
  status: 'pending' | 'active' | 'complete' | 'skipped'
  agentId?: string
  detail?: string
}

/**
 * The stored ticket. Its contract-visible half is exactly `contract.Ticket`;
 * everything after `processKey` is internal and is either projected into the
 * contract's shape at the route boundary or served on an extension endpoint.
 */
export interface Ticket {
  // -- contract.Ticket ----------------------------------------------------
  id: string
  customer: string | null
  title: string
  description: string
  channel: Channel
  priority: Priority
  status: TicketStatus
  category: Category | null
  processKey: string | null
  createdAt: string
  updatedAt: string

  // -- additive, and safe to ignore ---------------------------------------
  /** Human-readable category, e.g. "Billing & invoicing". The enum is coarse. */
  categoryLabel?: string
  /** Which control tower owns it. Absent from the contract by design. */
  workspaceId: string
  reportedBy?: string
  impact?: string
  issueQuote: string[]
  attachment?: string

  // -- internal only, never serialised as part of contract.Ticket ---------
  /** The run currently attached to this ticket. */
  runId?: string
  currentAgentId?: string
  currentAgentAction?: string
  progress: number
  stages: Stage[]
  /** Where the request came from, when the chat widget sent one. */
  origin?: { userId?: string; page?: string; module?: string; recordId?: string }
}

/** The run, exactly as the contract defines it. */
export interface Run {
  id: string
  ticketId: string
  state: RunState
  path: RunPath | null
  attempt: number
  summary: string | null
  policyReason: string | null
  startedAt: string
  endedAt: string | null
}

export type { ActivityType, ArtifactKind } from '../contract.js'
import type { ActivityType, ArtifactKind, Level } from '../contract.js'

/**
 * One row of the audit trail, in the contract's shape.
 *
 * `body` is a string and stays one: it is either prose or a JSON payload the
 * UI shows verbatim, and making the frontend parse a response field is how
 * two codebases end up disagreeing about what a payload is.
 *
 * An agent's working notes are their own `agent.log` rows carrying the parent
 * `taskId`, rather than an array nested inside the response — which is what
 * lets the UI render them as sub-lines under the exchange they belong to.
 */
export interface ActivityEvent {
  id: string
  ticketId: string
  runId: string | null
  /** Monotonic per ticket, allocated server-side. Order by this, not by time. */
  seq: number
  type: ActivityType
  fromAgent: string | null
  toAgent: string | null
  title: string
  body: string | null
  level: Level
  taskId: string | null
  durationMs: number | null
  createdAt: string
}

export interface Artifact {
  id: string
  ticketId: string
  kind: ArtifactKind
  title: string
  /** Contract shape per kind — see contract.ArtifactData. */
  data: Record<string, unknown>
  createdAt: string
  /** Additive: which agent produced it. */
  createdBy?: string
}

export interface MemoryEntry {
  id: string
  workspaceId: string
  sourceTicketRef: string
  title: string
  symptom: string
  rootCause: string
  resolution: string
  path: RunPath
  tags: string[]
  reuseCount: number
  minutesSavedPerReuse: number
  learnedAt: string
  relatedKnowledgeIds: string[]
}

export interface MemoryMatch {
  entry: MemoryEntry
  confidence: number
  reason: string
}

export type KnowledgeType =
  | 'Product Doc'
  | 'Customer Config'
  | 'Business Rule'
  | 'FAQ'
  | 'Runbook'
  | 'Incident'

export interface KnowledgeEntry {
  id: string
  workspaceId: string
  title: string
  description: string
  type: KnowledgeType
  version: string
  updatedAt: string
  usedBy: string[]
  content: { heading: string; bullets: string[] }[]
  relatedTicketRefs: string[]
}

export interface WorkspaceStats {
  activeTickets: number
  aiWorking: number
  awaitingApproval: number
  resolvedThisWeek: number
  hoursSavedThisMonth: number
  avgResolutionMinutes: number
  ticketsByStatus: { name: string; value: number; color: string }[]
  agentActivity: { agentId: string; name: string; value: number }[]
}

export interface Decision {
  outcome: 'APPROVED' | 'REJECTED'
  by: string
  note?: string
  at: string
}

/**
 * Internal aggregate. The contract's `GET /api/tickets/:id` is a narrower
 * projection of this — see routes/console.ts.
 */
export interface TicketDetail {
  ticket: Ticket
  run?: Run
  stages: Stage[]
  activity: ActivityEvent[]
  artifacts: Artifact[]
  memoryMatches: MemoryMatch[]
  approvalPolicy?: ApprovalPolicy
  decision?: Decision
}

// ---------------------------------------------------------------------------
// A2A
// ---------------------------------------------------------------------------

export interface A2ATask {
  taskId: string
  from: string
  to: string
  type: TaskType
  context: Record<string, unknown>
}

export interface A2AResponse {
  taskId: string
  status: 'completed' | 'failed' | 'needs_input'
  agent: string
  result?: Record<string, unknown>
  artifacts?: { kind: ArtifactKind; title: string; data: Record<string, unknown> }[]
  /** 3-5 lines per agent. The cheapest way to make a run read as real work. */
  log?: string[]
  error?: string
  durationMs?: number
}

export interface TaskRecord {
  task: A2ATask
  response?: A2AResponse
  ticketId: string
  /** The run this hop belongs to — the contract's Task carries it. */
  runId?: string
  startedAt: string
  endedAt?: string
}
