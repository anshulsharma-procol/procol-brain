import type {
  AgentActivity,
  AgentDescriptor,
  ApprovalResult,
  ClaraResult,
  DevAgentResult,
  QaAgentResult,
} from '../types/a2a'
import type { InvestigationStep, SimilarIssue } from '../types/brain'

/**
 * ============================================================================
 *  THE DUMMY DATA FILE
 * ============================================================================
 *
 * Everything the widget shows while there is no backend lives here, and
 * nowhere else. When the Brain API is ready, point `<ProcolBrain apiBaseUrl>`
 * at it - no component, hook or type has to change, and this file can be
 * deleted or kept for demos and tests.
 *
 * Shapes mirror the real endpoints one-for-one:
 *   agents      -> GET  /agents
 *   ticket      -> GET  /tickets/:id
 *   activity    -> GET  /tickets/:id/activity
 *   clara/dev/qa-> POST /a2a/tasks   (one A2A response each)
 *   approval    -> POST /tickets/:id/approve
 */

/** GET /agents - the A2A registry Brain routes capabilities against. */
export const AGENT_REGISTRY: AgentDescriptor[] = [
  {
    id: 'procol-brain',
    name: 'Procol Brain',
    role: 'Orchestrator',
    capabilities: ['classify_ticket', 'route_capability', 'summarise_resolution'],
    protocol: 'A2A',
    status: 'connected',
    avatar: '🧠',
  },
  {
    id: 'clara',
    name: 'Clara',
    role: 'Product Knowledge',
    capabilities: ['product_knowledge', 'customer_context'],
    protocol: 'A2A',
    status: 'connected',
    avatar: '🤖',
    tools: [{ server: 'product-db', capabilities: ['get_customer_config', 'search_docs'] }],
  },
  {
    id: 'dev-agent',
    name: 'Development Agent',
    role: 'Code Investigation + PR',
    capabilities: ['bug_analysis', 'code_fix', 'create_pr'],
    protocol: 'A2A',
    status: 'connected',
    avatar: '👨‍💻',
    tools: [
      { server: 'github', capabilities: ['read_file', 'create_branch', 'create_pr'] },
    ],
  },
  {
    id: 'qa-agent',
    name: 'QA Agent',
    role: 'Testing + Validation',
    capabilities: ['run_tests', 'validate_fix'],
    protocol: 'A2A',
    status: 'connected',
    avatar: '🧪',
    tools: [{ server: 'test-runner', capabilities: ['run_tests', 'get_test_results'] }],
  },
  {
    id: 'manager',
    name: 'Manager',
    role: 'Human Approval',
    capabilities: ['approve_fix', 'reject_fix'],
    protocol: 'A2A',
    status: 'connected',
    avatar: '👔',
  },
]

/** The five-stage pipeline the customer watches. */
export const INVESTIGATION_PLAN: Array<Omit<InvestigationStep, 'status'>> = [
  { id: 'understand', label: 'Understanding the issue' },
  { id: 'context', label: 'Fetching product context', agent: 'Clara' },
  { id: 'code', label: 'Investigating code', agent: 'Development Agent' },
  { id: 'validate', label: 'Running validation', agent: 'QA Agent' },
  { id: 'approval', label: 'Waiting for approval', agent: 'Manager' },
]

/** One scripted end-to-end run. */
export interface DemoScenario {
  id: string
  /** Lowercase keywords that route a customer message to this scenario. */
  match: string[]
  ticket: {
    reference: string
    title: string
    customer: string
    priority: 'LOW' | 'MEDIUM' | 'HIGH'
  }
  /** Previously resolved ticket surfaced before any investigation starts. */
  similarIssue?: SimilarIssue
  clara: ClaraResult
  dev: DevAgentResult
  qa: QaAgentResult
  approval: ApprovalResult
  /**
   * The agent conversation, in order. The orchestrator stamps ids and reveals
   * these one at a time as the matching pipeline stage runs.
   */
  activity: Array<Omit<AgentActivity, 'id'> & { afterStep: string }>
}

