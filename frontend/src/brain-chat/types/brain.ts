import type { AgentActivity } from './a2a'

/**
 * Domain entities exchanged between the widget and the Brain backend.
 * These types are pure data - they contain no React or DOM concepts.
 */

/** Where in the host application the conversation started. */
export interface BrainContext {
  /** Route / page identifier, e.g. `"grn"`. */
  currentPage?: string
  /** Human readable module name, e.g. `"GRN"`. */
  currentModule?: string
  /** Record the user was looking at, e.g. `"GRN/2627/5"`. */
  recordId?: string
  /** Anything else the host wants to attach. */
  [key: string]: unknown
}

/** Identity of the conversation, sent with every Brain API call. */
export interface BrainIdentity {
  companyId: string
  userId?: string
}

export type TicketStatus = 'open' | 'investigating' | 'awaiting_approval' | 'resolved'

export interface BrainTicket {
  id: string
  /** Display number, e.g. `"1245"`. */
  reference: string
  title: string
  status: TicketStatus
  createdAt: string
  context?: BrainContext
}

/** A previously resolved issue that looks like the one being reported. */
export interface SimilarIssue {
  id: string
  /** Display number, e.g. `"892"`. */
  reference: string
  title: string
  customer: string
  /** Short explanation of how it was fixed previously. */
  solution: string
  /** 0..1 similarity score, when the backend provides one. */
  confidence?: number
  /** Optional deep link into the internal console. */
  url?: string
}

export type InvestigationStepStatus = 'pending' | 'active' | 'complete'

export interface InvestigationStep {
  id: string
  label: string
  /** Agent responsible for the step, e.g. `"Clara"`. */
  agent?: string
  status: InvestigationStepStatus
  detail?: string
}

export interface InvestigationProgressUpdate {
  ticketId: string
  steps: InvestigationStep[]
  /** Agent-to-agent hops and MCP tool calls revealed so far. */
  activity?: AgentActivity[]
  /** Present once the agents have produced a resolution. */
  resolution?: Resolution
}

export interface ResolutionCheck {
  label: string
  status: InvestigationStepStatus
}

export interface Resolution {
  ticketId: string
  summary: string
  rootCause?: string
  checks: ResolutionCheck[]
  tests?: {
    passed: number
    total: number
  }
  /** Pull request produced by the Dev Agent. */
  pr?: {
    number: number
    status: 'created' | 'open' | 'merged'
    title?: string
    url?: string
    /**
     * False when the pull request was not really opened — the patch exists on
     * a branch and nothing else does. The widget then shows the number as
     * plain text and says "prepared", because a link the customer cannot open
     * is worse than no link.
     */
    real?: boolean
  }
  /** Files the fix touched. */
  filesChanged?: string[]
  /** True once a human approver has signed off. */
  approved?: boolean
  /** Who approved, when `approved` is true. */
  approver?: string
}

/** Free-form assistant reply for question-style messages. */
export interface BrainReply {
  message: string
}
