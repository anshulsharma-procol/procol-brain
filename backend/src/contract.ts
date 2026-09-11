// GENERATED FROM contracts/api.ts — DO NOT EDIT.
// Run `npm run contract:sync` at the repo root after editing the contract.
/**
 * ============================================================================
 *  SYNAPSE — API CONTRACT
 * ============================================================================
 *
 * The shared boundary between backend and frontend. Transcribed from the
 * backend's own FRONTEND.md, which is generated from the code the server
 * runs — so where the two ever disagree, `GET /api/contract` on a live server
 * is the authority and this file is what needs correcting.
 *
 * FROZEN. Ask before changing anything here.
 *
 * Copied into both packages by `npm run contract:sync`; `contract:check`
 * fails if a copy drifts. Edit THIS file, never a copy.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type TicketStatus =
  | 'NEW'
  | 'RUNNING'
  | 'AWAITING_APPROVAL'
  | 'RESOLVED'
  | 'NEEDS_HUMAN'
  | 'REJECTED'

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type Category = 'BUG' | 'CONFIG' | 'QUESTION' | 'PROCESS'
export type Channel = 'email' | 'portal' | 'slack' | 'signal' | 'event'
export type ResolutionPath = 'CODE_FIX' | 'CONFIG_FIX' | 'ANSWER_ONLY' | 'PROCESS'

export type ArtifactKind =
  | 'ROOT_CAUSE'
  | 'PR'
  | 'TEST_RESULT'
  | 'CONFIG_FIX'
  | 'CUSTOMER_REPLY'
  | 'IMPACT'
  | 'PROCESS_RESULT'

export type AgentStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN'

/** The §6.1 machine. */
export type RunState =
  | 'RECEIVED'
  | 'CLASSIFYING'
  | 'GATHERING_CONTEXT'
  | 'DECIDING'
  | 'INVESTIGATING'
  | 'VERIFYING'
  | 'DRAFTING_REMEDIATION'
  | 'DRAFTING_REPLY'
  | 'EXECUTING_PROCESS'
  | 'AWAITING_APPROVAL'
  | 'RESOLVED'
  | 'NEEDS_HUMAN'

export type ActivityType =
  | 'ticket.created'
  | 'run.started'
  | 'run.state'
  | 'brain.thought'
  | 'a2a.request'
  | 'a2a.response'
  | 'agent.log'
  | 'artifact.created'
  | 'run.awaiting_approval'
  | 'run.completed'
  | 'agent.status'
  | 'signal.raised'

export type AgentId = 'brain' | 'clara' | 'dev-agent' | 'qa-agent' | (string & {})

export type TaskType =
  | 'GET_PRODUCT_CONTEXT'
  | 'INVESTIGATE_BUG'
  | 'VALIDATE_FIX'
  | 'VERIFY_DOCUMENTS'
  | 'CREATE_RECORD'
  | 'NOTIFY'

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface TicketDto {
  id: string
  /** null when raised by monitoring rather than by a person. */
  customer: string | null
  title: string
  description: string
  channel: Channel
  priority: Priority
  status: TicketStatus
  category: Category | null
  /** Set when this is a Flow run rather than a support ticket. */
  processKey: string | null
  createdAt: string
  updatedAt: string
}

export interface RunDto {
  id: string
  ticketId: string
  state: RunState
  path: ResolutionPath | null
  /** 1 or 2. The dev↔QA loop is capped. */
  attempt: number
  summary: string | null
  startedAt: string
  endedAt: string | null
}

export interface ArtifactDto {
  id: string
  ticketId: string
  kind: ArtifactKind
  title: string
  /** Parsed, never a JSON string. Shape depends on `kind`. */
  data: ArtifactData
  createdAt: string
}

export interface TaskDto {
  id: string
  ticketId: string
  runId: string
  fromAgent: AgentId
  toAgent: AgentId
  type: TaskType
  status: 'PENDING' | 'WORKING' | 'COMPLETED' | 'FAILED'
  input: unknown
  output: unknown | null
  error: string | null
  durationMs: number | null
  startedAt: string
  endedAt: string | null
}

export interface AgentDto {
  id: AgentId
  name: string
  kind: 'knowledge' | 'engineering' | 'validation' | 'ops'
  baseUrl: string
  protocol: 'A2A'
  status: AgentStatus
  capabilities: string[]
  tools: { name: string; via: 'MCP' | 'CONNECTOR' }[]
  description: string | null
  lastSeenAt: string | null
  tasksToday: number
}

