import type { AgentActivity } from './a2a'
import type {
  BrainTicket,
  InvestigationStep,
  Resolution,
  SimilarIssue,
} from './brain'

/**
 * The single source of truth for "where are we in the support conversation".
 * Every screen the widget can show is derived from this, so there are no
 * `isLoading` / `isSearching` / `hasSolution` booleans anywhere.
 */
export type WorkflowState =
  | 'INITIAL'
  | 'USER_MESSAGE'
  | 'SEARCHING_SIMILAR_ISSUES'
  | 'SIMILAR_ISSUE_FOUND'
  | 'WAITING_FOR_CONFIRMATION'
  | 'INVESTIGATING'
  | 'AGENTS_WORKING'
  | 'RESOLUTION_READY'
  | 'RESOLVED'

export type MessageAuthor = 'user' | 'assistant'

interface BaseMessage {
  id: string
  createdAt: number
}

/** Plain chat bubble. */
export interface TextMessage extends BaseMessage {
  kind: 'text'
  author: MessageAuthor
  text: string
}

/** Inline progress line, e.g. "Searching previous solutions...". */
export interface StatusMessage extends BaseMessage {
  kind: 'status'
  text: string
  status: 'running' | 'done' | 'empty'
}

/** Rendered as a SimilarIssueCard. */
export interface SimilarIssueMessage extends BaseMessage {
  kind: 'similar-issue'
  issue: SimilarIssue
}

/** Rendered as a live InvestigationProgress list. */
export interface InvestigationMessage extends BaseMessage {
  kind: 'investigation'
  ticket: BrainTicket
  steps: InvestigationStep[]
}

/** Rendered as the live Brain <-> agent communication feed. */
export interface AgentActivityMessage extends BaseMessage {
  kind: 'agent-activity'
  entries: AgentActivity[]
}

/** Rendered as a ResolutionCard. */
export interface ResolutionMessage extends BaseMessage {
  kind: 'resolution'
  resolution: Resolution
}

/** Terminal "issue resolved" confirmation. */
export interface ResolvedMessage extends BaseMessage {
  kind: 'resolved'
  ticket: BrainTicket
  headline: string
  checks: string[]
}

export type BrainMessage =
  | TextMessage
  | StatusMessage
  | SimilarIssueMessage
  | InvestigationMessage
  | AgentActivityMessage
  | ResolutionMessage
  | ResolvedMessage

/** A button the user can press instead of typing. */
export interface SuggestedAction {
  id: string
  label: string
  /** `primary` renders filled, `secondary` outlined. */
  tone?: 'primary' | 'secondary'
}
