/**
 * ============================================================================
 *  PROCOL BRAIN — CONSOLE DOMAIN MODEL
 * ============================================================================
 *
 * These types describe the product, not the demo. Nothing here mentions a
 * specific company, agent or ticket: a control tower for Procol and a control
 * tower for any other company are the same shapes with different data.
 *
 * The rule that makes that true: the UI keys colour, icon and layout off an
 * agent's ROLE, never off its id. Procol's knowledge agent is "Clara";
 * AcmeCloud's is "Company Knowledge Agent". Both are `role: 'knowledge'`, so
 * both render identically without a single conditional in a component.
 */

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

/**
 * What an agent is for. The orchestrator is always present; every other role
 * is optional, because not every company has (or lets us near) a codebase.
 */
export type AgentRole =
  | 'orchestrator' // Brain itself
  | 'knowledge' // Clara / the customer's own AI / an internal docs agent
  | 'engineering' // root cause + pull request
  | 'validation' // tests
  | 'approval' // the human gate
  | 'analytics' // blast radius, reporting
  | 'process' // multi-step business processes

/** How Brain reaches the agent. */
export type AgentProtocol = 'A2A' | 'MCP' | 'REST' | 'internal'

/** A tool the agent can call, and the protocol it calls it over. */
export interface AgentTool {
  name: string
  /** e.g. 'github', 'test-runner', 'product-db' */
  server?: string
  via: 'MCP' | 'CONNECTOR' | 'A2A' | 'internal'
  description: string
}

export interface AgentDef {
  /** Stable id, unique within a workspace. e.g. 'clara', 'acme-knowledge'. */
  id: string
  name: string
  /** 2-3 character badge, e.g. 'CL', 'DEV'. */
  shortLabel: string
  role: AgentRole
  /** One line shown under the name in the registry. */
  summary: string
  description: string
  protocol: AgentProtocol
  protocolNote: string
  /** Declared capabilities. Brain routes on these, never on the agent id. */
  capabilities: string[]
  tools: AgentTool[]
  status: 'connected' | 'degraded' | 'offline'
  /** Who runs it. `customer` is the whole pitch: keep the AI you already bought. */
  ownership: 'procol' | 'customer' | 'third-party'
  sampleInteraction?: { from: string; text: string }[]
}

// ---------------------------------------------------------------------------
// Connectors — how data reaches the agents
// ---------------------------------------------------------------------------

export type ConnectorKind =
  | 'database'
  | 'warehouse'
  | 'saas-api'
  | 'code-host'
  | 'mcp'
  | 'file'
  | 'event-stream'

export type ConnectionCategory = 'agent' | 'mcp' | 'database' | 'saas' | 'knowledge'
export type ConnectionStatus = 'connected' | 'action_required' | 'not_connected'

/**
 * A connection, as the Connections screen reads it.
 *
 * Only `id`, `kind`, `capabilities` and `health` are the contract's. The rest
 * is additive and every field is optional here for that reason: against a
 * backend that implements the contract and nothing more, a card still renders
 * — named by its id, typed by its kind, listing what it can do.
 */
export interface Connection {
  id: string
  kind: ConnectorKind
  capabilities: string[]
  health: { ok: boolean; latencyMs: number }

  name?: string
  description?: string
  category?: ConnectionCategory
  typeLabel?: string
  status?: ConnectionStatus
  statusDetail?: string
  usedBy?: string[]
  logo?: string
  endpoint?: string
  dataMode?: string
  addedAt?: string
}

export interface ConnectionType {
  id: ConnectionCategory
  name: string
  description: string
  accent: 'violet' | 'blue' | 'green' | 'orange' | 'red'
  fields: {
    key: 'name' | 'endpoint' | 'token'
    label: string
    placeholder: string
    required: boolean
    secret?: boolean
  }[]
  discovering: string
}

export interface ConnectorDef {
  id: string
  name: string
  kind: ConnectorKind
  /** What crosses the boundary. Buyers ask this first. */
  dataMode: 'query-in-place' | 'pushdown' | 'replicated' | 'metadata-only'
  capabilities: string[]
  status: 'connected' | 'degraded' | 'offline'
  latencyMs?: number
}

// ---------------------------------------------------------------------------
// Approval policy — visible governance
// ---------------------------------------------------------------------------

export interface ApprovalPolicy {
  id: string
  /** Artifact kind or resolution path this policy guards. */
  appliesTo: ArtifactKind[]
  /** Rendered verbatim above the approve button. */
  reason: string
  /** Escalation hint shown next to the decision. */
  risk: 'low' | 'medium' | 'high'
}

// ---------------------------------------------------------------------------
// Workspace — one company's control tower
// ---------------------------------------------------------------------------

export interface Workspace {
  /** Tenant key. Sent as `companyId` to the Brain API and the chat SDK. */
  id: string
  /** Company name, e.g. 'Procol'. */
  name: string
  /** Product the tickets are about, e.g. 'Procol Procurement Cloud'. */
  product: string
  /** Ticket reference prefix, e.g. 'PRO' -> PRO-1245. */
  ticketPrefix: string
  /** Short sentence for the workspace switcher. */
  tagline: string
  /** Tailwind colour token used for the workspace chip only. */
  accent: 'violet' | 'blue' | 'green' | 'amber'
  agents: AgentDef[]
  connectors: ConnectorDef[]
  approvalPolicies: ApprovalPolicy[]
  /** Domain used in generated customer emails. */
  supportEmailDomain: string
}

// ---------------------------------------------------------------------------
// Tickets and runs
// ---------------------------------------------------------------------------