export interface ConnectorDto {
  id: string
  kind: 'database' | 'warehouse' | 'saas-api' | 'file' | 'event-stream' | 'mcp'
  capabilities: string[]
  health: { ok: boolean; latencyMs: number }
}

export interface SignalDto {
  id: string
  source: string
  kind: string
  summary: string
  metrics: Record<string, unknown>
  ticketId: string | null
  createdAt: string
}

export interface PolicyDto {
  id: string
  reason: string
}

// ---------------------------------------------------------------------------
// Activities and SSE — the same envelope
// ---------------------------------------------------------------------------

/**
 * Every activity row and every SSE payload carries these five fields, and the
 * values are identical in both — which is what makes a mid-run refresh
 * rebuild the same timeline.
 *
 * Dedupe on `id`, order on `seq`. Never order on `at`: millisecond collisions
 * are guaranteed, and events can land out of order.
 */
export interface ActivityBase {
  id: string
  seq: number
  type: ActivityType
  ticketId: string
  at: string
}

export type ActivityDto =
  | (ActivityBase & { type: 'ticket.created'; ticket: TicketDto })
  | (ActivityBase & { type: 'run.started'; runId: string })
  | (ActivityBase & {
      type: 'run.state'
      runId: string
      state: RunState
      path: ResolutionPath | null
      attempt: number
    })
  /** The Brain's reasoning in plain English. Render it prominently. */
  | (ActivityBase & { type: 'brain.thought'; text: string })
  | (ActivityBase & {
      type: 'a2a.request'
      taskId: string
      from: AgentId
      to: AgentId
      taskType: TaskType
      summary: string
    })
  | (ActivityBase & {
      type: 'a2a.response'
      taskId: string
      from: AgentId
      to: AgentId
      status: string
      summary: string
      durationMs: number | null
    })
  /** Render as an indented sub-line under the exchange with the same taskId. */
  | (ActivityBase & { type: 'agent.log'; taskId: string; agent: AgentId; line: string })
  /** Carries the whole artifact — no refetch needed. */
  | (ActivityBase & { type: 'artifact.created'; artifact: ArtifactDto })
  | (ActivityBase & {
      type: 'run.awaiting_approval'
      runId: string
      policyId: string
      policyReason: string
    })
  | (ActivityBase & { type: 'run.completed'; runId: string; outcome: string })
  /** `seq` is -1 and it is not ticket-scoped. Keep it out of a timeline. */
  | (ActivityBase & { type: 'agent.status'; agentId: AgentId; status: AgentStatus })
  | (ActivityBase & { type: 'signal.raised'; signal: SignalDto })

/** An SSE payload is an activity row. */
export type SseEnvelope = ActivityDto

/** Narrow an activity to one type. */
export type ActivityOf<T extends ActivityType> = Extract<ActivityDto, { type: T }>

// ---------------------------------------------------------------------------
// Artifact payloads
// ---------------------------------------------------------------------------

export interface RootCauseData {
  rootCause: string
  file: string
  /** 0–1. */
  confidence: number
  attempt: number
}

export interface PrData {
  number: number
  url: string
  state: string
  /**
   * False when the pull request could not be opened — a token or the network.
   * The patch still exists on `branch` and `note` says why. Do not render it
   * as a live PR link in that case: an unclickable link that looks clickable
   * is worse than saying plainly that it is a patch on a branch.
   */
  real: boolean
  note?: string
  branch: string
  title: string
  body: string
  filesChanged: string[]
  /** Unified diff. */
  diff: string
}

export interface TestResultData {
  status: 'passed' | 'failed'
  total: number
  passed: number
  failed: number
  durationMs: number
  suites: string[]
  failures: string[]
  message: string
  branch: string
  attempt: number
}

export interface ConfigFixData {
  title: string
  steps: string[]
  rationale: string
  /** False is the point: Brain decided engineering was not needed. */
  requiresCodeChange: boolean
  citations: string[]
  customer: string
}

export interface CustomerReplyData {
  subject: string
  body: string
  citations?: string[]
  sentAt?: string
  approvedBy?: string
}

export interface ImpactData {
  affectedTenants: number
  affectedRecords: number
  firstSeen: string
  trend: { date: string; count: number }[]
  /** Show it behind a disclosure. A number with its query attached is evidence. */
  sql: string
  source: string
}

export interface ProcessResultData {
  key: string
  name: string
  completed: { stepId: string; name: string; detail: string; output?: unknown }[]
  pending: { stepId: string; name: string; action: string }[]
  input: unknown
}

export type ArtifactData =
  | RootCauseData
  | PrData
  | TestResultData
  | ConfigFixData
  | CustomerReplyData
  | ImpactData
  | ProcessResultData

