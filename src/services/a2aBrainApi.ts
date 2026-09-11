import type {
  A2AResponse,
  A2ATask,
  A2ATaskType,
  AgentActivity,
  AgentId,
  ClaraResult,
  DevAgentResult,
  QaAgentResult,
} from '../types/a2a'
import type {
  BrainReply,
  BrainTicket,
  InvestigationStep,
  Resolution,
  SimilarIssue,
  TicketStatus,
} from '../types/brain'
import type { DemoScenario } from '../data/demoScenario'
import type {
  BrainApi,
  InvestigationOptions,
  MessageRequest,
  TicketRequest,
} from './brainApi'
import {
  INVESTIGATION_PLAN,
  KNOWLEDGE_BASE,
  SCENARIOS,
  matchScenario,
} from '../data/demoScenario'
import { delay } from '../utils/delay'
import { createId } from '../utils/id'

export interface A2ABrainApiOptions {
  /**
   * Scales every simulated delay. `0.5` runs the demo twice as fast,
   * `0` makes it effectively instant (useful in tests).
   */
  speed?: number
  /** Override the scripted runs, e.g. to demo a prospect's own scenario. */
  scenarios?: DemoScenario[]
}

/** The typed payloads an agent can hand back to Brain. */
export type A2AAgentResult = ClaraResult | DevAgentResult | QaAgentResult

/**
 * One delegation: the envelope Brain sent, and the envelope that came back.
 * A missing `response` means the task is still in flight - the approval task
 * stays that way, because the human gate never closes on its own.
 */
export interface A2AExchange {
  task: A2ATask
  response?: A2AResponse<A2AAgentResult>
}

/** Everything this instance remembers about one ticket. */
interface TicketRun {
  ticket: BrainTicket
  scenario: DemoScenario
  exchanges: A2AExchange[]
}

/** A scripted feed line before the orchestrator stamps an id on it. */
type ScenarioActivity = Omit<AgentActivity, 'id'> & { afterStep: string }

/** Brain sits on the orchestrator side of every envelope it sends. */
const BRAIN: AgentId = 'procol-brain'

/** Who Brain hands the work to when a stage finishes, and under which verb. */
const DELEGATIONS: Record<string, { to: AgentId; type: A2ATaskType }> = {
  understand: { to: 'clara', type: 'GET_PRODUCT_CONTEXT' },
  context: { to: 'dev-agent', type: 'INVESTIGATE_BUG' },
  code: { to: 'qa-agent', type: 'RUN_TESTS' },
  validate: { to: 'manager', type: 'REQUEST_APPROVAL' },
}

/** Whose open task each finished stage answers. */
const SETTLEMENTS: Record<string, AgentId> = {
  context: 'clara',
  code: 'dev-agent',
  validate: 'qa-agent',
}

/**
 * How long each stage holds the floor, in ms at speed 1. Tuned so a full run
 * lands near eleven seconds - long enough to read, short enough to demo.
 */
const STAGE_MS: Record<string, number> = {
  understand: 800,
  context: 1400,
  code: 1500,
  validate: 1400,
  approval: 1200,
}

const DEFAULT_STAGE_MS = 1400

/** Gap between two lines surfacing, so the feed reads as a stream. */
const REVEAL_MS = 400

/**
 * Demo backend that runs a ticket through the actual A2A choreography:
 * Brain classifies, then delegates to Clara, the Dev Agent, QA and finally a
 * human Manager - one task envelope at a time, one stage at a time.
 *
 * What separates it from the bundled MockBrainApi is that the agent story is
 * not narration. Every line in the activity feed is stamped with the id of a
 * real {@link A2ATask}, and {@link A2ABrainApi.getTasks} hands those envelopes
 * back, so the delegation can be inspected and asserted on rather than
 * taken on trust.
 */
export class A2ABrainApi implements BrainApi {
  private readonly speed: number
  private readonly scenarios: DemoScenario[]
  private readonly knowledgeBase: SimilarIssue[]
  /** Only set when a host supplies its own scripts; see {@link resolveScenario}. */
  private readonly fallbackScenario: DemoScenario | undefined
  private readonly runs = new Map<string, TicketRun>()

  constructor(options: A2ABrainApiOptions = {}) {
    this.speed = options.speed ?? 1
    this.scenarios = options.scenarios ?? SCENARIOS
    this.fallbackScenario = options.scenarios?.[0]
    this.knowledgeBase = options.scenarios
      ? options.scenarios
          .map((scenario) => scenario.similarIssue)
          .filter((issue): issue is SimilarIssue => Boolean(issue))
      : KNOWLEDGE_BASE
  }

  async searchSimilarIssues({ message }: MessageRequest): Promise<SimilarIssue[]> {
    await this.wait(1400)

    const known = this.resolveScenario(message).similarIssue
    if (!known) return []

    // The scenario names the prior ticket; the knowledge base is what Brain
    // actually searches, so prefer the indexed copy when it is there.
    return [this.knowledgeBase.find((issue) => issue.id === known.id) ?? known]
  }

