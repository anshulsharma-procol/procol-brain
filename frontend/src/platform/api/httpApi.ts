import type {
  KnowledgeEntry,
  MemoryEntry,
  MemoryMatch,
  Ticket,
  TicketDetail,
  Workspace,
  WorkspaceStats,
} from '../types'
import type {
  ConsoleApi,
  CreateTicketInput,
  DecisionInput,
  StreamListener,
  StreamTarget,
  TicketFilter,
  Unsubscribe,
} from './types'

/**
 * ============================================================================
 *  THE REAL BACKEND ADAPTER
 * ============================================================================
 *
 * This is the whole integration. Set `VITE_BRAIN_API_URL` and the console
 * stops reading scenario files and starts reading the Brain API — no screen,
 * hook or type changes, because both sides implement `ConsoleApi`.
 *
 * Endpoints it expects (mirrors docs/BACKEND_API_CONTRACT.md):
 *
 *   GET  {base}/workspaces
 *   GET  {base}/workspaces/:id
 *   GET  {base}/workspaces/:id/stats
 *   GET  {base}/workspaces/:id/tickets?status=A,B
 *   GET  {base}/workspaces/:id/memory
 *   POST {base}/workspaces/:id/memory/search   { query }
 *   GET  {base}/workspaces/:id/knowledge
 *   GET  {base}/tickets/:ref                   -> TicketDetail
 *   POST {base}/tickets                        -> Ticket
 *   POST {base}/tickets/:ref/investigate       -> { runId }   (202, immediate)
 *   POST {base}/tickets/:ref/decision          -> TicketDetail
 *   GET  {base}/tickets/:ref/stream            -> SSE
 *   GET  {base}/workspaces/:id/stream          -> SSE
 *
 * Lists come back as `{ data: [...] }`; errors as `{ error: { code, message } }`.
 */
export interface HttpConsoleApiOptions {
  baseUrl: string
  /** Auth token, tenant key, anything the gateway needs. */
  headers?: Record<string, string>
  /** Injectable for tests and for host-provided auth wrappers. */
  fetch?: typeof globalThis.fetch
}

export function createHttpConsoleApi(options: HttpConsoleApiOptions): ConsoleApi {
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await doFetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...options.headers, ...init?.headers },
    })

    if (!response.ok) {
      // One error shape, always. No stack trace ever reaches a screen.
      const body = await response.json().catch(() => null)
      throw new Error(
        body?.error?.message ?? `Brain API ${init?.method ?? 'GET'} ${path} failed (${response.status})`,
      )
    }

    return (await response.json()) as T
  }

  const get = <T,>(path: string) => request<T>(path)
  const post = <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
  const list = async <T,>(path: string) => (await get<{ data: T[] }>(path)).data
  const ref = (value: string) => encodeURIComponent(value)

  return {
    listWorkspaces: () => list<Workspace>('/workspaces'),
    getWorkspace: (workspaceId) => get<Workspace>(`/workspaces/${ref(workspaceId)}`),
    getStats: (workspaceId) => get<WorkspaceStats>(`/workspaces/${ref(workspaceId)}/stats`),

    listTickets: (workspaceId: string, filter?: TicketFilter) => {
      const query = filter?.status?.length ? `?status=${filter.status.join(',')}` : ''
      return list<Ticket>(`/workspaces/${ref(workspaceId)}/tickets${query}`)
    },

    getTicket: (ticketRef) => get<TicketDetail>(`/tickets/${ref(ticketRef)}`),
    createTicket: (input: CreateTicketInput) => post<Ticket>('/tickets', input),

    startInvestigation: (ticketRef) =>
      post<{ runId: string }>(`/tickets/${ref(ticketRef)}/investigate`),

    submitDecision: (ticketRef, decision: DecisionInput) =>
      post<TicketDetail>(`/tickets/${ref(ticketRef)}/decision`, decision),

    listMemory: (workspaceId) => list<MemoryEntry>(`/workspaces/${ref(workspaceId)}/memory`),
    searchMemory: (workspaceId, query) =>
      post<MemoryMatch[]>(`/workspaces/${ref(workspaceId)}/memory/search`, { query }),
    listKnowledge: (workspaceId) => list<KnowledgeEntry>(`/workspaces/${ref(workspaceId)}/knowledge`),

    subscribe(target: StreamTarget, listener: StreamListener): Unsubscribe {
      const path =
        target.kind === 'ticket'
          ? `/tickets/${ref(target.ticketRef)}/stream`
          : `/workspaces/${ref(target.workspaceId)}/stream`

      const source = new EventSource(`${baseUrl}${path}`)

      // The server sends one JSON object per `data:` line, with `event:` set
      // to the message type — the same union the mock pushes in-process.
      const onTicket = (event: MessageEvent<string>) => {
        listener({ type: 'ticket.updated', detail: JSON.parse(event.data) as TicketDetail })
      }
      const onBoard = (event: MessageEvent<string>) => {
        listener({ type: 'board.updated', ...(JSON.parse(event.data) as { workspaceId: string }) })
      }

      source.addEventListener('ticket.updated', onTicket as EventListener)
      source.addEventListener('board.updated', onBoard as EventListener)

      return () => {
        source.removeEventListener('ticket.updated', onTicket as EventListener)
        source.removeEventListener('board.updated', onBoard as EventListener)
        source.close()
      }
    },
  }
}
