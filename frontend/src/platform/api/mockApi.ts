import { SCENARIOS } from '../scenarios'
import { compileScenario, memoryFromScenario } from '../scenarios/compile'
import type { Scenario } from '../scenarios/types'
import { BACKGROUND_TICKETS, SEED_KNOWLEDGE, SEED_MEMORY } from '../seed'
import type {
  Artifact,
  CustomerReplyArtifact,
  KnowledgeEntry,
  MemoryEntry,
  MemoryMatch,
  Ticket,
  TicketDetail,
  Workspace,
  WorkspaceStats,
} from '../types'
import { getWorkspace, WORKSPACES } from '../workspaces'
import type {
  ConsoleApi,
  CreateTicketInput,
  DecisionInput,
  StreamListener,
  StreamMessage,
  StreamTarget,
  TicketFilter,
  Unsubscribe,
} from './types'

/**
 * ============================================================================
 *  THE DUMMY BACKEND
 * ============================================================================
 *
 * An in-memory implementation of `ConsoleApi`, built entirely from the
 * scenario and seed files. It is the only place in the app that knows the
 * backend does not exist yet.
 *
 * It is deliberately more than a pile of constants:
 *
 *  - runs *replay* over a timer, so the timeline streams in like a real one
 *  - state is held in a store and pushed to subscribers, exactly as SSE will
 *  - approving a ticket really does write a memory entry, send the reply
 *    artifact and move the stats
 *
 * That matters because it means the screens are exercised against moving
 * state today, and swapping in the HTTP adapter tomorrow changes the source of
 * the events, not the behaviour of the app.
 */

interface RunState {
  scenario: Scenario
  /** How many scripted events have been emitted so far. */
  visibleCount: number
  /** Set while a replay timer is running. */
  timer?: ReturnType<typeof setTimeout>
  decision?: TicketDetail['decision']
  /** Overrides the scenario status once a human has decided. */
  status?: Ticket['status']
}

const LATENCY_MS = 120

export class MockConsoleApi implements ConsoleApi {
  private runs = new Map<string, RunState>()
  private memory: MemoryEntry[] = [...SEED_MEMORY]
  private knowledge: KnowledgeEntry[] = [...SEED_KNOWLEDGE]
  private adHocTickets: Ticket[] = []
  private listeners = new Set<{ target: StreamTarget; listener: StreamListener }>()
  private readonly startedAt = new Date()

  constructor(options: { autoStart?: boolean } = {}) {
    for (const scenario of SCENARIOS) {
      // Scripted runs start fully played out, so the board looks like a system
      // that has been working all morning rather than one waiting to be poked.
      // `startInvestigation` rewinds a ticket and replays it live on demand.
      this.runs.set(scenario.ticket.reference, {
        scenario,
        visibleCount: options.autoStart === false ? 0 : scenario.events.length,
      })
    }
  }

  // -- workspaces ----------------------------------------------------------

  async listWorkspaces(): Promise<Workspace[]> {
    await settle()
    return WORKSPACES
  }

  async getWorkspace(workspaceId: string): Promise<Workspace> {
    await settle()
    return getWorkspace(workspaceId)
  }

  // -- tickets -------------------------------------------------------------

  async listTickets(workspaceId: string, filter?: TicketFilter): Promise<Ticket[]> {
    await settle()
    const tickets = this.allTickets(workspaceId)
    if (!filter?.status?.length) return tickets
    return tickets.filter((ticket) => filter.status!.includes(ticket.status))
  }

  async getTicket(ticketRef: string): Promise<TicketDetail> {
    await settle()
    const detail = this.buildDetail(ticketRef)
    if (!detail) throw new Error(`Ticket ${ticketRef} not found`)
    return detail
  }

  async createTicket(input: CreateTicketInput): Promise<Ticket> {
    await settle()
    const workspace = getWorkspace(input.workspaceId)
    const reference = `${workspace.ticketPrefix}-${9000 + this.adHocTickets.length + 1}`
    const now = new Date().toISOString()

    const ticket: Ticket = {
      id: reference,
      reference,
      workspaceId: workspace.id,
      title: input.title,
      description: input.description,
      customer: input.customer,
      channel: input.channel ?? 'portal',
      priority: input.priority ?? 'MEDIUM',
      status: 'NEW',
      category: 'Uncategorised',
      impact: 'Not yet assessed',
      issueQuote: [input.description],
      createdAt: now,
      updatedAt: now,
      progress: 0,
    }

    this.adHocTickets.push(ticket)
    this.emit({ type: 'board.updated', workspaceId: workspace.id })
    return ticket
  }

  // -- the run -------------------------------------------------------------

