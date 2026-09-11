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
  /**
   * Stages this ticket actually needs, by id. Defaults to the full five.
   * A configuration issue stops after Clara - Brain does not wake the
   * engineering agents for something the customer can change in Settings.
   */
  plan?: string[]
  /** Present when Clara's answer resolves it: no code change, no PR. */
  configFix?: {
    summary: string
    change: string
    checks: string[]
  }
  dev?: DevAgentResult
  qa?: QaAgentResult
  approval?: ApprovalResult
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

const AUCTION_SCENARIO: DemoScenario = {
  id: 'auction',
  match: ['auction', 'bid', 'bidding', 'lot', 'extension', 'timer', 'closed'],
  ticket: {
    reference: '1251',
    title: 'Bid rejected seconds before auction close',
    customer: 'Northwind Steel',
    priority: 'HIGH',
  },
  similarIssue: undefined,
  clara: {
    expected: 'Auto-extension: any bid in the last 2 minutes extends the lot by 3 minutes',
    customerConfig: { 'Auto-extension': 'On', 'Extension window': '2 min', 'Extension by': '3 min' },
    notes:
      'Northwind Steel runs English reverse auctions with auto-extension enabled on every lot.',
  },
  dev: {
    rootCause:
      'The bid validator compared against the lot\'s original close time, so bids arriving during an auto-extension were rejected as late.',
    filesChanged: ['auctionTimer.ts', 'bidValidator.ts'],
    pr: { number: 467, status: 'created', title: 'fix: validate bids against the extended close time' },
  },
  qa: {
    status: 'passed',
    tests: 23,
    passed: 23,
    failed: 0,
    message: 'Auction timing suite passed, including two new extension-window cases.',
  },
  approval: { approved: true, approver: 'Manager' },
  activity: [
    {
      afterStep: 'understand',
      from: 'procol-brain',
      to: 'clara',
      via: 'A2A',
      kind: 'request',
      text: 'How should auto-extension behave for Northwind Steel auctions?',
    },
    {
      afterStep: 'context',
      from: 'clara',
      to: 'procol-brain',
      via: 'A2A',
      kind: 'response',
      text: 'Auto-extension is on: a bid in the last 2 minutes extends the lot by 3 minutes.',
    },
    {
      afterStep: 'context',
      from: 'procol-brain',
      to: 'dev-agent',
      via: 'A2A',
      kind: 'request',
      text: 'A bid 8 seconds before close was rejected. Check the bid validator against extension.',
    },
    {
      afterStep: 'code',
      from: 'dev-agent',
      to: 'github',
      via: 'MCP',
      kind: 'tool',
      text: 'Read auctionTimer.ts and bidValidator.ts, opened branch fix/auction-extension-window',
      tool: { server: 'github', call: 'read_file + create_branch' },
    },
    {
      afterStep: 'code',
      from: 'dev-agent',
      to: 'procol-brain',
      via: 'A2A',
      kind: 'response',
      text: 'The validator used the original close time, ignoring the extension. PR #467 created.',
    },
    {
      afterStep: 'code',
      from: 'procol-brain',
      to: 'qa-agent',
      via: 'A2A',
      kind: 'request',
      text: 'Validate PR #467 against the auction timing suite.',
    },
    {
      afterStep: 'validate',
      from: 'qa-agent',
      to: 'test-runner',
      via: 'MCP',
      kind: 'tool',
      text: 'Ran auction timing suite with two new extension-window cases',
      tool: { server: 'test-runner', call: 'run_tests' },
    },
    {
      afterStep: 'validate',
      from: 'qa-agent',
      to: 'procol-brain',
      via: 'A2A',
      kind: 'response',
      text: '23 / 23 tests passed, including the 8-second-before-close case.',
    },
    {
      afterStep: 'validate',
      from: 'procol-brain',
      to: 'manager',
      via: 'A2A',
      kind: 'request',
      text: 'Fix ready for approval: PR #467, 23/23 tests passing.',
    },
  ],
}

/**
 * The branch most support tickets actually take: Clara's answer is enough, so
 * Brain never wakes the engineering agents. Worth demoing - it shows the
 * orchestrator deciding, not just running a fixed pipeline.
 */
const APPROVAL_SCENARIO: DemoScenario = {
  id: 'approval-matrix',
  match: ['approval', 'approver', 'stuck', 'pending since', 'matrix', 'not routed', 'never received'],
  ticket: {
    reference: '1253',
    title: 'Purchase order stuck awaiting approval',
    customer: 'ABC Corp',
    priority: 'MEDIUM',
  },
  similarIssue: undefined,
  plan: ['understand', 'context'],
  clara: {
    expected: 'Orders above 50,00,000 need Category Head + Finance approval',
    customerConfig: {
      'Approval threshold': '50,00,000',
      'Required approvers': 'Category Head, Finance',
      'Raw Material -> Category Head': 'not mapped',
    },
    notes:
      'PO/8821 is 62,00,000 in Raw Material. No Category Head is mapped for that category, so the order parks instead of routing.',
  },
  configFix: {
    summary:
      'This is a configuration gap rather than a bug, so it can be fixed in your settings right now - no release needed.',
    change:
      'Settings -> Approval Matrix -> Raw Material: assign a Category Head. PO/8821 routes automatically once saved.',
    checks: [
      'Product context retrieved from Clara',
      'Configuration gap identified',
      'Fix available in your settings',
    ],
  },
  activity: [
    {
      afterStep: 'understand',
      from: 'procol-brain',
      to: 'clara',
      via: 'A2A',
      kind: 'request',
      text: 'Why would PO/8821 (62,00,000, Raw Material) not route to an approver for ABC Corp?',
    },
    {
      afterStep: 'context',
      from: 'clara',
      to: 'product-db',
      via: 'MCP',
      kind: 'tool',
      text: 'Read the approval matrix configured for ABC Corp',
      tool: { server: 'product-db', call: 'get_customer_config' },
    },
    {
      afterStep: 'context',
      from: 'clara',
      to: 'procol-brain',
      via: 'A2A',
      kind: 'response',
      text: 'Above 50,00,000 needs Category Head + Finance. No Category Head is mapped for Raw Material, so the PO parks.',
    },
    {
      afterStep: 'context',
      from: 'procol-brain',
      to: 'customer',
      via: 'A2A',
      kind: 'response',
      text: 'Configuration gap, not a defect - no engineering agents needed. Here is the fix.',
    },
  ],
}

