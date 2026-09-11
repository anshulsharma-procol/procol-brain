// Central mock data module. Ticket #1245 (Invoice GST calculation incorrect,
// ABC Corp) is defined once here and reused across Home, Ticket Detail, and
// Resolution so the demo tells one consistent story end to end.
import type { Agent, KnowledgeEntry, Ticket } from '../types'

export const primaryTicket: Ticket = {
  id: '1245',
  number: '#1245',
  title: 'Invoice GST calculation incorrect',
  description:
    'Invoice is showing wrong GST amount for ABC Corp tenants. Expected 18% but system calculated 12%.',
  customer: 'ABC Corp',
  status: 'AI Investigating',
  tableStatus: 'In Progress',
  priority: 'High',
  category: 'Billing & Invoicing',
  createdAt: 'Sep 10, 2025, 10:12 AM',
  reportedBy: 'John Doe (Finance Team)',
  impact: 'Affects all invoices',
  attachment: 'invoice_sample.pdf',
  issueQuote: [
    'Invoice showing wrong GST amount.',
    'For ABC Corp, GST should be 18% but the system is calculating 12% on the final invoice. This is causing incorrect billing for our customers.',
  ],
  progress: 70,
  currentAgentId: 'qa',
  currentAgentAction: 'Running tests',
  updated: '2 min ago',
  brainActivity: [
    {
      label: 'Ticket understood',
      detail: 'Identified as GST calculation issue',
      time: '10:12 AM',
      state: 'done',
    },
    {
      label: 'Clara consulted',
      detail: 'Fetching product context for ABC Corp',
      time: '10:13 AM',
      state: 'done',
    },
    {
      label: 'Product context retrieved',
      detail: 'GST = 18%, Discount = 10%',
      time: '10:13 AM',
      state: 'done',
    },
    {
      label: 'Assigned to Dev Agent',
      detail: 'Investigating code and root cause',
      time: '10:14 AM',
      state: 'done',
    },
    {
      label: 'PR being created...',
      detail: 'Generating fix for invoice calculation',
      time: '10:14 AM',
      state: 'active',
    },
    {
      label: 'QA Agent will validate',
      detail: 'Run regression tests',
      time: '',
      state: 'pending',
    },
    {
      label: 'Waiting for manager approval',
      detail: 'Review and merge PR',
      time: '',
      state: 'pending',
    },
  ],
  messages: [
    {
      fromId: 'brain',
      from: 'Brain',
      to: 'Clara',
      time: '10:12 AM',
      text: ['"What should GST be for ABC Corp?"'],
    },
    {
      fromId: 'clara',
      from: 'Clara',
      to: 'Brain',
      time: '10:13 AM',
      text: [
        '"Expected GST = 18%.',
        'ABC Corp is configured with:',
        '• GST = 18%',
        '• Discount = 10%',
        'Invoice calculation: Base - Discount + GST."',
      ],
    },
    {
      fromId: 'brain',
      from: 'Brain',
      to: 'Dev Agent',
      time: '10:14 AM',
      text: [
        '"Investigate invoice calculation. Tenant context might not be passed to GST calculator."',
      ],
    },
    {
      fromId: 'dev',
      from: 'Dev Agent',
      to: 'Brain',
      time: '10:14 AM',
      text: ['"Analyzing codebase... found potential issue in invoiceCalculator.ts"'],
    },
    {
      fromId: 'dev',
      from: 'Dev Agent',
      to: 'Brain',
      time: '',
      text: ['Creating fix and generating pull request...'],
      loading: true,
    },
  ],
  rootCause: {
    headline: 'Tenant context was not passed to GST calculator.',
    detail:
      'The GST calculation was using a default value instead of the tenant specific configuration, causing incorrect invoice amounts.',
  },
  fix: {
    prNumber: '#452',
    file: 'invoiceCalculator.ts',
    description: 'Pass tenant context to GST calculator and use customer-specific settings.',
    merged: true,
  },
  testResults: {
    suite: 'Invoice & Billing',
    total: 47,
    passed: 47,
    failed: 0,
  },
  timeline: [
    {
      label: 'Ticket created',
      detail: 'Customer reported the issue',
      time: 'Sep 10, 10:12 AM',
      state: 'done',
    },
    {
      label: 'Clara consulted',
      detail: 'Product context retrieved',
      time: '10:13 AM',
      state: 'done',
    },
    {
      label: 'Dev Agent',
      detail: 'Fix implemented (PR #452)',
      time: '10:18 AM',
      state: 'done',
    },
    {
      label: 'QA Agent',
      detail: 'All tests passed',
      time: '10:25 AM',
      state: 'done',
    },
    {
      label: 'Ready for approval',
      detail: 'Waiting for your review',
      time: '10:26 AM',
      state: 'current',
    },
  ],
}

