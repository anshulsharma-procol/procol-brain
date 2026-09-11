import type {
  BrainContext,
  BrainIdentity,
  BrainReply,
  BrainTicket,
  InvestigationProgressUpdate,
  Resolution,
  SimilarIssue,
  TicketStatus,
} from '../types/brain'

export interface BrainRequest {
  identity: BrainIdentity
  context?: BrainContext
}

export interface MessageRequest extends BrainRequest {
  message: string
}

export interface TicketRequest extends BrainRequest {
  ticketId: string
}

export interface InvestigationOptions {
  /** Called every time the agent pipeline advances. */
  onProgress?: (update: InvestigationProgressUpdate) => void
  /** Abort an in-flight investigation (widget closed, user restarted). */
  signal?: AbortSignal
}

/**
 * The only contract the UI knows about. Swap the implementation to move from
 * the bundled mock to a real backend - no component changes required.
 */
export interface BrainApi {
  searchSimilarIssues(request: MessageRequest): Promise<SimilarIssue[]>
  createTicket(request: MessageRequest): Promise<BrainTicket>
  startInvestigation(
    request: TicketRequest,
    options?: InvestigationOptions,
  ): Promise<Resolution>
  getTicketStatus(request: TicketRequest): Promise<TicketStatus>
  sendMessage(request: MessageRequest): Promise<BrainReply>
  /**
   * Optional: re-read the resolution after the human gate.
   *
   * The investigation ends when a fix is *proposed*; approval happens
   * afterwards, in the support team's console. A backend that can answer this
   * lets the customer watch their own ticket cross the gate instead of being
   * told to check back later. Implementations without it simply do not offer
   * that, and nothing else changes.
   */
  getResolution?(request: TicketRequest): Promise<Resolution | undefined>
}

export interface BrainClientOptions {
  /** Root of the Brain API, e.g. `https://brain-api.company.com`. */
  baseUrl: string
  /** Extra headers (auth token, tenant key). */
  headers?: Record<string, string>
  /** Custom fetch, useful for tests or for host-provided auth wrappers. */
  fetch?: typeof globalThis.fetch
  /** Poll interval for investigation progress, in ms. */
  pollIntervalMs?: number
}

/**
 * HTTP adapter for a real Brain API / Gateway.
 *
 * Expected endpoints:
 *   POST   {base}/issues/search           -> SimilarIssue[]
 *   POST   {base}/tickets                 -> BrainTicket
 *   POST   {base}/tickets/:id/investigate -> { ok: true }
 *   GET    {base}/tickets/:id/progress    -> InvestigationProgressUpdate
 *   GET    {base}/tickets/:id             -> BrainTicket
 *   POST   {base}/messages                -> BrainReply
 */
export function createBrainClient(options: BrainClientOptions): BrainApi {
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch
  const pollIntervalMs = options.pollIntervalMs ?? 1500

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await doFetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
        ...init?.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Brain API ${init?.method ?? 'GET'} ${path} failed (${response.status})`)
    }

    return (await response.json()) as T
  }

  const post = <T,>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body), signal })

  return {
    searchSimilarIssues: (payload) =>
      post<SimilarIssue[]>('/issues/search', payload),

    createTicket: (payload) => post<BrainTicket>('/tickets', payload),

    getTicketStatus: async ({ ticketId }) => {
      const ticket = await request<BrainTicket>(`/tickets/${encodeURIComponent(ticketId)}`)
      return ticket.status
    },

    sendMessage: (payload) => post<BrainReply>('/messages', payload),

    async startInvestigation({ ticketId, identity, context }, investigation) {
      await post(
        `/tickets/${encodeURIComponent(ticketId)}/investigate`,
        { identity, context },
        investigation?.signal,
      )

      // Poll until the orchestrator reports a resolution. A streaming
      // transport (SSE / websocket) can replace this without touching the UI.
      for (;;) {
        if (investigation?.signal?.aborted) {
          throw new DOMException('Investigation aborted', 'AbortError')
        }

        const update = await request<InvestigationProgressUpdate>(
          `/tickets/${encodeURIComponent(ticketId)}/progress`,
          { signal: investigation?.signal },
        )
        investigation?.onProgress?.(update)

        if (update.resolution) return update.resolution

        await delay(pollIntervalMs, investigation?.signal)
      }
    },
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    function onAbort() {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