/**
 * TEST CASE 2 - a generic SaaS company.
 *
 * Deliberately not a Procol issue. The pipeline, the protocol and the
 * approval gate are identical to the GST run above; the only difference is
 * that the knowledge hop goes to the customer's own knowledge agent instead
 * of to Clara, because Brain routes on declared capability, not on a name.
 */
const AUTH_SCENARIO: DemoScenario = {
  id: 'auth',
  match: ['401', 'unauthorized', 'unauthorised', 'log in', 'login', 'sign in', 'token', 'jwt', 'auth'],
  ticket: {
    reference: '7821',
    title: 'All users receiving 401 Unauthorized after deployment',
    customer: 'XYZ Corp',
    priority: 'HIGH',
  },
  similarIssue: {
    id: 'issue-382',
    reference: 'INC-382',
    title: 'Tenant-wide login failure after a release',
    customer: 'All tenants',
    solution: 'A deployment changed an authentication environment variable; the value was restored and asserted at boot.',
    confidence: 0.91,
  },
  clara: {
    expected: 'Tokens are issued with issuer auth.acmecloud.com',
    customerConfig: { Mechanism: 'JWT', Issuer: 'auth.acmecloud.com' },
    formula: 'token.issuer === JWT_ISSUER',
    notes: "Yesterday's release changed the JWT issuer configuration. Incident INC-382 had the same signature.",
  },
  dev: {
    rootCause:
      'The deployment set JWT_ISSUER to the API host, so every token failed the issuer check and the service returned 401.',
    filesChanged: ['deploy/production.yaml', 'services/auth/jwt.js'],
    pr: { number: 892, status: 'created', title: 'fix: restore JWT issuer configuration' },
  },
  qa: {
    status: 'passed',
    tests: 32,
    passed: 32,
    failed: 0,
    message: 'All authentication regression tests passed.',
  },
  approval: { approved: true, approver: 'Manager' },
  activity: [
    {
      afterStep: 'understand',
      from: 'procol-brain',
      to: 'company-knowledge',
      via: 'A2A',
      kind: 'request',
      text: "What changed in yesterday's deployment, and have we seen this before?",
    },
    {
      afterStep: 'context',
      from: 'company-knowledge',
      to: 'procol-brain',
      via: 'A2A',
      kind: 'response',
      text: 'Authentication uses JWT. The release changed the issuer configuration. Incident INC-382 was the same failure.',
    },
    {
      afterStep: 'context',
      from: 'procol-brain',
      to: 'dev-agent',
      via: 'A2A',
      kind: 'request',
      text: 'Investigate the 401s. Expected issuer is auth.acmecloud.com.',
    },
    {
      afterStep: 'code',
      from: 'dev-agent',
      to: 'github',
      via: 'MCP',
      kind: 'tool',
      text: 'Diffed deploy/production.yaml against the previous release, opened branch fix/jwt-issuer',
      tool: { server: 'github', call: 'read_file + create_branch' },
    },
    {
      afterStep: 'code',
      from: 'dev-agent',
      to: 'procol-brain',
      via: 'A2A',
      kind: 'response',
      text: 'Root cause found: JWT_ISSUER points at the API host instead of the auth host. PR #892 created.',
    },
    {
      afterStep: 'code',
      from: 'procol-brain',
      to: 'qa-agent',
      via: 'A2A',
      kind: 'request',
      text: 'Validate PR #892 against the authentication regression suite.',
    },
    {
      afterStep: 'validate',
      from: 'qa-agent',
      to: 'test-runner',
      via: 'MCP',
      kind: 'tool',
      text: 'Ran authentication regression suite',
      tool: { server: 'test-runner', call: 'run_tests' },
    },
    {
      afterStep: 'validate',
      from: 'qa-agent',
      to: 'procol-brain',
      via: 'A2A',
      kind: 'response',
      text: '32 / 32 tests passed. Login, refresh, expiry and multi-tenant all pass.',
    },
    {
      afterStep: 'validate',
      from: 'procol-brain',
      to: 'manager',
      via: 'A2A',
      kind: 'request',
      text: 'Fix ready for approval: PR #892, 32/32 tests passing.',
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

export const SCENARIOS: DemoScenario[] = [
  GST_SCENARIO,
  GRN_SCENARIO,
  AUCTION_SCENARIO,
  APPROVAL_SCENARIO,
  AUTH_SCENARIO,
]

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
