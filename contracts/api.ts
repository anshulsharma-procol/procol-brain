/**
 * ============================================================================
 *  SYNAPSE — API CONTRACT
 * ============================================================================
 *
 * The shared boundary between backend and frontend. Both sides compile against
 * this file. It is the single source of truth; the JSON in
 * docs/API_CONTRACT.md is these types rendered.
 *
 * FROZEN. Additive changes are free — a new optional field costs nobody
 * anything. Renames and removals are not: add a new field rather than
 * renaming an old one, even when the old name is wrong, and say it out loud in
 * the room before you touch anything here.
 *
 * This file is copied into both packages by `npm run contract:sync` at the
 * repo root, and `npm run contract:check` fails if the copies have drifted.
 * Edit THIS file, never a copy.
 */

// ---------------------------------------------------------------------------
// §1 Shared types
// ---------------------------------------------------------------------------

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type Channel = 'email' | 'portal' | 'slack' | 'signal' | 'event'
export type Category = 'BUG' | 'CONFIG' | 'QUESTION' | 'PROCESS'

export type TicketStatus =
  | 'NEW'
  | 'RUNNING'
  | 'AWAITING_APPROVAL'
  | 'RESOLVED'
  | 'NEEDS_HUMAN'
  | 'REJECTED'

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

export type RunPath = 'CODE_FIX' | 'CONFIG_FIX' | 'ANSWER_ONLY' | 'PROCESS'

/** Known ids, open to any string: the registry is discovered, not enumerated. */
export type AgentId = 'brain' | 'clara' | 'dev-agent' | 'qa-agent' | (string & {})

export type TaskType =
  | 'GET_PRODUCT_CONTEXT'
  | 'INVESTIGATE_BUG'
  | 'VALIDATE_FIX'
  | 'VERIFY_DOCUMENTS'
  | 'CREATE_RECORD'
  | 'NOTIFY'

export type ArtifactKind =
  | 'ROOT_CAUSE'
  | 'PR'
  | 'TEST_RESULT'
  | 'CONFIG_FIX'
  | 'CUSTOMER_REPLY'
  | 'IMPACT'
  | 'PROCESS_RESULT'

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

export type Level = 'info' | 'success' | 'warn' | 'error'