const GST_SCENARIO: DemoScenario = {
  id: 'gst',
  match: ['gst', 'tax', 'invoice', 'calculat', '18%', '12%'],
  ticket: {
    reference: '1245',
    title: 'Invoice GST calculation incorrect',
    customer: 'ABC Corp',
    priority: 'HIGH',
  },
  similarIssue: {
    id: 'issue-892',
    reference: '892',
    title: 'GST calculation incorrect',
    customer: 'XYZ Corp',
    solution: 'Tenant GST configuration was not being passed to the invoice calculator.',
    confidence: 0.94,
  },
  clara: {
    expected: 'Expected GST: 18%',
    customerConfig: { GST: '18%', Discount: '10%' },
    formula: 'Base - Discount + GST',
    notes: 'ABC Corp is on the standard 18% slab; the 12% slab is the platform default.',
  },
  dev: {
    rootCause: 'Tenant context was not passed to the GST calculator, so the default 12% slab was applied.',
    filesChanged: ['invoiceCalculator.ts'],
    pr: { number: 452, status: 'created', title: 'fix: pass tenant GST config to invoice calculator' },
  },
  qa: {
    status: 'passed',
    tests: 47,
    passed: 47,
    failed: 0,
    message: 'All invoice regression tests passed.',
  },
  approval: { approved: true, approver: 'Manager' },
  activity: [
    {
      afterStep: 'understand',
      from: 'procol-brain',
      to: 'clara',
      via: 'A2A',
      kind: 'request',
      text: 'What should GST be for ABC Corp?',
    },
    {
      afterStep: 'context',
      from: 'clara',
      to: 'procol-brain',
      via: 'A2A',
      kind: 'response',
      text: 'Expected GST = 18%. ABC Corp: GST 18%, Discount 10%. Formula: Base - Discount + GST.',
    },
    {
      afterStep: 'context',
      from: 'procol-brain',
      to: 'dev-agent',
      via: 'A2A',
      kind: 'request',
      text: 'Investigate the invoice calculation. Expected GST is 18%.',
    },
    {
      afterStep: 'code',
      from: 'dev-agent',
      to: 'github',
      via: 'MCP',
      kind: 'tool',
      text: 'Read invoiceCalculator.ts, opened branch fix/gst-tenant-context',
      tool: { server: 'github', call: 'read_file + create_branch' },
    },
    {
      afterStep: 'code',
      from: 'dev-agent',
      to: 'procol-brain',
      via: 'A2A',
      kind: 'response',
      text: 'Root cause found: tenant context never reached the GST calculator. PR #452 created.',
    },
    {
      afterStep: 'code',
      from: 'procol-brain',
      to: 'qa-agent',
      via: 'A2A',
      kind: 'request',
      text: 'Validate PR #452 against the invoice regression suite.',
    },
    {
      afterStep: 'validate',
      from: 'qa-agent',
      to: 'test-runner',
      via: 'MCP',
      kind: 'tool',
      text: 'Ran invoice regression suite',
      tool: { server: 'test-runner', call: 'run_tests' },
    },
    {
      afterStep: 'validate',
      from: 'qa-agent',
      to: 'procol-brain',
      via: 'A2A',
      kind: 'response',
      text: '47 / 47 tests passed. Fix validated.',
    },
    {
      afterStep: 'validate',
      from: 'procol-brain',
      to: 'manager',
      via: 'A2A',
      kind: 'request',
      text: 'Fix ready for approval: PR #452, 47/47 tests passing.',
    },
  ],
}

