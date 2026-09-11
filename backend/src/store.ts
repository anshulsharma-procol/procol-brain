import { readFileSync, writeFileSync } from 'node:fs'
import { bus } from './events.js'
import { cuid } from './ids.js'
import { env } from './env.js'
import {
  ACME_CONNECTIONS,
  CONNECTION_KIND,
  CONNECTION_TYPE_LABEL,
  DISCOVERABLE,
  PROCOL_CONNECTIONS,
} from './domain/connections.js'
import type { ConnectionCategory, ConnectionDef } from './domain/connections.js'
import { SEED_KNOWLEDGE } from './domain/knowledge.js'
import { SEED_MEMORY } from './domain/memory.js'
import type {
  ActivityEvent,
  Artifact,
  Decision,
  KnowledgeEntry,
  MemoryEntry,
  MemoryMatch,
  Run,
  Stage,
  TaskRecord,
  Ticket,
  TicketDetail,
  WorkspaceStats,
} from './domain/types.js'
import type { RunState } from './contract.js'
import { getWorkspace, WORKSPACES } from './domain/workspaces.js'

/**
 * ============================================================================
 *  THE STORE
 * ============================================================================
 *
 * One in-memory source of truth for every surface. The customer's chat widget
 * and the internal console read and write the same tickets, the same timeline
 * and the same artifacts — so a ticket raised from a client dashboard appears
 * on our board, and an approval on our board is visible in their chat, with no
 * synchronisation code anywhere.
 *
 * It is in memory because a demo does not need Postgres, and it writes a JSON
 * snapshot so a restart mid-rehearsal does not lose the board. Swapping this
 * for Prisma is a change to this file: nothing above it holds state.
 */

interface RunControl {
  playbookId: string
  /** Set while the orchestrator is walking this ticket. */
  active: boolean
  approvalPolicyId?: string
}

interface StoredSignal {
  id: string
  source: string
  kind: string
  summary: string
  metrics: Record<string, unknown>
  ticketId: string | null
  createdAt: string
}

interface Snapshot {
  version: 2
  tickets: Ticket[]
  runs2: Run[]
  activity: [string, ActivityEvent[]][]
  artifacts: [string, Artifact[]][]
  decisions: [string, Decision][]
  runs: [string, RunControl][]
  tasks: [string, TaskRecord][]
  signals: [string, StoredSignal][]
  memory: MemoryEntry[]
  counters: [string, number][]
}

class Store {
  private tickets = new Map<string, Ticket>()
  /** contract.Run records, by run id. */
  private runRecords = new Map<string, Run>()
  private activity = new Map<string, ActivityEvent[]>()
  private artifacts = new Map<string, Artifact[]>()
  private decisions = new Map<string, Decision>()
  private runs = new Map<string, RunControl>()
  private tasks = new Map<string, TaskRecord>()
  private signals = new Map<string, StoredSignal>()
  /** Connections per workspace, in the order they should be listed. */
  private connections = new Map<string, ConnectionDef[]>()
  private memory: MemoryEntry[] = []
  private knowledge: KnowledgeEntry[] = []
  /** Next ticket number per workspace. */
  private counters = new Map<string, number>()
  private persistTimer?: NodeJS.Timeout

  // -- lifecycle -----------------------------------------------------------

  reset(): void {
    this.tickets.clear()
    this.runRecords.clear()
    this.activity.clear()
    this.artifacts.clear()
    this.decisions.clear()
    this.runs.clear()
    this.tasks.clear()
    this.signals.clear()
    this.connections = new Map([
      ['procol', PROCOL_CONNECTIONS.map((row) => ({ ...row }))],
      ['acmecloud', ACME_CONNECTIONS.map((row) => ({ ...row }))],
    ])
    this.memory = SEED_MEMORY.map((entry) => ({ ...entry }))
    this.knowledge = SEED_KNOWLEDGE.map((entry) => ({ ...entry }))
    this.counters.clear()
    for (const workspace of WORKSPACES) {
      this.counters.set(workspace.id, workspace.id === 'procol' ? 1231 : 7790)
    }
  }