export interface Ticket {
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

export interface Run {
  id: string
  ticketId: string
  state: RunState
  path: RunPath | null
  /** 1 or 2. The dev↔QA loop is capped. */
  attempt: number
  summary: string | null
  /** Why approval is required — render it above the button. */
  policyReason: string | null
  startedAt: string
  endedAt: string | null
}

export interface Activity {
  id: string
  ticketId: string
  runId: string | null
  /** Order and dedupe on this. Never on createdAt. */
  seq: number
  type: ActivityType
  fromAgent: AgentId | null
  toAgent: AgentId | null
  /** The one line shown in the timeline. */
  title: string
  /** Prose, or a JSON string for the payload disclosure. Stays a string. */
  body: string | null
  level: Level
  /** Groups agent.log lines under their parent exchange. */
  taskId: string | null
  /** Present on a2a.response. */
  durationMs: number | null
  createdAt: string
}

export interface Artifact {
  id: string
  ticketId: string
  kind: ArtifactKind
  title: string
  /** Discriminated by kind — see §3 below. Parsed, never a JSON string. */
  data: ArtifactData
  createdAt: string
}

export interface Task {
  id: string
  ticketId: string
  runId: string
  fromAgent: AgentId
  toAgent: AgentId
  type: TaskType
  status: 'PENDING' | 'WORKING' | 'COMPLETED' | 'FAILED'
  /** Parsed JSON, not a string. */
  input: unknown
  output: unknown | null
  error: string | null
  durationMs: number | null
  startedAt: string
  endedAt: string | null
}

export interface Agent {
  id: AgentId
  name: string
  kind: 'knowledge' | 'engineering' | 'validation' | 'ops'
  baseUrl: string
  protocol: 'A2A'
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN'
  capabilities: string[]
  tools: { name: string; via: 'MCP' | 'CONNECTOR' }[]
  description: string | null
  lastSeenAt: string | null
  tasksToday: number
}

export interface Connector {
  id: string
  kind: 'database' | 'warehouse' | 'saas-api' | 'file' | 'event-stream' | 'mcp'
  capabilities: string[]
  health: { ok: boolean; latencyMs: number }
}

// ---------------------------------------------------------------------------
// §3 Artifact payloads — the approval panel depends on these exact shapes
// ---------------------------------------------------------------------------

export interface RootCauseData {
  summary: string
  detail: string
  /** 0–1. */
  confidence: number
}

export interface PrData {
  number: number
  url: string
  state: 'created' | 'merged' | 'mock'
  branch: string
  files: string[]
  additions: number
  deletions: number
  /** Unified diff. The UI renders red/green lines from this string. */
  patch: string
}

export interface TestResultData {
  status: 'passed' | 'failed'
  total: number
  passed: number
  failed: number
  durationMs: number
  suites: string[]
  failures: string[]
}

export interface ConfigFixData {
  summary: string
  steps: string[]
  system: string
}

export interface CustomerReplyData {
  subject: string
  body: string
  sentTo: string
}

export interface ImpactData {
  affectedTenants: number
  affectedRecords: number
  firstSeen: string
}

export interface ProcessResultData {
  processKey: string
  stepsCompleted: string[]
  records: { type: string; id: string }[]
}

export type ArtifactData =
  | RootCauseData
  | PrData
  | TestResultData
  | ConfigFixData
  | CustomerReplyData
  | ImpactData
  | ProcessResultData

/** Narrow an artifact to its payload by kind. */
export type ArtifactOf<K extends ArtifactKind> = Artifact & {
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
// §0 Envelopes
// ---------------------------------------------------------------------------

/** Lists are always wrapped. Single objects are returned bare. */
export interface ListResponse<T> {
  data: T[]
}

export interface ErrorResponse {
  error: { code: string; message: string }
}

// ---------------------------------------------------------------------------
// §2 Endpoint payloads
// ---------------------------------------------------------------------------

/**
 * Which agent completed each stage, or null if it has not been reached. This
 * is what lets the four-dot rail pick each dot's colour. The stage in flight
 * is the first null while the ticket is RUNNING.
 */
export interface Stage {
  context: AgentId | null
  investigate: AgentId | null
  verify: AgentId | null
  approve: AgentId | null
}

/** A row of `GET /api/tickets`. */
export interface TicketListRow extends Ticket {
  run: Pick<Run, 'id' | 'state' | 'path' | 'attempt' | 'startedAt'> | null
  stage: Stage
}

/** `GET /api/tickets/:id`. Paints the whole page except the timeline. */
export interface TicketDetailResponse {
  ticket: Ticket
  /** null before the first investigation. */
  run: Run | null
  artifacts: Artifact[]
  /** null unless one exists. */
  insight: Pick<ImpactData, 'affectedTenants' | 'affectedRecords'> | null
}

/** `POST /api/tickets`. */
export interface CreateTicketBody {
  customer: string
  title: string
  description: string
  priority?: Priority
  channel?: Channel
}

/** `POST /api/tickets/:id/investigate` — 202, or 200 with the active run. */
export interface InvestigateResponse {
  runId: string
  state: RunState
}

/** `POST /api/tickets/:id/decision`. */
export interface DecisionBody {
  decision: 'APPROVE' | 'REJECT'
  note?: string
}

export interface DecisionResponse {
  ticket: Ticket
  run: Run
  artifacts: Artifact[]
}

/** `GET /api/agents/:id` — `card` is the agent's own card, unmodified. */
export interface AgentDetailResponse {
  agent: Agent
  card: unknown
  recentTasks: Task[]
}

/** `GET /api/stats`. */
export interface Stats {
  active: number
  aiWorking: number
  needsApproval: number
  resolvedToday: number
  avgResolutionMins: number
}

/** `GET /api/insights?ticketId=`. */
export interface Insight {
  affectedTenants: number
  affectedRecords: number
  firstSeen: string
  trend: { date: string; count: number }[]
}

/** `POST /api/ask` — discriminated on `shape`. */
export interface AskColumn {
  key: string
  label: string
  type: 'string' | 'number' | 'currency' | 'date'
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
      tookMs: number
    }
  | {
      shape: 'number'
      title: string
      value: number
      unit?: string
      delta?: { value: number; label: string }
      sql: string
      tookMs: number
    }
  | {
      shape: 'series'
      title: string
      unit?: string
      points: { x: string; y: number }[]
      sql: string
      tookMs: number
    }

/** `POST /api/signals`. */
export interface SignalBody {
  source: string
  kind: string
  summary: string
  metrics: Record<string, unknown>
  escalate?: boolean
}

export interface Signal {
  id: string
  source: string
  kind: string
  summary: string
  metrics: Record<string, unknown>
  ticketId: string | null
  createdAt: string
}

export interface SignalResponse {
  signal: Signal
  ticket: Ticket | null
}

/** `GET /api/processes`. */
export interface ProcessDefinition {
  key: string
  name: string
  trigger: 'event' | 'schedule' | 'manual'
  steps: { id: string; requiredCapability: string }[]
  approvals: { after: string; reason: string }[]
}

export interface ProcessRunResponse {
  ticketId: string
  runId: string
}

// ---------------------------------------------------------------------------
// §4 SSE
// ---------------------------------------------------------------------------

/**
 * Every event carries `activityId` and `seq`. That is what makes the
 * history-plus-stream join safe: fetch `/activities`, open the stream, drop
 * any event whose `activityId` is already held. Without those two fields the
 * boundary entry double-renders, which is the commonest bug in this UI.
 */
export interface StreamEventBase {
  ticketId: string
  seq: number
  activityId: string
}

/**
 * The event NAME travels on the SSE `event:` line, so it is a key here rather
 * than a field in the payload — which is also why `a2a.request` can use
 * `type` for the task type without colliding with anything.
 */
export interface StreamEventMap {
  'ticket.created': StreamEventBase & { ticket: Ticket }
  'run.started': StreamEventBase & { runId: string }
  'run.state': StreamEventBase & {
    runId: string
    state: RunState
    path: RunPath | null
    attempt: number
  }
  'brain.thought': StreamEventBase & { text: string }
  'a2a.request': StreamEventBase & {
    taskId: string
    from: AgentId
    to: AgentId
    type: TaskType
    summary: string
  }
  'a2a.response': StreamEventBase & {
    taskId: string
    from: AgentId
    to: AgentId
    status: string
    summary: string
    durationMs: number | null
  }
  'agent.log': StreamEventBase & { taskId: string; agent: AgentId; line: string }
  'artifact.created': StreamEventBase & { artifact: Artifact }
  'run.awaiting_approval': StreamEventBase & { runId: string; policyReason: string }
  'run.completed': StreamEventBase & { runId: string; outcome: 'RESOLVED' | 'NEEDS_HUMAN' }
  /** Registry-level, so no ticket. */
  'agent.status': { agentId: AgentId; status: Agent['status'] }
  'signal.raised': { signal: Signal; ticketId: string | null }
}

export type StreamEventName = keyof StreamEventMap
export type StreamEventPayload<K extends StreamEventName = StreamEventName> = StreamEventMap[K]

// ---------------------------------------------------------------------------
// Extensions
// ---------------------------------------------------------------------------

/**
 * Everything below is OUTSIDE the frozen contract: additive endpoints this
 * deployment happens to serve. A contract-compliant backend is not required
 * to implement any of them, so every consumer must treat them as optional and
 * degrade quietly when they 404.
 *
 * That rule is what keeps the promise that pointing the console at a
 * different backend is a URL change: the screens that matter run on §2 alone,
 * and these only ever add to what is on screen.
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
  path: RunPath
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
