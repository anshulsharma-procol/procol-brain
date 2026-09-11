import type {
  DecisionOutcome,
  KnowledgeEntry,
  MemoryEntry,
  MemoryMatch,
  Ticket,
  TicketDetail,
  Workspace,
  WorkspaceStats,
} from '../types'

/**
 * ============================================================================
 *  THE ONLY CONTRACT THE UI KNOWS ABOUT
 * ============================================================================
 *
 * Every screen talks to this interface and nothing else. Today it is served
 * by `mockApi.ts` from the scenario files; when the Brain API is live, point
 * `VITE_BRAIN_API_URL` at it and `httpApi.ts` takes over — no component, hook
 * or type changes, and the mock stays as the offline demo and the test double.
 *
 * Method names and payloads deliberately mirror the REST contract in
 * `docs/BACKEND_API_CONTRACT.md`, so the HTTP adapter stays a thin translation.
 */
export interface ConsoleApi {
  /** GET /workspaces */
  listWorkspaces(): Promise<Workspace[]>
  /** GET /workspaces/:id */
  getWorkspace(workspaceId: string): Promise<Workspace>

  /** GET /workspaces/:id/stats */
  getStats(workspaceId: string): Promise<WorkspaceStats>

  /** GET /workspaces/:id/tickets */
  listTickets(workspaceId: string, filter?: TicketFilter): Promise<Ticket[]>
  /** GET /tickets/:ref — ticket, stages, timeline, artifacts and memory hits. */
  getTicket(ticketRef: string): Promise<TicketDetail>
  /** POST /tickets */
  createTicket(input: CreateTicketInput): Promise<Ticket>

  /** POST /tickets/:ref/investigate — returns immediately; watch the stream. */
  startInvestigation(ticketRef: string): Promise<{ runId: string }>
  /** POST /tickets/:ref/decision */
  submitDecision(ticketRef: string, decision: DecisionInput): Promise<TicketDetail>

  /**
   * GET /stream (all tickets) or GET /tickets/:ref/stream (one).
   * The mock pushes from a timer; the HTTP adapter opens an EventSource.
   * Both hand the caller the same events, so the UI cannot tell them apart.
   */
  subscribe(target: StreamTarget, listener: StreamListener): Unsubscribe

  /** GET /workspaces/:id/memory */
  listMemory(workspaceId: string): Promise<MemoryEntry[]>
  /** POST /workspaces/:id/memory/search — institutional memory lookup. */
  searchMemory(workspaceId: string, query: string): Promise<MemoryMatch[]>

  /** GET /workspaces/:id/knowledge */
  listKnowledge(workspaceId: string): Promise<KnowledgeEntry[]>
}

export interface TicketFilter {
  status?: Ticket['status'][]
}

export interface CreateTicketInput {
  workspaceId: string
  title: string
  description: string
  customer: string
  priority?: Ticket['priority']
  channel?: Ticket['channel']
}

export interface DecisionInput {
  outcome: DecisionOutcome
  by: string
  note?: string
}

/** Subscribe to one ticket, or to everything in a workspace. */
export type StreamTarget =
  | { kind: 'ticket'; ticketRef: string }
  | { kind: 'workspace'; workspaceId: string }

/**
 * What the stream pushes. `ticket.updated` carries the whole detail so a
 * consumer never has to re-fetch to stay consistent — the same guarantee an
 * SSE event plus a cache write gives on the real backend.
 */
export type StreamMessage =
  | { type: 'ticket.updated'; detail: TicketDetail }
  | { type: 'board.updated'; workspaceId: string }

export type StreamListener = (message: StreamMessage) => void
export type Unsubscribe = () => void