  async startInvestigation(ticketRef: string): Promise<{ runId: string }> {
    await settle()
    const run = this.runs.get(ticketRef)
    if (!run) throw new Error(`No scripted run for ${ticketRef}`)

    // Idempotent: a second click while a replay is in flight rejoins the run
    // in progress instead of starting a parallel one. Someone always
    // double-clicks on stage.
    if (run.timer) return { runId: `run-${ticketRef}` }

    run.visibleCount = 0
    run.decision = undefined
    // Held until the replay finishes, so a run that has emitted nothing yet
    // still reads as working rather than flashing back to NEW.
    run.status = 'INVESTIGATING'
    this.publishTicket(ticketRef)
    this.scheduleNext(ticketRef)

    return { runId: `run-${ticketRef}` }
  }

  private scheduleNext(ticketRef: string) {
    const run = this.runs.get(ticketRef)
    if (!run) return

    const next = run.scenario.events[run.visibleCount]
    if (!next) {
      run.timer = undefined
      run.status = undefined
      this.publishTicket(ticketRef)
      return
    }

    const previous = run.scenario.events[run.visibleCount - 1]
    const scale = run.scenario.replayScale ?? 400
    const gapSeconds = Math.max(0.4, next.atSeconds - (previous?.atSeconds ?? 0))

    run.timer = setTimeout(() => {
      run.visibleCount += 1
      this.publishTicket(ticketRef)
      this.scheduleNext(ticketRef)
    }, gapSeconds * scale)
  }

  async submitDecision(ticketRef: string, decision: DecisionInput): Promise<TicketDetail> {
    await settle()
    const run = this.runs.get(ticketRef)
    if (!run) throw new Error(`Ticket ${ticketRef} not found`)

    // A decision only lands on a run that actually reached the gate.
    run.visibleCount = run.scenario.events.length
    run.decision = {
      outcome: decision.outcome,
      by: decision.by,
      note: decision.note,
      at: new Date().toISOString(),
    }
    run.status = decision.outcome === 'APPROVED' ? 'RESOLVED' : 'NEEDS_HUMAN'

    if (decision.outcome === 'APPROVED') {
      // Approval is what closes the loop: the customer is told, and the
      // control tower keeps what it learned.
      this.rememberFrom(run.scenario)
    }

    this.publishTicket(ticketRef)
    this.emit({ type: 'board.updated', workspaceId: run.scenario.workspaceId })
    return this.getTicket(ticketRef)
  }

  private rememberFrom(scenario: Scenario) {
    const entry = memoryFromScenario(scenario, new Date())
    if (!entry) return

    const existing = this.memory.findIndex((item) => item.id === entry.id)
    if (existing >= 0) {
      this.memory[existing] = { ...entry, reuseCount: this.memory[existing].reuseCount }
    } else {
      this.memory = [entry, ...this.memory]
    }
  }

  // -- streaming -----------------------------------------------------------

  subscribe(target: StreamTarget, listener: StreamListener): Unsubscribe {
    const entry = { target, listener }
    this.listeners.add(entry)
    return () => {
      this.listeners.delete(entry)
    }
  }

  private publishTicket(ticketRef: string) {
    const detail = this.buildDetail(ticketRef)
    if (!detail) return
    this.emit({ type: 'ticket.updated', detail })
  }

  private emit(message: StreamMessage) {
    for (const { target, listener } of this.listeners) {
      const relevant =
        message.type === 'ticket.updated'
          ? target.kind === 'ticket'
            ? target.ticketRef === message.detail.ticket.reference
            : target.workspaceId === message.detail.ticket.workspaceId
          : target.kind === 'workspace' && target.workspaceId === message.workspaceId

      if (relevant) listener(message)
    }
  }

  // -- memory --------------------------------------------------------------

  async listMemory(workspaceId: string): Promise<MemoryEntry[]> {
    await settle()
    return this.memory
      .filter((entry) => entry.workspaceId === workspaceId)
      .sort((a, b) => b.learnedAt.localeCompare(a.learnedAt))
  }

  async searchMemory(workspaceId: string, query: string): Promise<MemoryMatch[]> {
    await settle()
    return matchMemory(this.memory, workspaceId, query)
  }

  // -- knowledge -----------------------------------------------------------

  async listKnowledge(workspaceId: string): Promise<KnowledgeEntry[]> {
    await settle()
    return this.knowledge.filter((entry) => entry.workspaceId === workspaceId)
  }

  // -- stats ---------------------------------------------------------------

