import type {
  ActivityEvent,
  ActivityType,
  Artifact,
  MemoryEntry,
  Stage,
  StageId,
  Ticket,
  TicketStatus,
} from '../types'
import type { Scenario, ScenarioEvent } from './types'

/**
 * Turns an authored scenario into the shapes the UI consumes. Everything a
 * data file does not want to carry — sequence numbers, ids, timestamps, stage
 * derivation, progress — is derived here, once.
 *
 * `visibleCount` is what makes a live replay possible: the store compiles the
 * first N events and recompiles as more arrive, so a partially-streamed run
 * and a fully-loaded page go through exactly the same code path. That is also
 * why a browser refresh mid-run rebuilds an identical timeline.
 */

const ALL_STAGES: { id: StageId; label: string }[] = [
  { id: 'context', label: 'Context' },
  { id: 'investigate', label: 'Investigate' },
  { id: 'verify', label: 'Verify' },
  { id: 'approve', label: 'Approve' },
]

const EVENT_TYPE: Record<ScenarioEvent['kind'], ActivityType> = {
  thought: 'brain.thought',
  request: 'a2a.request',
  response: 'a2a.response',
  artifact: 'artifact.created',
  gate: 'run.awaiting_approval',
  decision: 'human.decision',
  notify: 'customer.notified',
  done: 'run.completed',
}

export interface CompiledScenario {
  ticket: Ticket
  activity: ActivityEvent[]
  artifacts: Artifact[]
  stages: Stage[]
}

export function compileScenario(
  scenario: Scenario,
  options: { visibleCount?: number; now?: Date; status?: TicketStatus } = {},
): CompiledScenario {
  const events = scenario.events
  const visibleCount = options.visibleCount ?? events.length
  const visible = events.slice(0, Math.max(0, visibleCount))
  const now = options.now ?? new Date()
  const createdAt = new Date(now.getTime() - scenario.ticket.createdMinutesAgo * 60_000)

  const activity = compileActivity(scenario, visible, createdAt)
  const artifacts = compileArtifacts(scenario, visible, createdAt)
  const stages = compileStages(scenario, visible)
  const status = options.status ?? deriveStatus(scenario, visibleCount)

  const lastEvent = visible[visible.length - 1]
  const lastActivity = activity[activity.length - 1]

  return {
    ticket: {
      id: scenario.ticket.reference,
      reference: scenario.ticket.reference,
      workspaceId: scenario.workspaceId,
      title: scenario.ticket.title,
      description: scenario.ticket.description,
      customer: scenario.ticket.customer,
      reportedBy: scenario.ticket.reportedBy,
      channel: scenario.ticket.channel,
      priority: scenario.ticket.priority,
      status,
      category: scenario.ticket.category,
      impact: scenario.ticket.impact,
      issueQuote: scenario.ticket.issueQuote,
      attachment: scenario.ticket.attachment,
      createdAt: createdAt.toISOString(),
      updatedAt: lastActivity?.timestamp ?? createdAt.toISOString(),
      // Brain has not chosen a path until it has said so on the timeline.
      path: visibleCount > 0 ? scenario.path : undefined,
      currentAgentId: currentAgentFor(lastEvent, status),
      currentAgentAction: currentActionFor(lastEvent, status),
      progress: progressFor(stages, status),
      stages,
    },
    activity,
    artifacts,
    stages,
  }
}

function compileActivity(
  scenario: Scenario,
  visible: ScenarioEvent[],
  createdAt: Date,
): ActivityEvent[] {
  const ticketId = scenario.ticket.reference

  const created: ActivityEvent = {
    id: `${ticketId}-act-0`,
    ticketId,
    seq: 0,
    type: 'ticket.created',
    fromAgent: 'customer',
    title: `${ticketId} raised via ${channelLabel(scenario.ticket.channel)}`,
    body: [scenario.ticket.issueQuote[0]],
    level: 'info',
    timestamp: createdAt.toISOString(),
  }

  const rest = visible.map<ActivityEvent>((event, index) => ({
    id: `${ticketId}-act-${index + 1}`,
    ticketId,
    seq: index + 1,
    type: EVENT_TYPE[event.kind],
    fromAgent: event.from,
    toAgent: event.to,
    taskType: event.taskType,
    title: event.title,
    body: event.body,
    logs: event.logs,
    level: event.level ?? 'info',
    durationMs: event.durationMs,
    payload: event.payload,
    timestamp: new Date(createdAt.getTime() + event.atSeconds * 1000).toISOString(),
  }))

  return [created, ...rest]
}