// The other four tickets from the Home "Active AI Operations" table, now
// fully fleshed out so they can also appear in the Tickets grid + detail
// panel. Only #1245 has curated reference-image content; these are
// reasonable synthetic data following the same shape.
export const otherTickets: Ticket[] = [
  {
    id: '1242',
    number: '#1242',
    title: 'Purchase order failure',
    description: 'Purchase order approval fails validation for multi-currency vendors above $10k.',
    customer: 'Meridian Textiles',
    status: 'Dev Agent Investigating',
    tableStatus: 'In Progress',
    priority: 'Medium',
    category: 'Procurement',
    createdAt: 'Sep 10, 2025, 9:40 AM',
    reportedBy: 'Priya Nair (Procurement Team)',
    impact: 'Blocks PO approval for 3 vendors',
    attachment: 'po_error_log.txt',
    issueQuote: [
      'Purchase order approval keeps failing.',
      'Multi-currency vendor POs above $10k throw a validation error before reaching the approver.',
    ],
    progress: 45,
    currentAgentId: 'dev',
    currentAgentAction: 'Analyzing code',
    updated: '8 min ago',
    brainActivity: [
      { label: 'Ticket understood', detail: 'Identified as PO validation issue', time: '9:40 AM', state: 'done' },
      { label: 'Clara consulted', detail: 'Fetching procurement rules', time: '9:41 AM', state: 'done' },
      {
        label: 'Assigned to Dev Agent',
        detail: 'Investigating validation logic',
        time: '9:42 AM',
        state: 'active',
      },
      { label: 'QA Agent will validate', detail: 'Run regression tests', time: '', state: 'pending' },
      { label: 'Waiting for manager approval', detail: 'Review and merge PR', time: '', state: 'pending' },
    ],
    messages: [
      {
        fromId: 'brain',
        from: 'Brain',
        to: 'Dev Agent',
        time: '9:42 AM',
        text: ['"Investigate why multi-currency POs above $10k fail validation."'],
      },
      {
        fromId: 'dev',
        from: 'Dev Agent',
        to: 'Brain',
        time: '',
        text: ['Analyzing validation rules in poValidation.ts...'],
        loading: true,
      },
    ],
    rootCause: {
      headline: 'Currency conversion runs after the threshold check, not before.',
      detail: 'POs above $10k in a foreign currency are compared to the USD threshold before conversion, rejecting valid orders.',
    },
    fix: {
      prNumber: '#448',
      file: 'poValidation.ts',
      description: 'Convert to base currency before applying the approval threshold check.',
      merged: false,
    },
    testResults: { suite: 'Procurement', total: 32, passed: 0, failed: 0 },
    timeline: [
      { label: 'Ticket created', detail: 'Customer reported the issue', time: 'Sep 10, 9:40 AM', state: 'done' },
      { label: 'Clara consulted', detail: 'Procurement rules retrieved', time: '9:41 AM', state: 'done' },
      { label: 'Dev Agent', detail: 'Investigating root cause', time: '9:42 AM', state: 'current' },
    ],
  },
  {
    id: '1238',
    number: '#1238',
    title: 'Vendor onboarding',
    description: 'New vendor onboarding workflow needs a manager sign-off before it can go live.',
    customer: 'Northwind Logistics',
    status: 'Waiting for Approval',
    tableStatus: 'Pending',
    priority: 'Low',
    category: 'Vendor Management',
    createdAt: 'Sep 10, 2025, 9:16 AM',
    reportedBy: 'Aisha Khan (Vendor Ops)',
    impact: 'Delays onboarding for 1 new vendor',
    attachment: 'vendor_checklist.pdf',
    issueQuote: [
      'New vendor onboarding is stuck at the compliance step.',
      'Checklist looks complete, but the workflow needs a human sign-off to proceed.',
    ],
    progress: 90,
    currentAgentId: 'manager',
    currentAgentAction: 'Ready for review',
    updated: '12 min ago',
    brainActivity: [
      { label: 'Ticket understood', detail: 'Identified as onboarding sign-off', time: '9:16 AM', state: 'done' },
      { label: 'Clara consulted', detail: 'Checklist requirements confirmed', time: '9:20 AM', state: 'done' },
      { label: 'Compliance checks passed', detail: 'All documents verified', time: '9:35 AM', state: 'done' },
      {
        label: 'Waiting for manager approval',
        detail: 'Ready for your review',
        time: '9:40 AM',
        state: 'active',
      },
    ],
    messages: [
      {
        fromId: 'brain',
        from: 'Brain',
        to: 'Manager Agent',
        time: '9:40 AM',
        text: ['"Vendor checklist for Northwind Logistics is complete. Ready for sign-off."'],
      },
      {
        fromId: 'manager',
        from: 'Manager Agent',
        to: 'Brain',
        time: '',
        text: ['Reviewing checklist before sign-off...'],
        loading: true,
      },
    ],
    rootCause: {
      headline: 'No automated blocker — awaiting a required human sign-off.',
      detail: 'The onboarding workflow intentionally requires manager approval once all compliance checks pass.',
    },
    fix: {
      prNumber: '#—',
      file: 'n/a',
      description: 'No code change needed; awaiting manager approval to close out onboarding.',
      merged: false,
    },
    testResults: { suite: 'Vendor Onboarding', total: 12, passed: 12, failed: 0 },
    timeline: [
      { label: 'Ticket created', detail: 'Vendor Ops started onboarding', time: 'Sep 10, 9:16 AM', state: 'done' },
      { label: 'Clara consulted', detail: 'Checklist requirements retrieved', time: '9:20 AM', state: 'done' },
      { label: 'Compliance checks passed', detail: 'All documents verified', time: '9:35 AM', state: 'done' },
      { label: 'Ready for approval', detail: 'Waiting for your review', time: '9:40 AM', state: 'current' },
    ],
  },
  {
    id: '1231',
    number: '#1231',
    title: 'Login issue for tenant',
    description: 'Users at one tenant are intermittently unable to log in after the last SSO update.',
    customer: 'Kestrel Analytics',
    status: 'Clara Fetching Context',
    tableStatus: 'In Progress',
    priority: 'High',
    category: 'Authentication',
    createdAt: 'Sep 10, 2025, 9:06 AM',
    reportedBy: 'Marcus Lee (IT Admin)',
    impact: 'Affects ~15% of tenant logins',
    attachment: 'sso_error_screenshot.png',
    issueQuote: [
      'Some users can\'t log in since yesterday.',
      'It seems intermittent — a few users report being redirected back to the login page after SSO.',
    ],
    progress: 60,
    currentAgentId: 'clara',
    currentAgentAction: 'Fetching context',
    updated: '18 min ago',
    brainActivity: [
      { label: 'Ticket understood', detail: 'Identified as intermittent SSO failure', time: '9:06 AM', state: 'done' },
      { label: 'Clara consulted', detail: 'Fetching tenant SSO configuration', time: '9:08 AM', state: 'active' },
      { label: 'Assigned to Dev Agent', detail: 'Investigate SSO session handling', time: '', state: 'pending' },
      { label: 'QA Agent will validate', detail: 'Run regression tests', time: '', state: 'pending' },
      { label: 'Waiting for manager approval', detail: 'Review and merge PR', time: '', state: 'pending' },
    ],
    messages: [
      {
        fromId: 'brain',
        from: 'Brain',
        to: 'Clara',
        time: '9:08 AM',
        text: ['"What SSO provider and session settings does Kestrel Analytics use?"'],
      },
      {
        fromId: 'clara',
        from: 'Clara',
        to: 'Brain',
        time: '',
        text: ['Fetching tenant SSO configuration...'],
        loading: true,
      },
    ],
    rootCause: {
      headline: 'Root cause not yet identified — investigation in progress.',
      detail: 'Clara is retrieving the tenant\'s SSO configuration before Dev Agent investigates session handling.',
    },
    fix: {
      prNumber: '#—',
      file: 'n/a',
      description: 'Fix pending root cause investigation.',
      merged: false,
    },
    testResults: { suite: 'Authentication', total: 0, passed: 0, failed: 0 },
    timeline: [
      { label: 'Ticket created', detail: 'IT Admin reported the issue', time: 'Sep 10, 9:06 AM', state: 'done' },
      { label: 'Clara consulted', detail: 'Fetching SSO configuration', time: '9:08 AM', state: 'current' },
    ],
  },
  {
    id: '1228',
    number: '#1228',
    title: 'Report download error',
    description: 'Exporting the monthly spend report as PDF fails for large date ranges.',
    customer: 'Solace Manufacturing',
    status: 'Dev Agent Investigating',
    tableStatus: 'In Progress',
    priority: 'Medium',
    category: 'Reporting',
    createdAt: 'Sep 10, 2025, 8:59 AM',
    reportedBy: 'Elena Ruiz (Finance Team)',
    impact: 'Blocks month-end report exports',
    attachment: 'report_export_error.png',
    issueQuote: [
      'Report download fails for the full quarter.',
      'Exporting a single month works fine, but selecting a full quarter times out.',
    ],
    progress: 30,
    currentAgentId: 'dev',
    currentAgentAction: 'Investigating',
    updated: '25 min ago',
    brainActivity: [
      { label: 'Ticket understood', detail: 'Identified as export timeout', time: '8:59 AM', state: 'done' },
      { label: 'Assigned to Dev Agent', detail: 'Investigating report generation', time: '9:02 AM', state: 'active' },
      { label: 'QA Agent will validate', detail: 'Run regression tests', time: '', state: 'pending' },
      { label: 'Waiting for manager approval', detail: 'Review and merge PR', time: '', state: 'pending' },
    ],
    messages: [
      {
        fromId: 'brain',
        from: 'Brain',
        to: 'Dev Agent',
        time: '9:02 AM',
        text: ['"Investigate why quarterly report exports time out."'],
      },
      {
        fromId: 'dev',
        from: 'Dev Agent',
        to: 'Brain',
        time: '',
        text: ['Profiling report generation for large date ranges...'],
        loading: true,
      },
    ],
    rootCause: {
      headline: 'Report query is not paginated for large date ranges.',
      detail: 'Quarterly exports load every line item into memory at once, causing a timeout before the PDF is generated.',
    },
    fix: {
      prNumber: '#455',
      file: 'reportExport.ts',
      description: 'Paginate the report query and stream rows into the PDF generator.',
      merged: false,
    },
    testResults: { suite: 'Reporting', total: 18, passed: 0, failed: 0 },
    timeline: [
      { label: 'Ticket created', detail: 'Finance Team reported the issue', time: 'Sep 10, 8:59 AM', state: 'done' },
      { label: 'Dev Agent', detail: 'Investigating root cause', time: '9:02 AM', state: 'current' },
    ],
  },
]