  /** True when a snapshot was restored, so the caller can skip seeding. */
  restore(): boolean {
    if (!env.stateFile) return false

    try {
      const snapshot = JSON.parse(readFileSync(env.stateFile, 'utf8')) as Snapshot
      if (snapshot.version !== 2) return false

      this.reset()
      for (const ticket of snapshot.tickets) this.tickets.set(ticket.id, ticket)
      for (const run of snapshot.runs2 ?? []) this.runRecords.set(run.id, run)
      this.activity = new Map(snapshot.activity)
      this.artifacts = new Map(snapshot.artifacts)
      this.decisions = new Map(snapshot.decisions)
      // A run that was mid-flight when the process died is not running now.
      this.runs = new Map(snapshot.runs.map(([ref, run]) => [ref, { ...run, active: false }]))
      this.tasks = new Map(snapshot.tasks ?? [])
      this.signals = new Map(snapshot.signals ?? [])
      this.memory = snapshot.memory
      this.counters = new Map(snapshot.counters)
      return this.tickets.size > 0
    } catch {
      // No snapshot, or an unreadable one. Seeding is the correct fallback.
      return false
    }
  }

  /** Debounced, because a run writes a dozen events in a few seconds. */
  private persist(): void {
    if (!env.stateFile) return
    clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => {
      const snapshot: Snapshot = {
        version: 2,
        tickets: [...this.tickets.values()],
        runs2: [...this.runRecords.values()],
        activity: [...this.activity.entries()],
        artifacts: [...this.artifacts.entries()],
        decisions: [...this.decisions.entries()],
        runs: [...this.runs.entries()],
        // A2A task records are what the payload disclosure and the registry's
        // recent-tasks list read; dropping them on restart made both go quiet
        // for every ticket that predated the process.
        tasks: [...this.tasks.entries()],
        signals: [...this.signals.entries()],
        memory: this.memory,
        counters: [...this.counters.entries()],
      }
      try {
        writeFileSync(env.stateFile!, JSON.stringify(snapshot))
      } catch (error) {
        console.warn('[store] could not write snapshot:', (error as Error).message)
      }
    }, 400)
    this.persistTimer.unref?.()
  }

  // -- tickets -------------------------------------------------------------

  /**
   * The next free reference for a workspace.
   *
   * It skips anything already taken rather than trusting the counter. The
   * counter alone is not enough: the seed plants tickets at fixed ids
   * (PRO-1245 and friends) that the counter would otherwise walk straight
   * into — and because activity and artifacts are keyed by reference and
   * appended, a reused reference does not just overwrite a ticket, it merges
   * two runs onto one timeline. That is unrecoverable in front of an
   * audience, and invisible until someone reads the transcript.
   */
  nextReference(workspaceId: string): string {
    const workspace = getWorkspace(workspaceId)
    let next = (this.counters.get(workspace.id) ?? 1000) + 1

    while (this.tickets.has(`${workspace.ticketPrefix}-${next}`)) next++

    this.counters.set(workspace.id, next)
    return `${workspace.ticketPrefix}-${next}`
  }

  /** True when a reference is already in use. */
  hasTicket(reference: string): boolean {
    return this.tickets.has(reference)
  }

  putTicket(ticket: Ticket, options: { silent?: boolean } = {}): Ticket {
    this.tickets.set(ticket.id, ticket)
    this.persist()
    if (!options.silent) {
      bus.emit({ type: 'board.updated', workspaceId: ticket.workspaceId })
    }
    return ticket
  }

  // -- runs ----------------------------------------------------------------

  /** Opens a run and attaches it to its ticket. */
  startRunRecord(ticketId: string, attempt = 1): Run {
    const run: Run = {
      id: cuid('run'),
      ticketId,
      state: 'RECEIVED',
      path: null,
      attempt,
      summary: null,
      policyReason: null,
      startedAt: new Date().toISOString(),
      endedAt: null,
    }

    this.runRecords.set(run.id, run)
    this.patchTicket(ticketId, { runId: run.id }, { silent: true })
    return run
  }

  patchRun(runId: string, patch: Partial<Run>): Run | undefined {
    const run = this.runRecords.get(runId)
    if (!run) return undefined

    const next = { ...run, ...patch }
    this.runRecords.set(runId, next)
    this.persist()
    return next
  }

  getRunRecord(runId: string | undefined): Run | undefined {
    return runId ? this.runRecords.get(runId) : undefined
  }

  /** The run currently attached to a ticket, if any. */
  runForTicket(ticketId: string): Run | undefined {
    return this.getRunRecord(this.tickets.get(ticketId)?.runId)
  }

  setRunState(runId: string, state: RunState): Run | undefined {
    const ended: Partial<Run> =
      state === 'RESOLVED' || state === 'NEEDS_HUMAN' ? { endedAt: new Date().toISOString() } : {}
    return this.patchRun(runId, { state, ...ended })
  }

  patchTicket(reference: string, patch: Partial<Ticket>, options: { silent?: boolean } = {}): Ticket | undefined {
    const ticket = this.tickets.get(reference)
    if (!ticket) return undefined

    const next: Ticket = { ...ticket, ...patch, updatedAt: new Date().toISOString() }
    return this.putTicket(next, options)
  }

  getTicket(reference: string): Ticket | undefined {
    return this.tickets.get(reference)
  }

  listTickets(workspaceId?: string): Ticket[] {
    const all = [...this.tickets.values()]
    const scoped = workspaceId ? all.filter((ticket) => ticket.workspaceId === workspaceId) : all
    return scoped.sort(byBoardPriority)
  }

  // -- activity ------------------------------------------------------------

  /**
   * Appends one row to the audit trail. `seq` is allocated here, in the same
   * step as the insert, and travels in the event as well as the row — so the
   * client can order and dedupe from a single field, and a refresh mid-run
   * rebuilds an identical timeline.
   */
  appendActivity(
    reference: string,
    event: Omit<ActivityEvent, 'id' | 'seq' | 'ticketId' | 'createdAt' | 'runId'> &
      Partial<Pick<ActivityEvent, 'runId' | 'createdAt'>>,
    /**
     * Fields the contract's SSE payload carries that the stored row does not
     * — the task type on a request, the artifact on a creation, the outcome
     * on a completion. Passed through opaquely so the stream layer does not
     * have to guess them back out of a title.
     */
    wire?: Record<string, unknown>,
  ): ActivityEvent | undefined {
    const ticket = this.tickets.get(reference)
    if (!ticket) return undefined

    const rows = this.activity.get(reference) ?? []
    const row: ActivityEvent = {
      runId: ticket.runId ?? null,
      ...event,
      id: cuid('act'),
      ticketId: reference,
      seq: rows.length + 1,
      createdAt: event.createdAt ?? new Date().toISOString(),
    }

    rows.push(row)
    this.activity.set(reference, rows)
    this.persist()
    // The wire event is built by the caller that knows the payload; the store
    // only announces that one exists.
    bus.emit({
      type: 'activity',
      ticketRef: reference,
      workspaceId: ticket.workspaceId,
      activity: row,
      wire: wire ?? {},
    })
    return row
  }

  getActivity(reference: string): ActivityEvent[] {
    return this.activity.get(reference) ?? []
  }

  // -- artifacts -----------------------------------------------------------

  addArtifact(
    reference: string,
    artifact: Omit<Artifact, 'id' | 'ticketId' | 'createdAt'>,
  ): Artifact | undefined {
    const ticket = this.tickets.get(reference)
    if (!ticket) return undefined

    const rows = this.artifacts.get(reference) ?? []
    const row: Artifact = {
      ...artifact,
      // Stable per ticket and kind, so re-running a stage replaces its
      // artifact instead of leaving two contradictory ones on the record.
      id: `${reference}-${artifact.kind.toLowerCase()}`,
      ticketId: reference,
      createdAt: new Date().toISOString(),
    }

    // Re-running a stage replaces its artifact rather than duplicating it.
    const existing = rows.findIndex((candidate) => candidate.id === row.id)
    if (existing >= 0) rows[existing] = row
    else rows.push(row)

    this.artifacts.set(reference, rows)
    this.persist()
    return row
  }

  getArtifacts(reference: string): Artifact[] {
    return this.artifacts.get(reference) ?? []
  }

  // -- runs and decisions --------------------------------------------------

  setRun(reference: string, run: RunControl): void {
    this.runs.set(reference, run)
    this.persist()
  }

  getRun(reference: string): RunControl | undefined {
    return this.runs.get(reference)
  }

  setDecision(reference: string, decision: Decision): void {
    this.decisions.set(reference, decision)
    this.persist()
  }

  getDecision(reference: string): Decision | undefined {
    return this.decisions.get(reference)
  }

  // -- A2A task records ----------------------------------------------------

  putTask(record: TaskRecord): void {
    this.tasks.set(record.task.taskId, record)
  }

  getTask(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId)
  }

  listTasks(reference: string): TaskRecord[] {
    return [...this.tasks.values()].filter((record) => record.ticketId === reference)
  }

  // -- signals -------------------------------------------------------------

  addSignal(input: { source: string; kind: string; summary: string; metrics: Record<string, unknown> }) {
    const signal = {
      id: cuid('sig'),
      ...input,
      ticketId: null as string | null,
      createdAt: new Date().toISOString(),
    }
    this.signals.set(signal.id, signal)
    this.persist()
    return signal
  }

  attachSignal(signalId: string, ticketId: string): void {
    const signal = this.signals.get(signalId)
    if (signal) this.signals.set(signalId, { ...signal, ticketId })
  }

  listSignals() {
    return [...this.signals.values()]
  }

  // -- task counts, for the registry ---------------------------------------

  /** Hops this agent answered today. The registry column the contract names. */
  tasksTodayFor(agentId: string): number {
    const since = new Date().toISOString().slice(0, 10)
    return [...this.tasks.values()].filter(
      (record) => record.task.to === agentId && record.startedAt >= since,
    ).length
  }

  recentTasksFor(agentId: string, limit = 10) {
    return [...this.tasks.values()]
      .filter((record) => record.task.to === agentId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, limit)
  }

  /** contract.Stats — deliberately five numbers and nothing else. */
  contractStats(workspaceId?: string) {
    const tickets = this.listTickets(workspaceId)
    const today = new Date().toISOString().slice(0, 10)
    const countBy = (status: Ticket['status']) => tickets.filter((t) => t.status === status).length

    return {
      active: tickets.filter((ticket) => ticket.status !== 'RESOLVED').length,
      aiWorking: countBy('RUNNING'),
      needsApproval: countBy('AWAITING_APPROVAL'),
      resolvedToday: tickets.filter(
        (ticket) => ticket.status === 'RESOLVED' && ticket.updatedAt.slice(0, 10) === today,
      ).length,
      avgResolutionMins: 34,
    }
  }

  // -- memory --------------------------------------------------------------

  listMemory(workspaceId: string): MemoryEntry[] {
    return this.memory
      .filter((entry) => entry.workspaceId === workspaceId)
      .sort((a, b) => b.learnedAt.localeCompare(a.learnedAt))
  }

  remember(entry: MemoryEntry): void {
    const existing = this.memory.findIndex((candidate) => candidate.id === entry.id)
    if (existing >= 0) {
      // Learning the same lesson again is a reuse, not a duplicate.
      const previous = this.memory[existing]!
      this.memory[existing] = { ...entry, reuseCount: previous.reuseCount + 1 }
    } else {
      this.memory = [entry, ...this.memory]
    }
    this.persist()
  }

  searchMemory(workspaceId: string, query: string, excludeId?: string): MemoryMatch[] {
    return matchMemory(this.memory, workspaceId, query, excludeId)
  }

  // -- connections ---------------------------------------------------------

  listConnections(workspaceId: string): ConnectionDef[] {
    return this.connections.get(workspaceId) ?? []
  }

  getConnection(workspaceId: string, id: string): ConnectionDef | undefined {
    return this.listConnections(workspaceId).find((row) => row.id === id)
  }

  /**
   * Adds a connection and discovers what it can do.
   *
   * Discovery is the whole reason this is one step rather than a
   * configuration form: nobody should have to tell Brain what a tool is
   * capable of. An MCP server lists its tools, an agent card lists its
   * skills, a database describes its schema — and the capabilities that come
   * back are what the agents route against.
   */
  addConnection(
    workspaceId: string,
    input: {
      name: string
      category: ConnectionCategory
      description?: string
      endpoint?: string
      logo?: string
    },
  ): ConnectionDef {
    const rows = this.listConnections(workspaceId)
    const id = slug(input.name, new Set(rows.map((row) => row.id)))

    const created: ConnectionDef = {
      id,
      name: input.name,
      category: input.category,
      kind: CONNECTION_KIND[input.category],
      typeLabel: CONNECTION_TYPE_LABEL[input.category],
      description: input.description?.trim() || `Connected ${CONNECTION_TYPE_LABEL[input.category].toLowerCase()}.`,
      status: 'connected',
      capabilities: DISCOVERABLE[input.category],
      usedBy: [],
      logo: input.logo ?? id,
      endpoint: input.endpoint,
      dataMode: input.category === 'knowledge' ? 'metadata-only' : 'query-in-place',
      health: { ok: true, latencyMs: 120 },
      addedAt: new Date().toISOString().slice(0, 10),
    }

    this.connections.set(workspaceId, [created, ...rows])
    this.persist()
    bus.emit({ type: 'board.updated', workspaceId })
    return created
  }

  /** Reconnecting is what an `action_required` card asks for. */
  reconnect(workspaceId: string, id: string): ConnectionDef | undefined {
    const rows = this.listConnections(workspaceId)
    const index = rows.findIndex((row) => row.id === id)
    if (index < 0) return undefined

    const next: ConnectionDef = {
      ...rows[index]!,
      status: 'connected',
      health: { ok: true, latencyMs: rows[index]!.health.latencyMs || 140 },
    }
    delete next.statusDetail

    rows[index] = next
    this.connections.set(workspaceId, [...rows])
    this.persist()
    bus.emit({ type: 'board.updated', workspaceId })
    return next
  }

  removeConnection(workspaceId: string, id: string): boolean {
    const rows = this.listConnections(workspaceId)
    const next = rows.filter((row) => row.id !== id)
    if (next.length === rows.length) return false

    this.connections.set(workspaceId, next)
    this.persist()
    bus.emit({ type: 'board.updated', workspaceId })
    return true
  }

  // -- knowledge -----------------------------------------------------------

  listKnowledge(workspaceId: string): KnowledgeEntry[] {
    return this.knowledge.filter((entry) => entry.workspaceId === workspaceId)
  }

  // -- projections ---------------------------------------------------------

  getDetail(reference: string): TicketDetail | undefined {
    const ticket = this.tickets.get(reference)
    if (!ticket) return undefined

    const run = this.runs.get(reference)
    const workspace = getWorkspace(ticket.workspaceId)

    return {
      ticket,
      stages: ticket.stages ?? [],
      activity: this.getActivity(reference),
      artifacts: this.getArtifacts(reference),
      // A run never matches against the memory it wrote itself.
      memoryMatches: this.searchMemory(
        ticket.workspaceId,
        `${ticket.title} ${ticket.description} ${ticket.issueQuote.join(' ')}`,
        run ? `mem-${run.playbookId}-${reference}` : undefined,
      ),
      approvalPolicy: workspace.approvalPolicies.find((policy) => policy.id === run?.approvalPolicyId),
      decision: this.decisions.get(reference),
    }
  }

  stats(workspaceId: string): WorkspaceStats {
    const tickets = this.listTickets(workspaceId)
    const workspace = getWorkspace(workspaceId)
    const countBy = (status: Ticket['status']) => tickets.filter((t) => t.status === status).length

    const memory = this.listMemory(workspaceId)
    const minutesSaved = memory.reduce(
      (total, entry) => total + entry.reuseCount * entry.minutesSavedPerReuse,
      0,
    )

    const responsesByAgent = new Map<string, number>()
    for (const ticket of tickets) {
      for (const row of this.getActivity(ticket.id)) {
        if (row.type !== 'a2a.response' || !row.fromAgent) continue
        responsesByAgent.set(row.fromAgent, (responsesByAgent.get(row.fromAgent) ?? 0) + 1)
      }
    }

    return {
      activeTickets: tickets.filter((ticket) => ticket.status !== 'RESOLVED').length,
      aiWorking: countBy('RUNNING'),
      awaitingApproval: countBy('AWAITING_APPROVAL'),
      resolvedThisWeek: countBy('RESOLVED'),
      hoursSavedThisMonth: Math.round(minutesSaved / 60),
      avgResolutionMinutes: 34,
      ticketsByStatus: [
        { name: 'New', value: countBy('NEW'), color: '#3b82f6' },
        { name: 'Investigating', value: countBy('RUNNING'), color: '#7c3aed' },
        { name: 'Awaiting approval', value: countBy('AWAITING_APPROVAL'), color: '#f59e0b' },
        { name: 'Resolved', value: countBy('RESOLVED'), color: '#16a34a' },
      ],
      agentActivity: workspace.agents
        .filter((agent) => agent.role !== 'orchestrator' && agent.role !== 'approval')
        .map((agent) => ({
          agentId: agent.id,
          name: agent.name,
          value: responsesByAgent.get(agent.id) ?? 0,
        }))
        .filter((row) => row.value > 0),
    }
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const STATUS_WEIGHT: Record<Ticket['status'], number> = {
  AWAITING_APPROVAL: 0,
  RUNNING: 1,
  NEEDS_HUMAN: 2,
  NEW: 3,
  REJECTED: 4,
  RESOLVED: 5,
}

/** Anything waiting on a person sorts to the top. */
function byBoardPriority(a: Ticket, b: Ticket): number {
  const weight = STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status]
  return weight !== 0 ? weight : b.updatedAt.localeCompare(a.updatedAt)
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'for', 'and', 'is', 'are', 'was', 'were', 'on', 'in', 'to', 'of', 'not',
  'after', 'with', 'our', 'all', 'this', 'that', 'it', 'we', 'they', 'from', 'but', 'cannot',
  'can', 'be', 'been', 'their', 'there', 'when', 'incorrect', 'issue', 'error', 'errors',
  'getting', 'trying', 'since', 'yesterday', 'please', 'help', 'showing', 'shows', 'show',
  'instead', 'wrong', 'every', 'some', 'any', 'only', 'also', 'now', 'still', 'again',
  'started', 'start', 'happening', 'happens', 'seeing', 'see', 'says', 'said', 'tried',
  'about', 'have', 'has', 'had', 'will', 'would', 'should', 'could', 'does', 'did', 'doing',
  'you', 'your', 'yours', 'out', 'more', 'than', 'into', 'over', 'under', 'what', 'why',
  'how', 'who', 'which', 'while', 'because', 'just', 'even', 'very', 'really', 'need',
])

