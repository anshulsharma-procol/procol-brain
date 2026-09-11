/**
 * ============================================================================
 *  SCENARIO AUTHORING FORMAT
 * ============================================================================
 *
 * A scenario is one end-to-end run written as data. Adding a new customer
 * case — a new company, a new class of issue — is a new file in this folder
 * and one line in `index.ts`. No component, hook or type changes.
 *
 * Authors write the *story*; `compile.ts` handles the bookkeeping (sequence
 * numbers, ids, timestamps, stage derivation, progress) so a data file never
 * contains a `seq: 7`.
 */
import type {
  Artifact,
  ArtifactKind,
  MemoryEntry,
  ResolutionPath,
  StageId,
  Ticket,
  TicketChannel,
  TicketPriority,
  TicketStatus,
} from '../types'

/** One line of the run, as the author writes it. */
export interface ScenarioEvent {
  /** Which agent is speaking. 'human' for a person. */
  from: string
  /** Present on A2A hops. */
  to?: string
  /** A2A task type, rendered in mono, e.g. 'INVESTIGATE_BUG'. */
  taskType?: string
  kind:
    | 'thought' // Brain reasoning in plain English
    | 'request' // Brain -> agent
    | 'response' // agent -> Brain
    | 'artifact' // something was produced
    | 'gate' // run stopped for a human
    | 'decision' // a human decided
    | 'notify' // customer told
    | 'done'
  title: string
  body?: string[]
  /** Indented sub-lines. 3-5 per agent makes the run feel like real work. */
  logs?: string[]
  level?: 'info' | 'success' | 'warn' | 'error'
  /** Real latency of the hop, in ms. Shown on screen. */
  durationMs?: number
  /** Raw A2A payload behind the "show payload" disclosure. */
  payload?: unknown
  /** Artifact produced by this step, by id, when `kind` is 'artifact'. */
  artifactId?: string
  /** Stage this event completes, if any. Drives the four-dot rail. */
  completesStage?: StageId
  /** Seconds after the ticket was created. Used for timestamps and replay. */
  atSeconds: number
}

/** Artifacts are authored without the ids and timestamps the store adds. */
export type ScenarioArtifact = {
  [K in ArtifactKind]: {
    id: string
    kind: K
    title: string
    createdBy: string
    data: Extract<Artifact, { kind: K }>['data']
  }
}[ArtifactKind]

export interface Scenario {
  id: string
  workspaceId: string

  ticket: {
    reference: string
    title: string
    description: string
    customer: string
    reportedBy?: string
    channel: TicketChannel
    priority: TicketPriority
    category: string
    impact: string
    issueQuote: string[]
    attachment?: string
    /** Minutes before "now" that the ticket was raised. */
    createdMinutesAgo: number
  }

  /** The path Brain chose, and the stages this path actually needs. */
  path: ResolutionPath
  /** Defaults to all four. A CONFIG_FIX skips 'investigate' and 'verify'. */
  stages?: StageId[]

  /** Where the run currently stands. Historical runs are 'RESOLVED'. */
  status: TicketStatus

  events: ScenarioEvent[]
  artifacts: ScenarioArtifact[]

  /** Policy id from the workspace that gated this run. */
  approvalPolicyId?: string

  /** Written when the run closes — this is the institutional memory. */
  memory?: Omit<MemoryEntry, 'id' | 'workspaceId' | 'sourceTicketRef' | 'learnedAt'>

  /**
   * Replay speed for the live demo. The mock API streams events at
   * `atSeconds * replayScale` milliseconds. 0 renders the run instantly.
   */
  replayScale?: number
}

/** Lightweight board rows for tickets with no scripted run behind them. */
export interface BackgroundTicket
  extends Pick<
    Ticket,
    | 'reference'
    | 'title'
    | 'customer'
    | 'status'
    | 'priority'
    | 'channel'
    | 'category'
    | 'progress'
  > {
  workspaceId: string
  currentAgentId?: string
  currentAgentAction?: string
  updatedMinutesAgo: number
}