  async createTicket({ message, context }: MessageRequest): Promise<BrainTicket> {
    await this.wait(500)

    const scenario = this.resolveScenario(message)
    const ticket: BrainTicket = {
      id: createId('ticket'),
      reference: scenario.ticket.reference,
      title: scenario.ticket.title,
      status: 'open',
      createdAt: new Date().toISOString(),
      context,
    }

    this.runs.set(ticket.id, { ticket, scenario, exchanges: [] })
    return ticket
  }

  async getTicketStatus({ ticketId }: TicketRequest): Promise<TicketStatus> {
    await this.wait(200)
    return this.runs.get(ticketId)?.ticket.status ?? 'open'
  }

  async sendMessage({ message }: MessageRequest): Promise<BrainReply> {
    await this.wait(900)

    const known = this.resolveScenario(message).similarIssue
    return {
      message: known
        ? `We have seen this before - ticket #${known.reference}: ${known.solution} ` +
          `If it is happening again, I can put Clara, the Dev Agent and QA on it and come back with a fix.`
        : `Noted: "${summarise(message)}". ` +
          `I can ask Clara for the expected behaviour and have the Dev Agent look at the code - ` +
          `say the word and I will open a ticket and start the investigation.`,
    }
  }

  /**
   * The A2A envelopes Brain sent for a ticket, oldest first, each with the
   * response it received. This is the audit trail behind the activity feed:
   * the feed is the story, this is the evidence.
   */
  getTasks(ticketId: string): A2AExchange[] {
    const run = this.runs.get(ticketId)
    if (!run) return []
    return run.exchanges.map((exchange) => ({ ...exchange }))
  }

  async startInvestigation(
    { ticketId }: TicketRequest,
    options: InvestigationOptions = {},
  ): Promise<Resolution> {
    const { onProgress, signal } = options
    const run = this.runFor(ticketId)
    run.ticket.status = 'investigating'

    // A scenario can declare a shorter plan: a configuration issue stops after
    // Clara rather than waking the engineering agents.
    const plan = run.scenario.plan
      ? INVESTIGATION_PLAN.filter((step) => run.scenario.plan?.includes(step.id))
      : INVESTIGATION_PLAN

    const steps: InvestigationStep[] = plan.map((step, index) => ({
      ...step,
      status: index === 0 ? 'active' : 'pending',
    }))
    const activity: AgentActivity[] = []

    // Consumers replace their feed with whatever arrives, so every update
    // carries the accumulated activity rather than the newest slice.
    const emit = (resolution?: Resolution) =>
      onProgress?.({ ticketId, steps: cloneSteps(steps), activity: [...activity], resolution })

    emit()

    for (let index = 0; index < steps.length; index++) {
      const current = steps[index]
      if (!current) continue

      await this.wait(STAGE_MS[current.id] ?? DEFAULT_STAGE_MS, signal)

      current.status = 'complete'
      const next = steps[index + 1]
      if (next) next.status = 'active'

      this.routeStage(run, current.id, Boolean(next))
      emit()

      for (const entry of run.scenario.activity) {
        if (entry.afterStep !== current.id) continue
        await this.wait(REVEAL_MS, signal)
        activity.push(this.reveal(run, entry))
        emit()
      }

      // Only the human gate holds the run open. A plan that ends earlier
      // completes every stage it declared.
      if (next?.id === 'approval' && index === steps.length - 2) break
    }

    await this.wait(900, signal)

    const { dev, qa, configFix } = run.scenario

    // Clara settled it: an answer the customer can act on, with no PR to
    // approve and nothing for a manager to gate.
    if (configFix || !dev || !qa) {
      const resolution: Resolution = {
        ticketId,
        summary: configFix?.summary ?? 'Resolved from product configuration - no code change needed.',
        rootCause: configFix?.change ?? run.scenario.clara.notes,
        checks: (configFix?.checks ?? ['Product context retrieved', 'Answer confirmed']).map(
          (label) => ({ label, status: 'complete' as const }),
        ),
      }

      run.ticket.status = 'awaiting_approval'
      emit(resolution)
      return resolution
    }

    const resolution: Resolution = {
      ticketId,
      summary: 'Your issue has been fixed and is ready for approval.',
      rootCause: dev.rootCause,
      checks: [
        { label: 'Root cause identified', status: 'complete' },
        { label: 'Fix implemented', status: 'complete' },
        { label: 'QA validation', status: 'active' },
      ],
      tests: { passed: qa.passed, total: qa.tests },
      pr: { ...dev.pr },
      filesChanged: [...dev.filesChanged],
    }

    await this.wait(1100, signal)

    resolution.checks = resolution.checks.map((check) => ({ ...check, status: 'complete' }))
    run.ticket.status = 'awaiting_approval'

    emit(resolution)
    return resolution
  }

