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

export type TicketStatus =
  | 'NEW'
  | 'INVESTIGATING'
  | 'AWAITING_APPROVAL'
  | 'RESOLVED'
  | 'NEEDS_HUMAN'
  | 'REJECTED'

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type TicketChannel = 'chat' | 'email' | 'portal' | 'signal' | 'event'
export type ResolutionPath = 'CODE_FIX' | 'CONFIG_FIX' | 'ANSWER_ONLY' | 'PROCESS'
export type StageId = 'context' | 'investigate' | 'verify' | 'approve'

export interface Stage {
  id: StageId
  label: string
  status: 'pending' | 'active' | 'complete' | 'skipped'
  agentId?: string
  detail?: string
}

export interface Ticket {
  id: string
  reference: string
  workspaceId: string
  title: string
  description: string
  customer: string
  reportedBy?: string
  channel: TicketChannel
  priority: TicketPriority
  status: TicketStatus
  category: string
  impact: string
  issueQuote: string[]
  attachment?: string
  createdAt: string
  updatedAt: string
  path?: ResolutionPath
  currentAgentId?: string
  currentAgentAction?: string
  progress: number
  stages?: Stage[]
  /** Where the request came from, when the widget sent one. */
  origin?: { userId?: string; page?: string; module?: string; recordId?: string }
}

export type ActivityType =
  | 'ticket.created'
  | 'run.started'
  | 'brain.thought'
  | 'a2a.request'
  | 'a2a.response'
  | 'agent.log'
  | 'artifact.created'
  | 'run.awaiting_approval'
  | 'human.decision'
  | 'customer.notified'
  | 'run.completed'

export interface ActivityEvent {
  id: string
  ticketId: string
  /** Monotonic per ticket, allocated server-side. Order by this, not by time. */
  seq: number
  type: ActivityType
  fromAgent?: string
  toAgent?: string
  taskType?: string
  title: string
  body?: string[]
  logs?: string[]
  level: 'info' | 'success' | 'warn' | 'error'
  durationMs?: number
  /** The raw A2A envelope, revealed by "show payload". */
  payload?: unknown
  /** Set on hops so the console can pull the full task record. */
  taskId?: string
  /** MCP tool call behind this step, when there was one. */
  tool?: { server: string; call: string }
  timestamp: string
}

export type ArtifactKind =
  | 'ROOT_CAUSE'
  | 'PR'
  | 'TEST_RESULT'
  | 'CONFIG_FIX'
  | 'CUSTOMER_REPLY'
  | 'IMPACT'
  | 'PROCESS_RESULT'

export interface Artifact {
  id: string
  ticketId: string
  kind: ArtifactKind
  title: string
  createdBy: string
  createdAt: string
  data: Record<string, unknown>
}

export interface MemoryEntry {
  id: string
  workspaceId: string
  sourceTicketRef: string
  title: string
  symptom: string
  rootCause: string
  resolution: string
  path: ResolutionPath
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

export interface TicketDetail {
  ticket: Ticket
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

export type A2ATaskType =
  | 'GET_PRODUCT_CONTEXT'
  | 'INVESTIGATE_BUG'
  | 'VALIDATE_FIX'
  | 'IMPACT_ANALYSIS'
  | 'DRAFT_REPLY'

export interface A2ATask {
  taskId: string
  from: string
  to: string
  type: A2ATaskType
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
  startedAt: string
  endedAt?: string
}