export const allTickets: Ticket[] = [primaryTicket, ...otherTickets]

export const homeStats = {
  totalTickets: { value: 24, change: '+12%', caption: '+3 from last week' },
  aiWorking: { value: 7, change: '+40%', caption: 'Agents actively working' },
  needApproval: { value: 3, change: '+50%', caption: 'Waiting for human review' },
  resolved: { value: 14, change: '+27%', caption: 'This week' },
}

export const ticketStatusChart = [
  { name: 'New', value: 8, color: '#3b82f6' },
  { name: 'In Progress', value: 7, color: '#7c3aed' },
  { name: 'Waiting Approval', value: 3, color: '#f59e0b' },
  { name: 'Resolved', value: 14, color: '#16a34a' },
]

export const agentActivityChart = [
  { name: 'Clara', value: 8, color: '#7c3aed' },
  { name: 'Dev Agent', value: 7, color: '#3b82f6' },
  { name: 'QA Agent', value: 6, color: '#16a34a' },
  { name: 'Manager', value: 3, color: '#f59e0b' },
]

export const agents: Agent[] = [
  {
    id: 'clara',
    name: 'Clara',
    shortLabel: 'CL',
    role: 'Product Knowledge',
    description: 'Provides product context, customer configuration and business rules.',
    connected: true,
    color: 'violet',
    capabilities: [
      'Provide product context',
      'Explain customer configuration',
      'Answer business rule questions',
      'Reference product documentation',
      'Support other agents with context',
    ],
    protocol: {
      name: 'MCP',
      description: 'Shares product knowledge and context using the Model Context Protocol (MCP).',
    },
    tools: [
      {
        name: 'Knowledge Base via MCP',
        description: 'Reads product docs, customer configs and business rules using MCP resources.',
      },
    ],
    sampleInteraction: [
      { from: 'Brain → Clara', text: '"What should GST be for ABC Corp?"' },
      {
        from: 'Clara → Brain',
        text: '"Expected GST = 18%. ABC Corp is configured with GST = 18%, Discount = 10%."',
      },
    ],
  },
  {
    id: 'dev',
    name: 'Development Agent',
    shortLabel: 'DEV',
    role: 'Code Investigation + PR',
    description: 'Analyzes code, identifies root cause and creates pull requests for the identified issues.',
    connected: true,
    color: 'blue',
    capabilities: [
      'Analyze code and understand issues',
      'Identify root cause',
      'Implement fix',
      'Create pull request',
      'Provide technical explanation',
    ],
    protocol: {
      name: 'A2A',
      description: 'Communicates with other agents using Agent-to-Agent (A2A) protocol.',
    },
    tools: [
      {
        name: 'GitHub via MCP',
        description: 'Creates branches, commits and pull requests using GitHub MCP.',
      },
    ],
    sampleInteraction: [
      { from: 'Brain → Dev Agent', text: '"Investigate invoice calculation issue for ticket #1245."' },
      {
        from: 'Dev Agent → Brain',
        text: '"Found the root cause. Tenant context was not passed to GST calculator. Created PR #452 with the fix."',
      },
    ],
  },
  {
    id: 'qa',
    name: 'QA Agent',
    shortLabel: 'QA',
    role: 'Testing + Validation',
    description: 'Runs tests, validates fixes and ensures quality.',
    connected: true,
    color: 'green',
    capabilities: [
      'Run automated test suites',
      'Validate fixes against regressions',
      'Generate test reports',
      'Flag failing tests',
      'Sign off for manager review',
    ],
    protocol: {
      name: 'A2A',
      description: 'Communicates with other agents using Agent-to-Agent (A2A) protocol.',
    },
    tools: [
      {
        name: 'Test Runner via MCP',
        description: 'Executes regression suites and reports pass/fail results using MCP.',
      },
    ],
    sampleInteraction: [
      { from: 'Dev Agent → QA Agent', text: '"PR #452 is ready for testing."' },
      { from: 'QA Agent → Brain', text: '"Ran 47 regression tests for Invoice & Billing. All 47 passed."' },
    ],
  },
  {
    id: 'manager',
    name: 'Manager Agent',
    shortLabel: 'MGR',
    role: 'Approval & Monitoring',
    description: 'Reviews changes, approves fixes and notifies customers.',
    connected: false,
    color: 'amber',
    capabilities: [
      'Review proposed fixes',
      'Approve or reject changes',
      'Notify customers of resolution',
      'Monitor agent activity',
      'Escalate high-risk changes',
    ],
    protocol: {
      name: 'A2A',
      description: 'Communicates with other agents using Agent-to-Agent (A2A) protocol.',
    },
    tools: [
      {
        name: 'Notifications via MCP',
        description: 'Sends customer and internal notifications once a fix is approved.',
      },
    ],
    sampleInteraction: [
      { from: 'QA Agent → Manager Agent', text: '"PR #452 passed all 47 tests. Ready for your review."' },
      { from: 'Manager Agent → Brain', text: '"Reviewing now. Will approve or request changes shortly."' },
    ],
  },
]