const GRN_SCENARIO: DemoScenario = {
  id: 'grn',
  match: ['grn', 'quantity', 'delivery', 'receipt', 'mismatch', 'tolerance'],
  ticket: {
    reference: '1246',
    title: 'GRN quantity mismatch on partial delivery',
    customer: 'Northwind Steel',
    priority: 'MEDIUM',
  },
  similarIssue: {
    id: 'issue-731',
    reference: '731',
    title: 'GRN quantity mismatch on partial delivery',
    customer: 'Northwind Steel',
    solution: 'Partial receipts were rounding quantities before the tolerance check ran.',
    confidence: 0.88,
  },
  clara: {
    expected: 'Tolerance: +/- 2% on partial receipts',
    customerConfig: { Tolerance: '2%', 'Partial receipts': 'Allowed' },
    notes: 'Rounding must happen after the tolerance check, not before.',
  },
  dev: {
    rootCause: 'Quantities were rounded before the tolerance comparison, so a 1.4% variance read as a mismatch.',
    filesChanged: ['grnTolerance.ts', 'receiptRounding.ts'],
    pr: { number: 458, status: 'created', title: 'fix: apply tolerance before rounding receipt quantities' },
  },
  qa: {
    status: 'passed',
    tests: 31,
    passed: 31,
    failed: 0,
    message: 'GRN tolerance suite passed.',
  },
  approval: { approved: true, approver: 'Manager' },
  activity: [
    {
      afterStep: 'understand',
      from: 'procol-brain',
      to: 'clara',
      via: 'A2A',
      kind: 'request',
      text: 'What is the receipt tolerance configured for Northwind Steel?',
    },
    {
      afterStep: 'context',
      from: 'clara',
      to: 'procol-brain',
      via: 'A2A',
      kind: 'response',
      text: 'Tolerance = +/- 2% on partial receipts; rounding applies after the check.',
    },
    {
      afterStep: 'context',
      from: 'procol-brain',
      to: 'dev-agent',
      via: 'A2A',
      kind: 'request',
      text: 'Investigate the GRN tolerance comparison.',
    },
    {
      afterStep: 'code',
      from: 'dev-agent',
      to: 'github',
      via: 'MCP',
      kind: 'tool',
      text: 'Read grnTolerance.ts, opened branch fix/grn-tolerance-order',
      tool: { server: 'github', call: 'read_file + create_branch' },
    },
    {
      afterStep: 'code',
      from: 'dev-agent',
      to: 'procol-brain',
      via: 'A2A',
      kind: 'response',
      text: 'Rounding ran before the tolerance check. PR #458 created.',
    },
    {
      afterStep: 'code',
      from: 'procol-brain',
      to: 'qa-agent',
      via: 'A2A',
      kind: 'request',
      text: 'Validate PR #458.',
    },
    {
      afterStep: 'validate',
      from: 'qa-agent',
      to: 'test-runner',
      via: 'MCP',
      kind: 'tool',
      text: 'Ran GRN tolerance suite',
      tool: { server: 'test-runner', call: 'run_tests' },
    },
    {
      afterStep: 'validate',
      from: 'qa-agent',
      to: 'procol-brain',
      via: 'A2A',
      kind: 'response',
      text: '31 / 31 tests passed.',
    },
    {
      afterStep: 'validate',
      from: 'procol-brain',
      to: 'manager',
      via: 'A2A',
      kind: 'request',
      text: 'Fix ready for approval: PR #458, 31/31 tests passing.',
    },
  ],
}

/** Used when nothing matches, so any typed message still demos end to end. */
const GENERIC_SCENARIO: DemoScenario = {
  ...GST_SCENARIO,
  id: 'generic',
  match: [],
  similarIssue: undefined,
  ticket: { ...GST_SCENARIO.ticket, title: 'Reported issue', customer: 'Your organisation' },
}

export const SCENARIOS: DemoScenario[] = [GST_SCENARIO, GRN_SCENARIO]

/** Routes a customer message to a scripted run. */
export function matchScenario(message: string): DemoScenario {
  const haystack = message.toLowerCase()
  return (
    SCENARIOS.find((scenario) => scenario.match.some((word) => haystack.includes(word))) ??
    GENERIC_SCENARIO
  )
}

/** Knowledge base searched before any investigation is started. */
export const KNOWLEDGE_BASE: SimilarIssue[] = SCENARIOS.map((s) => s.similarIssue).filter(
  (issue): issue is SimilarIssue => Boolean(issue),
)
