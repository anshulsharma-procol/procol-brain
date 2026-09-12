import type {
  ActivityDto,
  AgentDto,
  ArtifactDto,
  ConnectorDto,
  ProcessDefinitionDto,
  RunDto,
  SignalDto,
  Stats,
  TicketDto,
} from '../contract'
import { createActivityNormaliser, normaliseActivities } from './activityEnvelope'
import type {
  Connection,
  ConnectionType,
  MemoryEntry,
  MemoryMatch,
  Stage,
  Ticket,
  TicketDetail,
  Workspace,
} from '../types'
import type {
  AddConnectionInput,
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
 *  THE CONTRACT ADAPTER
 * ============================================================================
 *
 * Speaks docs/API_CONTRACT.md and nothing else, then adapts it into the view
 * model the screens use. This file is the whole integration: point
 * VITE_BRAIN_API_URL at any backend that implements §2 and the console works,
 * because nothing above this line knows the wire format exists.
 *
 * Two rules it keeps, and they are the reason that claim holds:
 *
 *  - Everything the screens need is derived from §2 alone. Fields this
 *    deployment adds (a category label, a workspace id, the agent currently
 *    holding the work) are read when present and done without when absent.
 *  - Endpoints outside the contract — workspaces, memory, knowledge — are
 *    probed once and disabled quietly on a 404. A backend that has never
 *    heard of them serves a console that simply does not show those panels.
 */
export interface HttpConsoleApiOptions {
  baseUrl: string
  headers?: Record<string, string>
  /**
   * Injectable transport. The offline fixture mode is exactly this client
   * with a fetch that answers from a captured snapshot — which means there is
   * only ever one implementation of the contract on this side, and the
   * fixtures are checked against the same parsing the network path uses.
   */
  fetch?: typeof globalThis.fetch
  /** Fixture mode has nothing to stream. */
  streaming?: boolean
}

/**
 * Which agent completed each of the four stages, or null.
 *
 * Not in the contract — a compliant `GET /tickets` returns bare tickets — so
 * everything downstream treats it as optional and the rail falls back to the
 * run state. This deployment sends it because one request per row to rebuild
 * a board is not a real option.
 */
type StageMap = Record<Stage['id'], string | null>

/** Additive fields this deployment sends. Everything here is optional. */
interface TicketExtras {
  categoryLabel?: string
  workspaceId?: string
  reportedBy?: string
  impact?: string
  issueQuote?: string[]
  attachment?: string
  currentAgentId?: string
  currentAgentAction?: string
  run?: (Pick<RunDto, 'id' | 'state' | 'path' | 'attempt' | 'startedAt'> & Partial<RunDto>) | null
  stage?: StageMap
}

/** `GET /tickets/:id` — the contract's response, plus what we add to it. */
interface TicketDetailBody {
  ticket: TicketDto & TicketExtras
  run: RunDto | null
  artifacts: ArtifactDto[]
  approval: { required: boolean; policyId?: string; reason?: string } | null
  signal: SignalDto | null

  // additive
  stage?: StageMap
  decision?: TicketDetail['decision'] | null
}

export function createHttpConsoleApi(options: HttpConsoleApiOptions): ConsoleApi {
  const baseUrl = options.baseUrl.replace(/\/+$/, '')
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis)

  /** Extension endpoints that answered 404 once and are not asked again. */
  const unavailable = new Set<string>()

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await doFetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...options.headers, ...init?.headers },
    })

    if (!response.ok) {
      // One error shape, always — and never a stack trace on a screen.
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null
      throw Object.assign(
        new Error(
          body?.error?.message ??
            `Brain API ${init?.method ?? 'GET'} ${path} failed (${response.status})`,
        ),
        // Carried so `optional()` can tell "this backend does not have that
        // endpoint" from "the network ate it". Those two must not be treated
        // alike; see the latch below.
        { status: response.status },
      )
    }

    // 204 and friends carry nothing to parse.
    if (response.status === 204) return undefined as T

    // A tunnel that is down answers every path with an HTML page, and a free
    // ngrok tunnel answers browser-shaped requests with its interstitial —
    // both with a 2xx or a 404 and neither with JSON. Caught here so the
    // failure names itself, rather than surfacing as a JSON parse error
    // pointing at a backend that is behaving perfectly well.
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('json')) {
      const body = await response.text().catch(() => '')
      const tunnel = /ERR_NGROK_\d+/.exec(body)?.[0]
      throw Object.assign(
        new Error(
          tunnel
            ? `The Brain is not reachable — the tunnel reported ${tunnel}.`
            : `Brain API ${init?.method ?? 'GET'} ${path} answered ${contentType || 'no content-type'} rather than JSON.`,
        ),
        { status: 0 },
      )
    }

    return (await response.json()) as T
  }

  /** An extension: undefined rather than an error when the backend lacks it. */
  async function optional<T>(key: string, path: string, init?: RequestInit): Promise<T | undefined> {
    if (unavailable.has(key)) return undefined

    try {
      return await request<T>(path, init)
    } catch (error) {
      // Latch only on an answer that means "there is no such endpoint here".
      // Anything else — a 5xx, a dropped connection, a tunnel serving its own
      // error page — is a backend having a moment, and a moment must not
      // disable a panel for the rest of the session. Getting this wrong is
      // invisible and expensive: one flap during startup and Memory,
      // Knowledge and the workspace switcher stay empty until a reload, while
      // the backend serves them perfectly.
      const status = (error as { status?: number }).status
      if (status === 404 || status === 501) unavailable.add(key)
      return undefined
    }
  }

  const get = <T,>(path: string) => request<T>(path)
  const post = <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
  const listOf = async <T,>(path: string) => (await get<{ data: T[] }>(path)).data

  /**
   * The transcript, from either envelope and either wrapper.
   *
   * The contract lists this as `{ data: [...] }`; a deployment that answers
   * with a bare array is taken too, because that difference is not worth a
   * blank page. Rows are reconciled on the way in — see activityEnvelope.ts,
   * which is the only thing on this side that knows two envelopes exist.
   */
  const activitiesOf = async (ticketRef: string): Promise<ActivityDto[]> => {
    const body = await get<{ data?: unknown[] } | unknown[]>(
      `/tickets/${ref(ticketRef)}/activities`,
    )
    return normaliseActivities(Array.isArray(body) ? body : (body?.data ?? []))
  }
  const ref = (value: string) => encodeURIComponent(value)
  const scope = (workspaceId: string | undefined, separator = '?') =>
    workspaceId ? `${separator}workspace=${ref(workspaceId)}` : ''

  return {
    /**
     * The contract has no workspace concept: one backend is one control tower.
     * When the extension is absent, the console runs as a single unnamed
     * workspace assembled from the registry it can see.
     */
    async listWorkspaces() {
      const summaries = await optional<{ data: Workspace[] }>('workspaces', '/workspaces')

      if (!summaries?.data?.length) {
        const [agents, connectors] = await Promise.all([
          listOf<AgentDto>('/agents'),
          listOf<ConnectorDto>('/connectors').catch(() => []),
        ])
        return [buildImplicitWorkspace(agents, connectors)]
      }

      // Scoped per workspace rather than filtered from one list: two control
      // towers legitimately declare agents with the same ids — both have a
      // dev-agent — and merging them would show each tower the other's.
      return Promise.all(
        summaries.data.map(async (summary) => {
          const [agents, connectors] = await Promise.all([
            listOf<AgentDto>(`/agents?workspace=${ref(summary.id)}`),
            listOf<ConnectorDto>(`/connectors?workspace=${ref(summary.id)}`).catch(() => []),
          ])

          return { ...buildImplicitWorkspace(agents, connectors), ...summary }
        }),
      )
    },

    async getWorkspace(workspaceId) {
      const all = await this.listWorkspaces()
      return all.find((workspace) => workspace.id === workspaceId) ?? all[0]!
    },

    /**
     * The contract's Stats is five numbers. The charts the board draws are
     * computed here from the ticket list rather than asking for an endpoint
     * the contract does not define.
     */
    async getStats(workspaceId) {
      const [stats, tickets] = await Promise.all([
        get<Stats>(`/stats${scope(workspaceId)}`),
        this.listTickets(workspaceId),
      ])

      const memory = await optional<{ data: MemoryEntry[] }>(
        'memory',
        `/memory${scope(workspaceId)}`,
      )
      const minutesSaved = (memory?.data ?? []).reduce(
        (total, entry) => total + entry.reuseCount * entry.minutesSavedPerReuse,
        0,
      )

      const countBy = (status: Ticket['status']) =>
        tickets.filter((ticket) => ticket.status === status).length

      const responses = new Map<string, number>()
      for (const ticket of tickets) {
        if (!ticket.currentAgentId) continue
        responses.set(ticket.currentAgentId, (responses.get(ticket.currentAgentId) ?? 0) + 1)
      }

      const agents = await listOf<AgentDto>(`/agents${scope(workspaceId)}`)

      return {
        activeTickets: stats.active,
        aiWorking: stats.aiWorking,
        awaitingApproval: stats.needsApproval,
        resolvedThisWeek: stats.resolvedToday,
        hoursSavedThisMonth: Math.round(minutesSaved / 60),
        avgResolutionMinutes: stats.avgResolutionMins,
        ticketsByStatus: [
          { name: 'New', value: countBy('NEW'), color: '#3b82f6' },
          { name: 'Running', value: countBy('RUNNING'), color: '#7c3aed' },
          { name: 'Awaiting approval', value: countBy('AWAITING_APPROVAL'), color: '#f59e0b' },
          { name: 'Resolved', value: countBy('RESOLVED'), color: '#16a34a' },
        ],
        agentActivity: agents
          .filter((agent) => agent.tasksToday > 0)
          .map((agent) => ({ agentId: agent.id, name: agent.name, value: agent.tasksToday })),
      }
    },

    async listTickets(workspaceId: string, filter?: TicketFilter) {
      const query = [
        workspaceId ? `workspace=${ref(workspaceId)}` : '',
        filter?.status?.length ? `status=${filter.status.join(',')}` : '',
      ]
        .filter(Boolean)
        .join('&')

      const rows = await listOf<TicketDto & TicketExtras>(`/tickets${query ? `?${query}` : ''}`)
      return rows.map(adaptListRow)
    },

    async getTicket(ticketRef) {
      const [detail, activities] = await Promise.all([
        get<TicketDetailBody>(`/tickets/${ref(ticketRef)}`),
        activitiesOf(ticketRef),
      ])

      const matches = await optional<{ data: MemoryMatch[] }>(
        'memory-search',
        `/memory/search${scope(detail.ticket.workspaceId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ query: `${detail.ticket.title} ${detail.ticket.description}` }),
        },
      )

      return buildDetail(detail, activities, matches?.data ?? [])
    },

    async createTicket(input: CreateTicketInput) {
      const created = await post<TicketDto & TicketExtras>('/tickets', {
        customer: input.customer,
        title: input.title,
        description: input.description,
        priority: input.priority,
        channel: input.channel,
        workspaceId: input.workspaceId,
      })
      return adaptTicket(created, null, null)
    },

    async startInvestigation(ticketRef) {
      // 202 for a new run, 200 with started: false when this joined the one
      // already in flight. Both are success — a second click is not an error.
      const started = await post<{ runId: string; started: boolean }>(
        `/tickets/${ref(ticketRef)}/investigate`,
      )
      return { runId: started.runId }
    },

    async submitDecision(ticketRef, decision: DecisionInput) {
      await post(`/tickets/${ref(ticketRef)}/decision`, {
        decision: decision.outcome === 'APPROVED' ? 'APPROVE' : 'REJECT',
        note: decision.note,
        by: decision.by,
      })
      // The decision response is a subset; re-read so the page has the
      // timeline and the memory panel as well.
      return this.getTicket(ticketRef)
    },

    async listMemory(workspaceId) {
      const memory = await optional<{ data: MemoryEntry[] }>('memory', `/memory${scope(workspaceId)}`)
      return memory?.data ?? []
    },

    async searchMemory(workspaceId, query) {
      const matches = await optional<{ data: MemoryMatch[] }>(
        'memory-search',
        `/memory/search${scope(workspaceId)}`,
        { method: 'POST', body: JSON.stringify({ query }) },
      )
      return matches?.data ?? []
    },

    async listKnowledge(workspaceId) {
      const knowledge = await optional<{ data: never[] }>(
        'knowledge',
        `/knowledge${scope(workspaceId)}`,
      )
      return knowledge?.data ?? []
    },

    /**
     * §4. The history and the stream are joined by `activityId`: the page
     * fetches `/activities`, opens this, and drops any event it already
     * holds. Every payload carries the id and the seq that make that safe.
     */
    subscribe(target: StreamTarget, listener: StreamListener): Unsubscribe {
      if (options.streaming === false) return () => {}

      const path =
        target.kind === 'ticket'
          ? `/tickets/${ref(target.ticketRef)}/stream`
          : `/stream${scope(target.workspaceId)}`

      const source = new EventSource(`${baseUrl}${path}`)

      // The event name is the payload's own `type`, so subscribing by name
      // and switching on the field see the same thing. Listening per name
      // (rather than to the default `message`) is what keeps a future event
      // type from arriving as an unhandled row.
      const NAMES: ActivityDto['type'][] = [
        'ticket.created',
        'run.started',
        'run.state',
        'brain.thought',
        'a2a.request',
        'a2a.response',
        'agent.log',
        'artifact.created',
        'run.awaiting_approval',
        'run.completed',
        'agent.status',
        'signal.raised',
      ]

      const handlers = new Map<string, EventListener>()

      // Its own normaliser, not the history's: hop grouping is reconstructed
      // from the rows seen so far, and a reconnect must not inherit
      // half-open delegations from the connection it replaced.
      const normalise = createActivityNormaliser()

      for (const name of NAMES) {
        const handler = ((event: MessageEvent<string>) => {
          // The payload IS the activity row — the same object `/activities`
          // returns, down to the id and the seq. Nothing is reassembled, and
          // both paths go through the same normaliser so a row that arrives
          // live and the same row re-fetched are identical.
          const activity = normalise(JSON.parse(event.data))
          if (activity) listener({ type: 'activity', activity })
        }) as EventListener

        handlers.set(name, handler)
        source.addEventListener(name, handler)
      }

      const boardHandler = ((event: MessageEvent<string>) => {
        listener({ type: 'board.updated', ...(JSON.parse(event.data) as { workspaceId: string }) })
      }) as EventListener

      handlers.set('board.updated', boardHandler)
      source.addEventListener('board.updated', boardHandler)

      return () => {
        for (const [name, handler] of handlers) source.removeEventListener(name, handler)
        source.close()
      }
    },

    async listProcesses() {
      const processes = await optional<{ data: ProcessDefinitionDto[] }>('processes', '/processes')
      return processes?.data ?? []
    },

    /**
     * The contract's connector registry. Whatever the backend adds beyond the
     * four required fields comes through untouched, and the screen reads what
     * is there — so a contract-only backend still fills this page.
     */
    listConnections: (workspaceId) => listOf<Connection>(`/connectors${scope(workspaceId)}`),

    async listConnectionTypes() {
      const types = await optional<{ data: ConnectionType[] }>('connection-types', '/connection-types')
      return types?.data ?? []
    },

    addConnection: (input: AddConnectionInput) =>
      post<Connection>('/connectors', {
        workspaceId: input.workspaceId,
        name: input.name,
        category: input.category,
        description: input.description,
        endpoint: input.endpoint,
      }),

    reconnect: (workspaceId, id) =>
      post<Connection>(`/connectors/${ref(id)}/reconnect${scope(workspaceId)}`),

    async removeConnection(workspaceId, id) {
      await request(`/connectors/${ref(id)}${scope(workspaceId)}`, { method: 'DELETE' })
    },
  }
}

// ---------------------------------------------------------------------------
// Contract → view model
// ---------------------------------------------------------------------------

const STAGE_LABELS: { id: Stage['id']; label: string }[] = [
  { id: 'context', label: 'Context' },
  { id: 'investigate', label: 'Investigate' },
  { id: 'verify', label: 'Verify' },
  { id: 'approve', label: 'Approve' },
]

/**
 * The four-dot rail, from the contract's `stage` map plus the run's path.
 *
 * The contract has one way to say "no dot here yet", so a stage a path never
 * had and a stage it has not reached both arrive as null. `run.path` is what
 * separates them: a configuration fix never had an investigate stage, and
 * showing it as pending would claim work is still coming that never was.
 */
export function stagesFrom(stage: StageMap | undefined, run: RunDto | null, status: Ticket['status']): Stage[] {
  const skipped =
    run?.path === 'CONFIG_FIX' || run?.path === 'ANSWER_ONLY'
      ? new Set<Stage['id']>(['investigate', 'verify'])
      : new Set<Stage['id']>()

  const stages = STAGE_LABELS.map<Stage>(({ id, label }) => {
    const agentId = stage?.[id] ?? undefined

    if (skipped.has(id)) return { id, label, status: 'skipped', detail: 'Not needed on this path' }
    if (agentId) return { id, label, status: 'complete', agentId }
    return { id, label, status: 'pending' }
  })

  if (status === 'AWAITING_APPROVAL') {
    const approve = stages.find((candidate) => candidate.id === 'approve')
    if (approve) approve.status = 'active'
    return stages
  }

  if (status === 'RUNNING') {
    const next = stages.find((candidate) => candidate.status === 'pending')
    if (next) next.status = 'active'
  }

  return stages
}

function progressFrom(stages: Stage[], status: Ticket['status']): number {
  if (status === 'RESOLVED') return 100
  const live = stages.filter((stage) => stage.status !== 'skipped')
  if (live.length === 0) return 0

  const complete = live.filter((stage) => stage.status === 'complete').length
  const active = live.some((stage) => stage.status === 'active') ? 0.5 : 0
  return Math.round(((complete + active) / live.length) * 100)
}

/** What is happening right now, named without an extension field if need be. */
const RUN_STATE_ACTION: Record<string, string> = {
  RECEIVED: 'Received',
  CLASSIFYING: 'Classifying',
  GATHERING_CONTEXT: 'Fetching context',
  DECIDING: 'Deciding',
  INVESTIGATING: 'Investigating the code',
  VERIFYING: 'Running the suite',
  DRAFTING_REMEDIATION: 'Drafting the remediation',
  DRAFTING_REPLY: 'Drafting the reply',
  EXECUTING_PROCESS: 'Executing the process',
  AWAITING_APPROVAL: 'Waiting for your approval',
  RESOLVED: 'Closed',
  NEEDS_HUMAN: 'Waiting on a person',
}

function adaptTicket(
  ticket: TicketDto & TicketExtras,
  run: RunDto | null,
  stage: StageMap | null,
): Ticket {
  const stages = stagesFrom(stage ?? undefined, run, ticket.status)

  return {
    id: ticket.id,
    reference: ticket.id,
    workspaceId: ticket.workspaceId ?? 'default',
    title: ticket.title,
    description: ticket.description,
    customer: ticket.customer ?? 'Detected by monitoring',
    reportedBy: ticket.reportedBy,
    channel: ticket.channel,
    priority: ticket.priority,
    status: ticket.status,
    category: ticket.categoryLabel ?? humanise(ticket.category),
    impact: ticket.impact ?? '—',
    issueQuote: ticket.issueQuote ?? [ticket.description],
    attachment: ticket.attachment,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    path: run?.path ?? undefined,
    currentAgentId: ticket.currentAgentId ?? holderFrom(stage, run),
    currentAgentAction:
      ticket.currentAgentAction ?? (run ? RUN_STATE_ACTION[run.state] : undefined),
    progress: progressFrom(stages, ticket.status),
    stages,
  }
}

function adaptListRow(row: TicketDto & TicketExtras): Ticket {
  const run = row.run ? ({ ...row.run, path: row.run.path ?? null } as RunDto) : null
  return adaptTicket(row, run, row.stage ?? null)
}

/**
 * Who holds the work, when the backend has not said. The contract names the
 * agent that COMPLETED each stage, so the best that can be inferred is the
 * one who finished last — which is right for a board column and honest about
 * being an inference.
 */
function holderFrom(stage: StageMap | null | undefined, run: RunDto | null): string | undefined {
  if (!run) return undefined
  if (run.state === 'AWAITING_APPROVAL') return 'human-approver'
  if (!stage) return undefined

  return stage.verify ?? stage.investigate ?? stage.context ?? undefined
}

function humanise(category: TicketDto['category']): string {
  if (!category) return 'Uncategorised'
  return category.charAt(0) + category.slice(1).toLowerCase()
}

function buildDetail(
  detail: TicketDetailBody,
  activities: ActivityDto[],
  memoryMatches: MemoryMatch[],
): TicketDetail {
  // The rail, from the backend if it sends one and from the timeline if not:
  // the contract's detail response has no stage map, so a compliant backend
  // still fills the rail — by a longer route, from the same information.
  const stage = detail.stage ?? detail.ticket.stage ?? stageFromActivities(activities)
  const ticket = adaptTicket(detail.ticket, detail.run, stage)

  return {
    ticket,
    stages: ticket.stages ?? [],
    activity: activities,
    artifacts: detail.artifacts,
    memoryMatches,
    approvalPolicy: detail.approval
      ? {
          id: detail.approval.policyId ?? 'policy',
          appliesTo: [],
          reason: detail.approval.reason ?? 'This run needs a person to approve it.',
          risk: 'high',
        }
      : undefined,
    decision: detail.decision ?? decisionFrom(activities, detail.run),
  }
}

/**
 * `GET /tickets/:id` does not carry the stage map — only the list does — so
 * the detail page reconstructs it from the timeline, which is the same
 * information by another route.
 */
function stageFromActivities(activities: ActivityDto[]): StageMap {
  const stage: StageMap = { context: null, investigate: null, verify: null, approve: null }

  for (const row of activities) {
    if (row.type !== 'a2a.response' || row.status === 'failed') continue
    if (!stage.context) stage.context = row.from
    else if (!stage.investigate) stage.investigate = row.from
    else if (!stage.verify) stage.verify = row.from
  }

  const closed = activities.find(
    (row) => row.type === 'run.completed' && row.outcome === 'RESOLVED',
  )
  if (closed) stage.approve = 'human-approver'

  return stage
}

/**
 * The human's decision, read back off the audit trail.
 *
 * Only reached when the backend does not send one: the contract has no
 * decision object, so this finds the thought that recorded the verdict — the
 * only place the person's name appears — and pairs it with the run.completed
 * row that followed. It is an inference, which is why a sent `decision`
 * always wins over it.
 */
function decisionFrom(activities: ActivityDto[], run: RunDto | null): TicketDetail['decision'] {
  const verdict = [...activities]
    .reverse()
    .find(
      (row): row is Extract<ActivityDto, { type: 'brain.thought' }> =>
        row.type === 'brain.thought' && /\b(approved|rejected|sent this back)\b/i.test(row.text),
    )
  if (!verdict) return undefined

  const [headline, ...rest] = verdict.text.split('\n\n')
  const approved = run?.state === 'RESOLVED' || /approved/i.test(headline ?? '')

  return {
    outcome: approved ? 'APPROVED' : 'REJECTED',
    by: (headline ?? '').replace(/\s+(approved|rejected|sent).*$/i, '').trim() || 'A person',
    note: rest.join('\n\n') || undefined,
    at: verdict.at,
  }
}

/**
 * A workspace assembled from what the contract does expose. A backend with no
 * workspace extension still gets a named control tower, its registry and its
 * connectors — the switcher simply has one entry.
 */
function buildImplicitWorkspace(agents: AgentDto[], connectors: ConnectorDto[]): Workspace {
  return {
    id: 'default',
    name: 'Control tower',
    product: 'Connected systems',
    ticketPrefix: 'TKT',
    tagline: 'Single tenant — this backend serves one control tower',
    accent: 'violet',
    supportEmailDomain: 'example.com',
    // Every field but `id` is treated as optional here on purpose. This is the
    // path taken when the backend has no `/workspaces` extension, so it is
    // exactly the path a leaner deployment takes — and a registry row that
    // omits `tools` or `name` would otherwise throw inside the provider that
    // wraps the whole application, turning a thin agent list into a blank app.
    agents: agents.map((agent) => ({
      id: agent.id,
      name: agent.name ?? agent.id,
      shortLabel: shortLabel(agent),
      role: roleOf(agent),
      summary: agent.description ?? '',
      description: agent.description ?? '',
      protocol: agent.protocol ?? 'A2A',
      protocolNote: '',
      capabilities: agent.capabilities ?? [],
      tools: (agent.tools ?? []).map((tool) => ({
        name: tool.name,
        via: tool.via,
        description: '',
      })),
      status:
        agent.status === 'ONLINE' ? 'connected' : agent.status === 'OFFLINE' ? 'offline' : 'degraded',
      ownership: (agent as { ownership?: string }).ownership === 'customer' ? 'customer' : 'procol',
    })),
    connectors: connectors.map((connector) => ({
      id: connector.id,
      name: (connector as { name?: string }).name ?? connector.id,
      kind: connector.kind,
      dataMode:
        ((connector as { dataMode?: string }).dataMode as 'query-in-place') ?? 'query-in-place',
      capabilities: connector.capabilities,
      status: connector.health.ok ? 'connected' : 'offline',
      latencyMs: connector.health.latencyMs,
    })),
    approvalPolicies: [],
  }
}

/** The contract's four kinds map onto the roles the UI paints. */
function roleOf(agent: AgentDto): Workspace['agents'][number]['role'] {
  const declared = (agent as { role?: string }).role
  if (declared) return declared as Workspace['agents'][number]['role']

  const capabilities = agent.capabilities ?? []
  if (agent.id === 'brain' || capabilities.includes('route_capability')) return 'orchestrator'
  if (capabilities.includes('approve_fix')) return 'approval'

  switch (agent.kind) {
    case 'knowledge':
      return 'knowledge'
    case 'engineering':
      return 'engineering'
    case 'validation':
      return 'validation'
    default:
      return 'analytics'
  }
}

function shortLabel(agent: AgentDto): string {
  const name = agent.name ?? agent.id
  const words = name.split(/[\s-]+/).filter(Boolean)
  if (words.length <= 1) return name.slice(0, 2).toUpperCase()
  return words
    .slice(0, 3)
    .map((word) => word[0]!.toUpperCase())
    .join('')
}