/**
 * Crude singularisation, so "invoices" in a customer's sentence reaches the
 * "invoice" tag on a memory entry. A customer never types the word the tag
 * was written with, and a lookup that needs them to is a lookup that silently
 * never fires.
 */
function stem(word: string): string {
  if (word.length <= 3) return word
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`
  if (word.endsWith('sses') || word.endsWith('shes') || word.endsWith('ches')) return word.slice(0, -2)
  if (word.endsWith('ss')) return word
  if (word.endsWith('s')) return word.slice(0, -1)
  return word
}

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .map(stem)
}

/** A tag was chosen deliberately by whoever wrote the entry; prose was not. */
const TAG_WEIGHT = 2
const TEXT_WEIGHT = 1

/**
 * Phrases that mark a message as a report of something broken.
 *
 * This matters more than it looks. Institutional memory answers "has this
 * broken before?" — it does not answer "how does this work?". Both kinds of
 * message mention the same nouns, so topic overlap alone cannot tell them
 * apart: "our invoices are billing the wrong GST" and "please update the
 * billing address on our invoice" share *invoice* and *billing* and are not
 * remotely the same request.
 *
 * Offering a past incident to someone asking a question is worse than
 * offering nothing: they read a resolution that does not apply and go and act
 * on it. So a message with no symptom language in it has to clear a much
 * higher bar before memory speaks up at all.
 */
const SYMPTOM_MARKERS = [
  'wrong', 'incorrect', 'not work', 'fail', 'stopped', 'stop ', 'stuck', 'cannot', "can't",
  'unable', 'missing', 'crash', 'timeout', 'times out', 'timing out', 'rejected', 'denied',
  'instead of', 'error', 'broken', 'blank', 'empty', 'no longer', 'nothing shows', 'nothing is',
  'not showing', 'not visible', 'not receiving', 'unauthorized', 'unauthorised', 'hangs',
  'slow', 'down', '401', '403', '500', '502', 'duplicate', 'mismatch', 'stale',
]

function looksLikeSymptom(message: string): boolean {
  const text = message.toLowerCase()
  return SYMPTOM_MARKERS.some((marker) => text.includes(marker))
}

/**
 * How sure the lookup has to be before it says "we have seen this before".
 *
 * Both gates matter. The ratio keeps a long rambling message from matching on
 * one incidental word, and the absolute floor keeps a short message from
 * matching on one. A single weak overlap — someone mentioning the approvals
 * page in a ticket about a mobile crash — must not surface a confident card
 * about the approval matrix: a wrong "we have seen this before" sends a human
 * down the wrong path, which is worse than saying nothing.
 */
const MIN_CONFIDENCE = 0.3
const MIN_SCORE = 3

/** The bar for a message that never said anything was broken. */
const MIN_CONFIDENCE_QUESTION = 0.55
const MIN_SCORE_QUESTION = 5

/**
 * Institutional memory lookup. Weighted overlap against the tags and symptom
 * of each entry today; an embedding index when there is one. Either way it
 * answers with a 0..1 confidence, so the surfaces that render it do not change
 * when that happens.
 *
 * Known limit, kept rather than papered over: a question about the same
 * subject area as a past incident can still surface it — "who approves POs
 * over 5 lakh?" will offer the delegation incident at a middling confidence.
 * The thresholds here were tuned against a small set of hand-written
 * sentences, and tightening them further would be fitting to that set rather
 * than to real traffic. The card that renders a match shows its confidence
 * and the words it matched on, and offers one click to investigate anyway, so
 * a weak hit costs the customer a moment rather than misleading them.
 */
export function matchMemory(
  memory: MemoryEntry[],
  workspaceId: string,
  query: string,
  excludeId?: string,
): MemoryMatch[] {
  const words = [...new Set(tokenise(query))]
  if (words.length === 0) return []

  const symptom = looksLikeSymptom(query)
  const minScore = symptom ? MIN_SCORE : MIN_SCORE_QUESTION
  const minConfidence = symptom ? MIN_CONFIDENCE : MIN_CONFIDENCE_QUESTION

  // Longer messages get a larger denominator, but only up to a point: past a
  // handful of content words, extra words are detail rather than signal.
  const denominator = Math.min(words.length, 6) + 1

  return memory
    .filter((entry) => entry.workspaceId === workspaceId && entry.id !== excludeId)
    .map((entry) => {
      // Tags are tokenised, not just stemmed: a tag written `purchase-order`
      // has to be reachable from a customer who typed "purchase orders",
      // and the query tokeniser has already split on the hyphen.
      const tags = new Set(entry.tags.flatMap(tokenise))
      const prose = new Set(tokenise(`${entry.title} ${entry.symptom}`))

      let score = 0
      const hits: string[] = []

      for (const word of words) {
        if (tags.has(word)) {
          score += TAG_WEIGHT
          hits.push(word)
        } else if (prose.has(word)) {
          score += TEXT_WEIGHT
          hits.push(word)
        }
      }

      return {
        entry,
        score,
        confidence: Math.min(0.95, score / denominator),
        reason: hits.length ? `Matched on ${hits.slice(0, 3).join(', ')}` : 'No overlapping symptoms',
      }
    })
    .filter((match) => match.score >= minScore && match.confidence >= minConfidence)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map(({ entry, confidence, reason }) => ({ entry, confidence, reason }))
}

/** Stage rails are built here so every caller shows the same shape. */
export function buildStages(needed: Stage['id'][]): Stage[] {
  const all: { id: Stage['id']; label: string }[] = [
    { id: 'context', label: 'Context' },
    { id: 'investigate', label: 'Investigate' },
    { id: 'verify', label: 'Verify' },
    { id: 'approve', label: 'Approve' },
  ]

  return all.map((stage) => ({
    ...stage,
    status: needed.includes(stage.id) ? 'pending' : 'skipped',
    ...(needed.includes(stage.id) ? {} : { detail: 'Not needed on this path' }),
  }))
}

export const store = new Store()

/** `Google Drive` -> `google-drive`, made unique against what exists. */
function slug(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'connection'

  if (!taken.has(base)) return base

  let suffix = 2
  while (taken.has(`${base}-${suffix}`)) suffix++
  return `${base}-${suffix}`
}