/**
 * Anything that crosses the wire is the contract's, re-exported so no screen
 * invents a second spelling of a value the backend owns.
 */
export type {
  Activity as ActivityEvent,
  ActivityType,
  Artifact,
  ArtifactKind,
  Channel as TicketChannel,
  ConfigFixData,
  CustomerReplyData,
  ImpactData,
  Priority as TicketPriority,
  PrData,
  RootCauseData,
  RunPath as ResolutionPath,
  RunState,
  TestResultData,
  TicketStatus,
} from './contract'

import type {
  Activity,
  Artifact,
  ArtifactKind,
  ArtifactOf,
  Channel,
  Priority,
  RunPath,
  TicketStatus,
} from './contract'

/**
 * `Artifact.data` is a union the contract does not discriminate on the
 * artifact itself, so narrowing is explicit. One guard, used everywhere,
 * beats a cast per call site.
 */
export function isArtifact<K extends ArtifactKind>(
  artifact: Artifact,
  kind: K,
): artifact is ArtifactOf<K> {
  return artifact.kind === kind
}

/** The first artifact of a kind, already narrowed. */
export function findArtifact<K extends ArtifactKind>(
  artifacts: Artifact[],
  kind: K,
): ArtifactOf<K> | undefined {
  return artifacts.find((artifact): artifact is ArtifactOf<K> => artifact.kind === kind)
}

export interface Ticket {
  id: string
  /** The contract's id, kept under the name the screens already use. */
  reference: string
  workspaceId: string
  title: string
  description: string
  customer: string
  reportedBy?: string
  channel: Channel
  priority: Priority
  status: TicketStatus
  category: string
  impact: string
  /** The customer's own words, one paragraph per line. */
  issueQuote: string[]
  attachment?: string
  createdAt: string
  updatedAt: string
  /** Null until Brain decides. */
  path?: RunPath
  /** id of the agent currently holding the work. */
  currentAgentId?: string
  currentAgentAction?: string
  /** 0-100, derived from stage completion. */
  progress: number
  /**
   * The four-dot rail as this run actually stands, including stages the
   * chosen path skipped. Present whenever there is a run behind the ticket,
   * so the board shows a configuration fix taking a visibly shorter path.
   */
  stages?: Stage[]
}

// ---------------------------------------------------------------------------
// Activity — the audit trail, and the only timeline primitive
// ---------------------------------------------------------------------------

/**
 * One line of the audit trail. Mirrors the backend SSE event types one-for-one,
 * so switching from the mock to a live stream is a transport change, not a
 * rendering change.
 */
// ---------------------------------------------------------------------------
// Stages — the four dots every ticket walks, whatever the path
// ---------------------------------------------------------------------------

export type StageId = 'context' | 'investigate' | 'verify' | 'approve'

export interface Stage {
  id: StageId
  label: string
  status: 'pending' | 'active' | 'complete' | 'skipped'
  /** Agent that completed it — the dot takes that agent's colour. */
  agentId?: string
  detail?: string
}

// ---------------------------------------------------------------------------
// Institutional memory — the asset that compounds across control towers
// ---------------------------------------------------------------------------

/**
 * Every closed run writes one of these. It is what makes the product worth
 * more in month twelve than in month one: the next identical ticket is
 * answered from memory instead of re-investigated from scratch.
 */
export interface MemoryEntry {
  id: string
  workspaceId: string
  /** Ticket this was learned from. */
  sourceTicketRef: string
  title: string
  /** Normalised symptom, matched against new tickets. */
  symptom: string
  rootCause: string
  resolution: string
  path: RunPath
  /** Free-text tags used by the mock matcher and by real embeddings later. */
  tags: string[]
  /** How many times this memory has been reused to shortcut a ticket. */
  reuseCount: number
  /** Minutes saved per reuse, as measured on the original run. */
  minutesSavedPerReuse: number
  learnedAt: string
  relatedKnowledgeIds: string[]
}

/** A memory hit surfaced against an open ticket. */
export interface MemoryMatch {
  entry: MemoryEntry
  /** 0..1. The mock computes it from tag overlap; the backend will embed. */
  confidence: number
  reason: string
}

// ---------------------------------------------------------------------------
// Knowledge base
// ---------------------------------------------------------------------------

export type KnowledgeType = 'Product Doc' | 'Customer Config' | 'Business Rule' | 'FAQ' | 'Runbook' | 'Incident'

export interface KnowledgeEntry {
  id: string
  workspaceId: string
  title: string
  description: string
  type: KnowledgeType
  version: string
  updatedAt: string
  /** Agent ids that read this document. */
  usedBy: string[]
  content: { heading: string; bullets: string[] }[]
  relatedTicketRefs: string[]
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export interface WorkspaceStats {
  activeTickets: number
  aiWorking: number
  awaitingApproval: number
  resolvedThisWeek: number
  /** Institutional memory payoff, in hours. */
  hoursSavedThisMonth: number
  avgResolutionMinutes: number
  ticketsByStatus: { name: string; value: number; color: string }[]
  agentActivity: { agentId: string; name: string; value: number }[]
}

/** Everything one ticket page needs, in a single fetch. */
export interface TicketDetail {
  ticket: Ticket
  stages: Stage[]
  activity: Activity[]
  artifacts: Artifact[]
  memoryMatches: MemoryMatch[]
  /** Policy that required a human, once the run reaches the gate. */
  approvalPolicy?: ApprovalPolicy
  decision?: { outcome: 'APPROVED' | 'REJECTED'; by: string; note?: string; at: string }
}

export type DecisionOutcome = 'APPROVED' | 'REJECTED'
