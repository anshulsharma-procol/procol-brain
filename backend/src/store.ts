import { readFileSync, writeFileSync } from 'node:fs'
import { bus } from './events.js'
import { env } from './env.js'
import { SEED_KNOWLEDGE } from './domain/knowledge.js'
import { SEED_MEMORY } from './domain/memory.js'
import type {
  ActivityEvent,
  Artifact,
  Decision,
  KnowledgeEntry,
  MemoryEntry,
  MemoryMatch,
  Stage,
  TaskRecord,
  Ticket,
  TicketDetail,
  WorkspaceStats,
} from './domain/types.js'
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

interface RunState {
  playbookId: string
  /** Set while the orchestrator is walking this ticket. */
  active: boolean
  approvalPolicyId?: string
}

interface Snapshot {
  version: 1
  tickets: Ticket[]
  activity: [string, ActivityEvent[]][]
  artifacts: [string, Artifact[]][]
  decisions: [string, Decision][]
  runs: [string, RunState][]
  memory: MemoryEntry[]
  counters: [string, number][]
}

class Store {
  private tickets = new Map<string, Ticket>()
  private activity = new Map<string, ActivityEvent[]>()
  private artifacts = new Map<string, Artifact[]>()
  private decisions = new Map<string, Decision>()
  private runs = new Map<string, RunState>()
  private tasks = new Map<string, TaskRecord>()
  private memory: MemoryEntry[] = []
  private knowledge: KnowledgeEntry[] = []
  /** Next ticket number per workspace. */
  private counters = new Map<string, number>()
  private persistTimer?: NodeJS.Timeout

  // -- lifecycle -----------------------------------------------------------

  reset(): void {
    this.tickets.clear()
    this.activity.clear()
    this.artifacts.clear()
    this.decisions.clear()
    this.runs.clear()
    this.tasks.clear()
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
      if (snapshot.version !== 1) return false

      this.reset()
      for (const ticket of snapshot.tickets) this.tickets.set(ticket.reference, ticket)
      this.activity = new Map(snapshot.activity)
      this.artifacts = new Map(snapshot.artifacts)
      this.decisions = new Map(snapshot.decisions)
      // A run that was mid-flight when the process died is not running now.
      this.runs = new Map(snapshot.runs.map(([ref, run]) => [ref, { ...run, active: false }]))
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
        version: 1,
        tickets: [...this.tickets.values()],
        activity: [...this.activity.entries()],
        artifacts: [...this.artifacts.entries()],
        decisions: [...this.decisions.entries()],
        runs: [...this.runs.entries()],
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

  nextReference(workspaceId: string): string {
    const workspace = getWorkspace(workspaceId)
    const next = (this.counters.get(workspace.id) ?? 1000) + 1
    this.counters.set(workspace.id, next)
    return `${workspace.ticketPrefix}-${next}`
  }

  putTicket(ticket: Ticket, options: { silent?: boolean } = {}): Ticket {
    this.tickets.set(ticket.reference, ticket)
    this.persist()
    if (!options.silent) {
      bus.emit({ type: 'ticket.updated', ticketRef: ticket.reference, workspaceId: ticket.workspaceId })
      bus.emit({ type: 'board.updated', workspaceId: ticket.workspaceId })
    }
    return ticket
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
    event: Omit<ActivityEvent, 'id' | 'seq' | 'ticketId' | 'timestamp'> & { timestamp?: string },
  ): ActivityEvent | undefined {
    const ticket = this.tickets.get(reference)
    if (!ticket) return undefined

    const rows = this.activity.get(reference) ?? []
    const row: ActivityEvent = {
      ...event,
      id: `${reference}-act-${rows.length}`,
      ticketId: reference,
      seq: rows.length,
      timestamp: event.timestamp ?? new Date().toISOString(),
    }

    rows.push(row)
    this.activity.set(reference, rows)
    this.persist()
    bus.emit({ type: 'ticket.updated', ticketRef: reference, workspaceId: ticket.workspaceId })
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

  setRun(reference: string, run: RunState): void {
    this.runs.set(reference, run)
    this.persist()
  }

  getRun(reference: string): RunState | undefined {
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
      for (const row of this.getActivity(ticket.reference)) {
        if (row.type !== 'a2a.response' || !row.fromAgent) continue
        responsesByAgent.set(row.fromAgent, (responsesByAgent.get(row.fromAgent) ?? 0) + 1)
      }
    }

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
  INVESTIGATING: 1,
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
  'getting', 'trying', 'since', 'yesterday', 'please', 'help',
])

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
}

/**
 * Institutional memory lookup. Tag overlap today; an embedding index when
 * there is one. Either way it answers with a 0..1 confidence, so the surfaces
 * that render it do not change when that happens.
 */
export function matchMemory(
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
      const haystack = new Set([...entry.tags, ...tokenise(`${entry.title} ${entry.symptom}`)])
      const hits = [...words].filter((word) => haystack.has(word))
      return {
        entry,
        confidence: Math.min(0.97, hits.length / Math.min(words.size, 6)),
        reason: hits.length ? `Matched on ${hits.slice(0, 3).join(', ')}` : 'No overlapping symptoms',
      }
    })
    .filter((match) => match.confidence >= 0.34)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
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