  async getStats(workspaceId: string): Promise<WorkspaceStats> {
    await settle()
    const tickets = this.allTickets(workspaceId)
    const workspace = getWorkspace(workspaceId)

    const countBy = (status: Ticket['status']) =>
      tickets.filter((ticket) => ticket.status === status).length

    const memory = this.memory.filter((entry) => entry.workspaceId === workspaceId)
    const minutesSaved = memory.reduce(
      (total, entry) => total + entry.reuseCount * entry.minutesSavedPerReuse,
      0,
    )

    const agentActivity = workspace.agents
      .filter((agent) => agent.role !== 'orchestrator' && agent.role !== 'approval')
      .map((agent) => ({
        agentId: agent.id,
        name: agent.name,
        value: this.taskCountFor(workspaceId, agent.id),
      }))
      .filter((row) => row.value > 0)

    return {
      activeTickets: tickets.filter((ticket) => ticket.status !== 'RESOLVED').length,
      aiWorking: countBy('INVESTIGATING'),
      awaitingApproval: countBy('AWAITING_APPROVAL'),
      resolvedThisWeek: countBy('RESOLVED'),
      hoursSavedThisMonth: Math.round(minutesSaved / 60),
      avgResolutionMinutes: 34,
      ticketsByStatus: [
        { name: 'New', value: countBy('NEW'), color: '#3b82f6' },
        { name: 'Investigating', value: countBy('INVESTIGATING'), color: '#7c3aed' },
        { name: 'Awaiting approval', value: countBy('AWAITING_APPROVAL'), color: '#f59e0b' },
        { name: 'Resolved', value: countBy('RESOLVED'), color: '#16a34a' },
      ],
      agentActivity,
    }
  }

  private taskCountFor(workspaceId: string, agentId: string): number {
    let count = 0
    for (const run of this.runs.values()) {
      if (run.scenario.workspaceId !== workspaceId) continue
      count += run.scenario.events
        .slice(0, run.visibleCount)
        .filter((event) => event.kind === 'response' && event.from === agentId).length
    }
    // Background tickets contribute the work they say they are doing.
    count += BACKGROUND_TICKETS.filter(
      (ticket) => ticket.workspaceId === workspaceId && ticket.currentAgentId === agentId,
    ).length
    return count
  }

  // -- internals -----------------------------------------------------------

  private allTickets(workspaceId: string): Ticket[] {
    const scripted = [...this.runs.values()]
      .filter((run) => run.scenario.workspaceId === workspaceId)
      .map((run) => this.compile(run).ticket)

    const background = BACKGROUND_TICKETS.filter(
      (ticket) => ticket.workspaceId === workspaceId,
    ).map<Ticket>((ticket) => {
      const updatedAt = new Date(this.startedAt.getTime() - ticket.updatedMinutesAgo * 60_000)
      return {
        id: ticket.reference,
        reference: ticket.reference,
        workspaceId: ticket.workspaceId,
        title: ticket.title,
        description: ticket.title,
        customer: ticket.customer,
        channel: ticket.channel,
        priority: ticket.priority,
        status: ticket.status,
        category: ticket.category,
        impact: '—',
        issueQuote: [ticket.title],
        createdAt: updatedAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        currentAgentId: ticket.currentAgentId,
        currentAgentAction: ticket.currentAgentAction,
        progress: ticket.progress,
      }
    })

    const adHoc = this.adHocTickets.filter((ticket) => ticket.workspaceId === workspaceId)

    return [...scripted, ...background, ...adHoc].sort(byBoardPriority)
  }

  private compile(run: RunState) {
    return compileScenario(run.scenario, {
      visibleCount: run.visibleCount,
      now: this.startedAt,
      status: run.status,
    })
  }

  private buildDetail(ticketRef: string): TicketDetail | undefined {
    const run = this.runs.get(ticketRef)

    if (run) {
      const compiled = this.compile(run)
      const workspace = getWorkspace(run.scenario.workspaceId)
      const approved = run.decision?.outcome === 'APPROVED'

      return {
        ticket: compiled.ticket,
        stages: compiled.stages,
        activity: [...compiled.activity, ...this.decisionActivity(run)],
        artifacts: approved
          ? withSentReply(compiled.artifacts, run.scenario)
          : compiled.artifacts,
        memoryMatches: matchMemory(
          this.memory,
          run.scenario.workspaceId,
          `${compiled.ticket.title} ${compiled.ticket.description}`,
          // A run does not match against the memory it wrote itself.
          `mem-${run.scenario.id}`,
        ),
        approvalPolicy: workspace.approvalPolicies.find(
          (policy) => policy.id === run.scenario.approvalPolicyId,
        ),
        decision: run.decision,
      }
    }

    // A board ticket with no scripted run: real shape, empty timeline.
    const ticket = this.allTickets('procol')
      .concat(this.allTickets('acmecloud'))
      .find((candidate) => candidate.reference === ticketRef)
    if (!ticket) return undefined

    return {
      ticket,
      stages: [],
      activity: [],
      artifacts: [],
      memoryMatches: matchMemory(
        this.memory,
        ticket.workspaceId,
        `${ticket.title} ${ticket.description}`,
      ),
    }
  }

