import { MockBrainApi } from '../../src'
import type {
  BrainApi,
  InvestigationStep,
  Resolution,
  SimilarIssue,
} from '../../src'

/**
 * Demo-only Brain adapters that park the conversation at a chosen state, so
 * the showcase can display every screen side by side. Not part of the package.
 */
export type ShowcaseStage =
  | 'greeting'
  | 'searching'
  | 'similar'
  | 'investigating'
  | 'resolution'

const KNOWN_ISSUE: SimilarIssue = {
  id: 'issue-892',
  reference: '892',
  title: 'GST calculation incorrect',
  customer: 'XYZ Corp',
  solution: 'Tenant GST configuration was not being passed to the invoice calculator.',
  confidence: 0.94,
}

const MID_INVESTIGATION: InvestigationStep[] = [
  { id: 'understand', label: 'Understanding the issue', status: 'complete' },
  { id: 'context', label: 'Fetching product context', agent: 'Clara', status: 'complete' },
  { id: 'code', label: 'Investigating code', agent: 'Development Agent', status: 'active' },
  { id: 'validate', label: 'Running validation', agent: 'QA Agent', status: 'pending' },
  { id: 'approval', label: 'Waiting for approval', agent: 'Manager', status: 'pending' },
]

const DONE_INVESTIGATION: InvestigationStep[] = MID_INVESTIGATION.map((step, index) => ({
  ...step,
  status: index === MID_INVESTIGATION.length - 1 ? 'active' : 'complete',
}))

const RESOLUTION: Resolution = {
  ticketId: 'showcase',
  summary: 'Your issue has been fixed and is ready for approval.',
  rootCause:
    'Tenant GST configuration was not forwarded to the invoice calculator, so the default 12% slab was applied.',
  checks: [
    { label: 'Root cause identified', status: 'complete' },
    { label: 'Fix implemented', status: 'complete' },
    { label: 'QA validation', status: 'complete' },
  ],
  tests: { passed: 47, total: 47 },
}

/** A promise that never settles - freezes the UI in its loading state. */
const pending = <T,>(): Promise<T> => new Promise<T>(() => {})

function delegate(base: MockBrainApi): BrainApi {
  return {
    searchSimilarIssues: (request) => base.searchSimilarIssues(request),
    createTicket: (request) => base.createTicket(request),
    startInvestigation: (request, options) => base.startInvestigation(request, options),
    getTicketStatus: (request) => base.getTicketStatus(request),
    sendMessage: (request) => base.sendMessage(request),
  }
}

export function createShowcaseApi(stage: ShowcaseStage): BrainApi {
  const base = delegate(new MockBrainApi({ speed: 0 }))

  switch (stage) {
    case 'searching':
      return { ...base, searchSimilarIssues: () => pending<SimilarIssue[]>() }

    case 'investigating':
      return {
        ...base,
        searchSimilarIssues: async () => [],
        startInvestigation: (request, options) => {
          options?.onProgress?.({ ticketId: request.ticketId, steps: MID_INVESTIGATION })
          return pending<Resolution>()
        },
      }

    case 'resolution':
      return {
        ...base,
        searchSimilarIssues: async () => [],
        startInvestigation: async (request, options) => {
          const resolution = { ...RESOLUTION, ticketId: request.ticketId }
          options?.onProgress?.({
            ticketId: request.ticketId,
            steps: DONE_INVESTIGATION,
            resolution,
          })
          return resolution
        },
      }

    case 'similar':
      return { ...base, searchSimilarIssues: async () => [KNOWN_ISSUE] }

    case 'greeting':
    default:
      return base
  }
}