function compileArtifacts(
  scenario: Scenario,
  visible: ScenarioEvent[],
  createdAt: Date,
): Artifact[] {
  // An artifact exists once the event that produced it has been emitted, so a
  // half-finished run never shows a pull request it has not opened yet.
  const emitted = new Map<string, ScenarioEvent>()
  for (const event of visible) {
    if (event.kind === 'artifact' && event.artifactId) emitted.set(event.artifactId, event)
  }

  return scenario.artifacts
    .filter((artifact) => emitted.has(artifact.id))
    .map((artifact) => {
      const event = emitted.get(artifact.id)!
      return {
        ...artifact,
        id: `${scenario.ticket.reference}-${artifact.id}`,
        ticketId: scenario.ticket.reference,
        createdAt: new Date(createdAt.getTime() + event.atSeconds * 1000).toISOString(),
      } as Artifact
    })
}

function compileStages(scenario: Scenario, visible: ScenarioEvent[]): Stage[] {
  const needed = scenario.stages ?? ALL_STAGES.map((stage) => stage.id)
  const completedBy = new Map<StageId, string | undefined>()
  for (const event of visible) {
    if (event.completesStage) completedBy.set(event.completesStage, event.from)
  }

  const atGate = visible.some((event) => event.kind === 'gate')
  const decided = visible.some((event) => event.kind === 'decision')

  return ALL_STAGES.map(({ id, label }) => {
    if (!needed.includes(id)) {
      return { id, label, status: 'skipped' as const, detail: 'Not needed on this path' }
    }

    if (id === 'approve') {
      if (decided) return { id, label, status: 'complete' as const, agentId: 'human-approver' }
      if (atGate) return { id, label, status: 'active' as const, agentId: 'human-approver' }
      return { id, label, status: 'pending' as const }
    }

    if (completedBy.has(id)) {
      return { id, label, status: 'complete' as const, agentId: completedBy.get(id) }
    }

    // The first needed stage that is not complete is the one in flight.
    const firstOpen = needed.find((stageId) => stageId !== 'approve' && !completedBy.has(stageId))
    return { id, label, status: firstOpen === id && visible.length > 0 ? 'active' : 'pending' }
  })
}

function deriveStatus(scenario: Scenario, visibleCount: number): TicketStatus {
  if (visibleCount === 0) return 'NEW'
  if (visibleCount < scenario.events.length) return 'INVESTIGATING'
  return scenario.status
}

function progressFor(stages: Stage[], status: TicketStatus): number {
  if (status === 'RESOLVED') return 100
  const active = stages.filter((stage) => stage.status !== 'skipped')
  if (active.length === 0) return 0
  const complete = active.filter((stage) => stage.status === 'complete').length
  const inFlight = active.some((stage) => stage.status === 'active') ? 0.5 : 0
  return Math.round(((complete + inFlight) / active.length) * 100)
}

function currentAgentFor(event: ScenarioEvent | undefined, status: TicketStatus): string | undefined {
  if (status === 'RESOLVED' || status === 'REJECTED') return undefined
  if (!event) return undefined
  if (event.kind === 'gate') return 'human-approver'
  // On a request the work now sits with the receiver; otherwise with the sender.
  return event.kind === 'request' ? event.to : event.from
}

function currentActionFor(event: ScenarioEvent | undefined, status: TicketStatus): string | undefined {
  if (status === 'RESOLVED') return 'Closed'
  if (status === 'REJECTED') return 'Sent back for a human'
  if (!event) return 'Waiting to start'
  if (event.kind === 'gate') return 'Waiting for your approval'
  if (event.kind === 'request') return event.taskType ? humanise(event.taskType) : 'Working'
  return event.title.length > 48 ? `${event.title.slice(0, 45)}…` : event.title
}

function humanise(taskType: string): string {
  return taskType
    .toLowerCase()
    .split('_')
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ')
}

function channelLabel(channel: Ticket['channel']): string {
  const labels: Record<Ticket['channel'], string> = {
    chat: 'the customer chat',
    email: 'email',
    portal: 'the customer portal',
    signal: 'a monitoring signal',
    event: 'a business event',
  }
  return labels[channel]
}

/** The memory entry a finished run contributes back to the control tower. */
export function memoryFromScenario(scenario: Scenario, learnedAt: Date): MemoryEntry | undefined {
  if (!scenario.memory) return undefined
  return {
    ...scenario.memory,
    id: `mem-${scenario.id}`,
    workspaceId: scenario.workspaceId,
    sourceTicketRef: scenario.ticket.reference,
    learnedAt: learnedAt.toISOString().slice(0, 10),
  }
}