  /** The human's decision and its consequences, rendered like any other step. */
  private decisionActivity(run: RunState) {
    if (!run.decision) return []

    const base = run.scenario.events.length + 1
    const approved = run.decision.outcome === 'APPROVED'
    const ticketId = run.scenario.ticket.reference
    const reply = run.scenario.artifacts.find((artifact) => artifact.kind === 'CUSTOMER_REPLY')

    const events: TicketDetail['activity'] = [
      {
        id: `${ticketId}-act-${base}`,
        ticketId,
        seq: base,
        type: 'human.decision',
        fromAgent: 'human',
        title: approved
          ? `${run.decision.by} approved the fix`
          : `${run.decision.by} sent this back for a human`,
        body: run.decision.note ? [run.decision.note] : undefined,
        level: approved ? 'success' : 'warn',
        timestamp: run.decision.at,
      },
    ]

    if (approved && reply) {
      events.push({
        id: `${ticketId}-act-${base + 1}`,
        ticketId,
        seq: base + 1,
        type: 'customer.notified',
        fromAgent: 'brain',
        title: `Customer notified — ${reply.data.subject}`,
        body: ['The reply drafted at the gate has been sent to the customer contact on this ticket.'],
        level: 'success',
        timestamp: run.decision.at,
      })
      events.push({
        id: `${ticketId}-act-${base + 2}`,
        ticketId,
        seq: base + 2,
        type: 'run.completed',
        fromAgent: 'brain',
        title: 'Ticket closed, and what we learned is kept',
        body: [
          run.scenario.memory
            ? `Written to institutional memory as "${run.scenario.memory.title}". The next ticket with this symptom starts from the answer instead of the beginning.`
            : 'Run archived on the audit trail.',
        ],
        level: 'success',
        timestamp: run.decision.at,
      })
    }

    return events
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function withSentReply(artifacts: Artifact[], scenario: Scenario): Artifact[] {
  const reply = scenario.artifacts.find((artifact) => artifact.kind === 'CUSTOMER_REPLY')
  if (!reply) return artifacts

  const sent: CustomerReplyArtifact = {
    id: `${scenario.ticket.reference}-${reply.id}`,
    ticketId: scenario.ticket.reference,
    kind: 'CUSTOMER_REPLY',
    title: reply.title,
    createdBy: reply.createdBy,
    createdAt: new Date().toISOString(),
    data: { ...(reply.data as CustomerReplyArtifact['data']), sent: true },
  }

  return [...artifacts.filter((artifact) => artifact.kind !== 'CUSTOMER_REPLY'), sent]
}

const STATUS_WEIGHT: Record<Ticket['status'], number> = {
  AWAITING_APPROVAL: 0,
  INVESTIGATING: 1,
  NEEDS_HUMAN: 2,
  NEW: 3,
  REJECTED: 4,
  RESOLVED: 5,
}

/** Anything waiting on a person sorts to the top. */
function byBoardPriority(a: Ticket, b: Ticket): number {
  const weight = STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status]
  if (weight !== 0) return weight
  return b.updatedAt.localeCompare(a.updatedAt)
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'for', 'and', 'is', 'are', 'was', 'were', 'on', 'in', 'to', 'of', 'not',
  'after', 'with', 'our', 'all', 'this', 'that', 'it', 'we', 'they', 'from', 'but', 'cannot',
  'can', 'be', 'been', 'their', 'there', 'when', 'incorrect', 'issue', 'error', 'errors',
])

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
}

/**
 * Tag-overlap matching. The real backend will do this with embeddings, which
 * is why the score comes back as a plain 0..1 confidence the UI can render
 * either way.
 */
function matchMemory(
  memory: MemoryEntry[],
  workspaceId: string,
  query: string,
  excludeId?: string,
): MemoryMatch[] {
  const words = new Set(tokenise(query))
  if (words.size === 0) return []

  return memory
    .filter((entry) => entry.workspaceId === workspaceId && entry.id !== excludeId)
    .map((entry) => {
      const haystack = new Set([
        ...entry.tags,
        ...tokenise(`${entry.title} ${entry.symptom}`),
      ])
      const hits = [...words].filter((word) => haystack.has(word))
      const confidence = Math.min(0.97, hits.length / Math.min(words.size, 6))
      return {
        entry,
        confidence,
        reason: hits.length
          ? `Matched on ${hits.slice(0, 3).join(', ')}`
          : 'No overlapping symptoms',
      }
    })
    .filter((match) => match.confidence >= 0.34)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
}

/** Keeps the mock honest: every call is async, like the real one. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
}