  /**
   * Settles the task the finished stage was waiting on, then opens the next
   * one. Envelopes are created before that stage's lines are revealed so each
   * line can quote the taskId it belongs to.
   */
  private routeStage(run: TicketRun, stageId: string, hasNextStage: boolean): void {
    const answering = SETTLEMENTS[stageId]
    const answer = answering ? resultFor(run.scenario, answering) : undefined
    if (answering && answer) this.settleTask(run, answering, answer)

    // Nothing left in the plan means nothing left to delegate to.
    if (!hasNextStage) return

    const delegation = DELEGATIONS[stageId]
    if (delegation) {
      this.openTask(run, delegation.to, delegation.type, handoverFor(run.scenario, delegation.to))
    }
  }

  private openTask(
    run: TicketRun,
    to: AgentId,
    type: A2ATaskType,
    handover: Record<string, unknown>,
  ): void {
    run.exchanges.push({
      task: {
        taskId: createId('task'),
        from: BRAIN,
        to,
        type,
        context: {
          ticketId: run.ticket.id,
          customer: run.scenario.ticket.customer,
          issue: run.ticket.title,
          ...handover,
        },
      },
    })
  }

  private settleTask(run: TicketRun, agent: AgentId, result: A2AAgentResult): void {
    const exchange = latestTaskFor(run, agent)
    if (!exchange || exchange.response) return
    exchange.response = { taskId: exchange.task.taskId, status: 'completed', result }
  }

  /** Stamps a scripted line with an id and the envelope it belongs to. */
  private reveal(run: TicketRun, entry: ScenarioActivity): AgentActivity {
    const line: AgentActivity = {
      id: createId('activity'),
      from: entry.from,
      to: entry.to,
      text: entry.text,
      via: entry.via,
      kind: entry.kind,
      at: new Date().toISOString(),
    }

    // An MCP call happens inside the A2A task its agent is running, so both
    // axes resolve the same way: whichever side of the line is not Brain.
    const taskId = taskIdFor(run, entry.from === BRAIN ? entry.to : entry.from)
    if (taskId) line.taskId = taskId
    if (entry.tool) line.tool = { ...entry.tool }

    return line
  }

  /**
   * Investigations can be started for a ticket this instance never created
   * (a host that restores a ticket id across reloads), so fall back to the
   * generic script instead of dead-ending the demo.
   */
  private runFor(ticketId: string): TicketRun {
    const existing = this.runs.get(ticketId)
    if (existing) return existing

    const scenario = this.resolveScenario('')
    const run: TicketRun = {
      ticket: {
        id: ticketId,
        reference: scenario.ticket.reference,
        title: scenario.ticket.title,
        status: 'open',
        createdAt: new Date().toISOString(),
      },
      scenario,
      exchanges: [],
    }

    this.runs.set(ticketId, run)
    return run
  }

  /**
   * Routes a message to a script. With the packaged scenarios this is exactly
   * `matchScenario`, including its generic catch-all; a host that supplied its
   * own scripts gets theirs, and their first entry as the catch-all.
   */
  private resolveScenario(message: string): DemoScenario {
    const haystack = message.toLowerCase()
    const matched = this.scenarios.find((scenario) =>
      scenario.match.some((word) => haystack.includes(word)),
    )

    return matched ?? this.fallbackScenario ?? matchScenario(message)
  }

  private wait(ms: number, signal?: AbortSignal) {
    return delay(Math.round(ms * this.speed), signal)
  }
}

/**
 * The newest envelope Brain sent to an agent - answered or not, because an
 * agent's reply and its MCP tool calls all belong to the task it is running.
 */
function latestTaskFor(run: TicketRun, agent: AgentId): A2AExchange | undefined {
  return [...run.exchanges].reverse().find((exchange) => exchange.task.to === agent)
}

function taskIdFor(run: TicketRun, agent: AgentId): string | undefined {
  return latestTaskFor(run, agent)?.task.taskId
}

function resultFor(scenario: DemoScenario, agent: AgentId): A2AAgentResult | undefined {
  if (agent === 'clara') return scenario.clara
  if (agent === 'dev-agent') return scenario.dev
  return scenario.qa
}

/**
 * What the previous agents produced, forwarded to the next one. This is why
 * the envelope context is open-ended: QA cannot validate a PR it was never
 * told about, and the Manager approves a number, not a vibe.
 */
function handoverFor(scenario: DemoScenario, to: AgentId): Record<string, unknown> {
  if (to === 'dev-agent') {
    return { expected: scenario.clara.expected, customerConfig: scenario.clara.customerConfig }
  }
  if (to === 'qa-agent' && scenario.dev) {
    return { pr: scenario.dev.pr.number, filesChanged: scenario.dev.filesChanged }
  }
  if (to === 'manager' && scenario.dev && scenario.qa) {
    return { pr: scenario.dev.pr.number, tests: `${scenario.qa.passed}/${scenario.qa.tests}` }
  }
  return {}
}

function cloneSteps(steps: InvestigationStep[]): InvestigationStep[] {
  return steps.map((step) => ({ ...step }))
}

function summarise(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, ' ')
  return trimmed.length > 72 ? `${trimmed.slice(0, 69)}...` : trimmed
}
