import type {
  BrainReply,
  BrainTicket,
  InvestigationStep,
  Resolution,
  SimilarIssue,
  TicketStatus,
} from '../types/brain'
import type {
  BrainApi,
  InvestigationOptions,
  MessageRequest,
  TicketRequest,
} from './brainApi'
import { delay } from '../utils/delay'
import { createId } from '../utils/id'

export interface MockBrainApiOptions {
  /**
   * Scales every simulated delay. `0.5` runs the demo twice as fast,
   * `0` makes it effectively instant (useful in tests).
   */
  speed?: number
  /** Override the knowledge base used for similarity search. */
  knowledgeBase?: SimilarIssue[]
}

const DEFAULT_KNOWLEDGE_BASE: SimilarIssue[] = [
  {
    id: 'issue-892',
    reference: '892',
    title: 'GST calculation incorrect',
    customer: 'XYZ Corp',
    solution:
      'Tenant GST configuration was not being passed to the invoice calculator.',
    confidence: 0.94,
  },
  {
    id: 'issue-731',
    reference: '731',
    title: 'GRN quantity mismatch on partial delivery',
    customer: 'Northwind Steel',
    solution:
      'Partial receipts were rounding quantities before the tolerance check ran.',
    confidence: 0.88,
  },
]

/** Keywords that route a message to a knowledge base entry. */
const MATCHERS: Array<{ issueId: string; keywords: string[] }> = [
  { issueId: 'issue-892', keywords: ['gst', 'tax', 'invoice', 'calculat', '18%', '12%'] },
  { issueId: 'issue-731', keywords: ['grn', 'quantity', 'delivery', 'receipt', 'mismatch'] },
]

const INVESTIGATION_PLAN: Array<Omit<InvestigationStep, 'status'>> = [
  { id: 'understand', label: 'Understanding the issue' },
  { id: 'context', label: 'Fetching product context', agent: 'Clara' },
  { id: 'code', label: 'Investigating code', agent: 'Development Agent' },
  { id: 'validate', label: 'Running validation', agent: 'QA Agent' },
  { id: 'approval', label: 'Waiting for approval', agent: 'Manager' },
]

/**
 * In-memory Brain API used for demos and local development.
 * It implements the same contract as the real client, including the
 * agent investigation timeline.
 */
export class MockBrainApi implements BrainApi {
  private readonly speed: number
  private readonly knowledgeBase: SimilarIssue[]
  private readonly tickets = new Map<string, BrainTicket>()
  private ticketCounter = 1244

  constructor(options: MockBrainApiOptions = {}) {
    this.speed = options.speed ?? 1
    this.knowledgeBase = options.knowledgeBase ?? DEFAULT_KNOWLEDGE_BASE
  }

  async searchSimilarIssues({ message }: MessageRequest): Promise<SimilarIssue[]> {
    await this.wait(1400)

    const haystack = message.toLowerCase()
    const matched = MATCHERS.filter((matcher) =>
      matcher.keywords.some((keyword) => haystack.includes(keyword)),
    )
      .map((matcher) => this.knowledgeBase.find((issue) => issue.id === matcher.issueId))
      .filter((issue): issue is SimilarIssue => Boolean(issue))

    return matched.slice(0, 1)
  }

  async createTicket({ message, context }: MessageRequest): Promise<BrainTicket> {
    await this.wait(500)

    const ticket: BrainTicket = {
      id: createId('ticket'),
      reference: String(++this.ticketCounter),
      title: summarise(message),
      status: 'open',
      createdAt: new Date().toISOString(),
      context,
    }

    this.tickets.set(ticket.id, ticket)
    return ticket
  }

  async getTicketStatus({ ticketId }: TicketRequest): Promise<TicketStatus> {
    await this.wait(200)
    return this.tickets.get(ticketId)?.status ?? 'open'
  }

  async sendMessage({ message }: MessageRequest): Promise<BrainReply> {
    await this.wait(900)
    return {
      message:
        `I've noted that. ` +
        `Here's what I know so far about "${summarise(message)}". ` +
        `If this turns out to be a bug, I can open a ticket and start an investigation for you.`,
    }
  }

  async startInvestigation(
    { ticketId }: TicketRequest,
    options: InvestigationOptions = {},
  ): Promise<Resolution> {
    const { onProgress, signal } = options
    const ticket = this.tickets.get(ticketId)
    if (ticket) ticket.status = 'investigating'

    const steps: InvestigationStep[] = INVESTIGATION_PLAN.map((step, index) => ({
      ...step,
      status: index === 0 ? 'active' : 'pending',
    }))

    onProgress?.({ ticketId, steps: clone(steps) })

    for (let index = 0; index < steps.length; index++) {
      await this.wait(index === 0 ? 900 : 1600, signal)

      const current = steps[index]
      if (!current) continue
      current.status = 'complete'

      const next = steps[index + 1]
      if (next) next.status = 'active'

      // The final step needs a human, so it stays active rather than complete.
      if (index === steps.length - 2 && next) {
        onProgress?.({ ticketId, steps: clone(steps) })
        break
      }

      onProgress?.({ ticketId, steps: clone(steps) })
    }

    await this.wait(1200, signal)

    const resolution: Resolution = {
      ticketId,
      summary: 'Your issue has been fixed and is ready for approval.',
      rootCause:
        'Tenant GST configuration was not forwarded to the invoice calculator, so the default 12% slab was applied.',
      checks: [
        { label: 'Root cause identified', status: 'complete' },
        { label: 'Fix implemented', status: 'complete' },
        { label: 'QA validation', status: 'active' },
      ],
      tests: { passed: 47, total: 47 },
    }

    await this.wait(1400, signal)

    resolution.checks = resolution.checks.map((check) => ({ ...check, status: 'complete' }))
    if (ticket) ticket.status = 'awaiting_approval'

    onProgress?.({ ticketId, steps: clone(steps), resolution })
    return resolution
  }

  private wait(ms: number, signal?: AbortSignal) {
    return delay(Math.round(ms * this.speed), signal)
  }
}

function clone(steps: InvestigationStep[]): InvestigationStep[] {
  return steps.map((step) => ({ ...step }))
}

function summarise(message: string): string {
  const trimmed = message.trim().replace(/\s+/g, ' ')
  return trimmed.length > 72 ? `${trimmed.slice(0, 69)}...` : trimmed
}