export type ArtifactOf<K extends ArtifactKind> = ArtifactDto & {
  kind: K
  data: K extends 'ROOT_CAUSE'
    ? RootCauseData
    : K extends 'PR'
      ? PrData
      : K extends 'TEST_RESULT'
        ? TestResultData
        : K extends 'CONFIG_FIX'
          ? ConfigFixData
          : K extends 'CUSTOMER_REPLY'
            ? CustomerReplyData
            : K extends 'IMPACT'
              ? ImpactData
              : ProcessResultData
}

// ---------------------------------------------------------------------------
// Envelopes and endpoint payloads
// ---------------------------------------------------------------------------

export interface ListResponse<T> {
  data: T[]
}

export interface ErrorResponse {
  error: { code: string; message: string }
}

/** `GET /tickets/:id`. Paints the whole page except the timeline. */
export interface TicketDetailResponse {
  ticket: TicketDto
  /** null before the first investigation. */
  run: RunDto | null
  artifacts: ArtifactDto[]
  /** Render `reason` above the buttons when `required`. */
  approval: { required: boolean; policyId?: string; reason?: string } | null
  /** Present when monitoring raised this rather than a person. */
  signal: SignalDto | null
}

export interface CreateTicketBody {
  customer: string
  title: string
  description: string
  priority?: Priority
  channel?: Channel
}

/** `POST /tickets/:id/investigate` — 202, and idempotent. */
export interface InvestigateResponse {
  runId: string
  /** False when a run was already in flight and this call joined it. */
  started: boolean
}

export interface DecisionBody {
  decision: 'APPROVE' | 'REJECT'
  note?: string
}

export interface DecisionResponse {
  decision: 'APPROVE' | 'REJECT'
  ticketStatus: TicketStatus
  runState: RunState
  reply?: ArtifactDto
}

/** `GET /runs/:runId`. */
export interface RunDetailResponse {
  run: RunDto
  tasks: TaskDto[]
  steps: { id: string; state: RunState; at: string }[]
}

/** `GET /agents/:id` — `card` is the agent's own card, unmodified. */
export interface AgentDetailResponse {
  card: unknown
  recentTasks: TaskDto[]
}

/** `GET /agents/capabilities` — who can do what. */
export interface CapabilityRow {
  capability: string
  agentIds: AgentId[]
}

export interface Stats {
  active: number
  aiWorking: number
  needsApproval: number
  resolvedToday: number
  avgResolutionMins: number
}

export interface Insight {
  affectedTenants: number
  affectedRecords: number
  firstSeen: string
  trend: { date: string; count: number }[]
  sql: string
}

export interface AskColumn {
  key: string
  label: string
  type: string
  /** Which value gets the inline bar. */
  primary?: boolean
}

export type AskAnswer =
  | {
      shape: 'table'
      title: string
      columns: AskColumn[]
      rows: Record<string, string | number>[]
      sql: string
    }
  | { shape: 'number'; title: string; value: number; unit?: string; sql: string }
  | {
      shape: 'series'
      title: string
      series: { x: string; y: number }[]
      unit?: string
      sql: string
    }

export interface SignalBody {
  source: string
  kind: string
  summary: string
  metrics?: Record<string, unknown>
  escalate?: boolean
}

export interface SignalResponse {
  signal: SignalDto
  ticket: TicketDto | null
}

export interface ProcessDefinitionDto {
  key: string
  name: string
  trigger: 'event' | 'schedule' | 'manual'
  steps: { id: string; requiredCapability: string }[]
  approvals: { after: string; reason: string }[]
}

export interface ProcessRunResponse {
  ticketId: string
  runId: string
  started: boolean
  processKey: string
}

// ---------------------------------------------------------------------------
// Extensions
// ---------------------------------------------------------------------------

/**
 * Outside the frozen contract: endpoints this deployment happens to serve.
 * A compliant backend implements none of them, so every consumer treats them
 * as optional and degrades quietly on a 404. That rule is what keeps the
 * promise that pointing the console at another backend is a URL change.
 */
export interface WorkspaceSummary {
  id: string
  name: string
  product: string
  ticketPrefix: string
  tagline: string
  accent: string
}

export interface MemoryEntry {
  id: string
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
}

export interface MemoryMatch {
  entry: MemoryEntry
  confidence: number
  reason: string
}

export interface KnowledgeEntry {
  id: string
  title: string
  description: string
  type: string
  version: string
  updatedAt: string
  usedBy: string[]
  content: { heading: string; bullets: string[] }[]
  relatedTicketRefs: string[]
}