export const knowledgeEntries: KnowledgeEntry[] = [
  {
    id: 'gst-configuration',
    title: 'GST Configuration',
    description: 'Tax configuration and calculation rules by tenant',
    type: 'Customer Config',
    updatedAt: 'Sep 10, 2025',
    usedBy: ['clara', 'dev'],
    version: 'v1.2',
    content: [
      {
        heading: 'GST Configuration Rules',
        bullets: [
          'Default GST rate: 18%',
          'Calculation: (Base Amount - Discount) + GST',
          'Tenant specific rates can be configured',
          'Applies to all invoice types',
        ],
      },
      {
        heading: 'ABC Corp Configuration',
        bullets: ['GST Rate: 18%', 'Discount: 10%', 'Currency: INR', 'Region: India'],
      },
    ],
    relatedTickets: [
      { number: '#1245', title: 'Invoice GST calculation incorrect', status: 'Resolved', date: 'Sep 10, 2025' },
      { number: '#1189', title: 'GST not applied for ABC Corp', status: 'Resolved', date: 'Aug 21, 2025' },
    ],
  },
  {
    id: 'invoice-process',
    title: 'Invoice Process',
    description: 'End-to-end invoice generation flow',
    type: 'Product Doc',
    updatedAt: 'Sep 8, 2025',
    usedBy: ['clara'],
    version: 'v2.0',
    content: [
      {
        heading: 'Invoice Generation Flow',
        bullets: [
          'Order confirmed and line items locked',
          'Discounts applied per tenant configuration',
          'GST calculated from tenant tax settings',
          'Invoice PDF generated and sent to customer',
        ],
      },
    ],
    relatedTickets: [
      { number: '#1245', title: 'Invoice GST calculation incorrect', status: 'Resolved', date: 'Sep 10, 2025' },
    ],
  },
  {
    id: 'abc-corp-tenant-settings',
    title: 'ABC Corp - Tenant Settings',
    description: 'Customer specific configuration',
    type: 'Customer Config',
    updatedAt: 'Sep 5, 2025',
    usedBy: ['clara', 'dev'],
    version: 'v1.4',
    content: [
      {
        heading: 'Tenant Settings',
        bullets: ['Region: India', 'Currency: INR', 'GST Rate: 18%', 'Discount: 10%'],
      },
    ],
    relatedTickets: [
      { number: '#1245', title: 'Invoice GST calculation incorrect', status: 'Resolved', date: 'Sep 10, 2025' },
    ],
  },
  {
    id: 'discount-rules',
    title: 'Discount Rules',
    description: 'Discount and pricing rules',
    type: 'Business Rule',
    updatedAt: 'Sep 1, 2025',
    usedBy: ['clara'],
    version: 'v1.1',
    content: [
      {
        heading: 'Discount Rules',
        bullets: [
          'Standard discount tiers apply per contract',
          'Tenant-specific overrides take precedence',
          'Discount is applied before GST calculation',
        ],
      },
    ],
    relatedTickets: [],
  },
  {
    id: 'common-invoice-issues',
    title: 'Common Invoice Issues',
    description: 'Known issues and resolutions',
    type: 'FAQ',
    updatedAt: 'Aug 28, 2025',
    usedBy: ['clara', 'dev', 'qa'],
    version: 'v3.0',
    content: [
      {
        heading: 'Frequently Seen Issues',
        bullets: [
          'GST mismatch when tenant context is missing',
          'Rounding differences on multi-currency invoices',
          'Discount not applied on renewal invoices',
        ],
      },
    ],
    relatedTickets: [
      { number: '#1245', title: 'Invoice GST calculation incorrect', status: 'Resolved', date: 'Sep 10, 2025' },
      { number: '#1189', title: 'GST not applied for ABC Corp', status: 'Resolved', date: 'Aug 21, 2025' },
    ],
  },
  {
    id: 'product-architecture',
    title: 'Product Architecture',
    description: 'System overview and architecture',
    type: 'Product Doc',
    updatedAt: 'Aug 20, 2025',
    usedBy: ['clara', 'dev', 'qa', 'manager'],
    version: 'v4.1',
    content: [
      {
        heading: 'System Overview',
        bullets: [
          'Brain orchestrates Clara, Dev Agent, QA Agent and Manager Agent',
          'Agents communicate over the A2A protocol',
          'Product and customer knowledge is served over MCP',
        ],
      },
    ],
    relatedTickets: [],
  },
]

export function getAgentById(id: string): Agent | undefined {
  return agents.find((agent) => agent.id === id)
}
