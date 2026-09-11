import { A2ABrainApi } from '../../src'
import type {
  AgentActivity,
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
    'Tenant context was not passed to the GST calculator, so the default 12% slab was applied.',
  checks: [
    { label: 'Root cause identified', status: 'complete' },
    { label: 'Fix implemented', status: 'complete' },
    { label: 'QA validation', status: 'complete' },
  ],
  pr: {
    number: 452,
    status: 'created',
    title: 'fix: pass tenant GST config to invoice calculator',
  },
  filesChanged: ['invoiceCalculator.ts'],
  tests: { passed: 47, total: 47 },
}

/** A promise that never settles - freezes the UI in its loading state. */
const pending = <T,>(): Promise<T> => new Promise<T>(() => {})

/** The A2A hops visible while the Dev Agent is still working. */
const MID_ACTIVITY: AgentActivity[] = [
  {
    id: 'a1',
    from: 'procol-brain',
    to: 'clara',
    via: 'A2A',
    kind: 'request',
    text: 'What should GST be for ABC Corp?',
  },
  {
    id: 'a2',
    from: 'clara',
    to: 'procol-brain',
    via: 'A2A',
    kind: 'response',
    text: 'Expected GST = 18%. ABC Corp: GST 18%, Discount 10%. Formula: Base - Discount + GST.',
  },
  {
    id: 'a3',
    from: 'procol-brain',
    to: 'dev-agent',
    via: 'A2A',
    kind: 'request',
    text: 'Investigate the invoice calculation. Expected GST is 18%.',
  },
  {
    id: 'a4',
    from: 'dev-agent',
    to: 'github',
    via: 'MCP',
    kind: 'tool',
    text: 'Read invoiceCalculator.ts, opened branch fix/gst-tenant-context',
    tool: { server: 'github', call: 'read_file + create_branch' },
  },
]

function delegate(base: A2ABrainApi): BrainApi {
  return {
    searchSimilarIssues: (request) => base.searchSimilarIssues(request),
    createTicket: (request) => base.createTicket(request),
    startInvestigation: (request, options) => base.startInvestigation(request, options),
    getTicketStatus: (request) => base.getTicketStatus(request),
    sendMessage: (request) => base.sendMessage(request),
  }
}

export function createShowcaseApi(stage: ShowcaseStage): BrainApi {
  const base = delegate(new A2ABrainApi({ speed: 0 }))

  switch (stage) {
    case 'searching':
      return { ...base, searchSimilarIssues: () => pending<SimilarIssue[]>() }

    case 'investigating':
      return {
        ...base,
        searchSimilarIssues: async () => [],
        startInvestigation: (request, options) => {
          options?.onProgress?.({
            ticketId: request.ticketId,
            steps: MID_INVESTIGATION,
            activity: MID_ACTIVITY,
          })
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
