import type {
  ConfigFixData,
  ImpactData,
  PrData,
  RootCauseData,
  TestResultData,
} from '../contract.js'
import type {
  ArtifactKind,
  Category,
  ResolutionPath,
  StageId,
  TicketChannel,
  TicketPriority,
} from './types.js'

/**
 * ============================================================================
 *  PLAYBOOKS — the cases this deployment knows how to run
 * ============================================================================
 *
 * A playbook is what a real Brain would *derive* (an LLM classification, a
 * knowledge lookup, a repository read); here it is written down. Everything
 * around it is real: real HTTP, real A2A envelopes, real agent services, real
 * timing, real state transitions, real SSE.
 *
 * That is the trade this build makes deliberately. The orchestration is the
 * product and it is genuine; the *answers* are scripted, so a demo cannot be
 * broken by a model having an off day or by conference wifi.
 *
 * Adding a case is a new entry in `PLAYBOOKS` and nothing else. When the LLM
 * and the connectors land, `brain/classify.ts` and the agent handlers start
 * producing these fields instead of reading them, and no route changes.
 */

export interface PlaybookMatch {
  /** Lowercase substrings. Each hit scores 1; `strong` terms score 3. */
  terms: string[]
  strong?: string[]
  /** Customer phrases that should never route here even if a term matches. */
  veto?: string[]
}

export interface Playbook {
  id: string
  workspaceId: string
  match: PlaybookMatch

  ticket: {
    title: string
    /** Used when the customer's own words are all we have. */
    description: string
    /** The contract's coarse enum. */
    category: Category
    /** Additive: what a person would call it. The enum has four values. */
    categoryLabel: string
    priority: TicketPriority
    impact: string
    channel?: TicketChannel
    defaultCustomer: string
    reportedBy?: string
  }

  path: ResolutionPath
  /** Omit for all four. A configuration fix needs only context + approve. */
  stages?: StageId[]
  approvalPolicyId?: string

  /** What Brain says, in first person, at each transition. */
  narration: {
    received: string[]
    routing: string[]
    decision: string[]
    gate: string[]
  }

  /** The knowledge agent's answer. `isProductDefect` drives the branch. */
  knowledge: {
    summary: string
    detail: string[]
    logs: string[]
    durationMs: number
    result: Record<string, unknown>
    citations: string[]
  }

  /** The engineering agent's answer. Absent on paths that skip it. */
  engineering?: {
    summary: string
    detail: string[]
    logs: string[]
    durationMs: number
    confidence: number
    tool: { server: string; call: string }
    /**
     * The contract's ROOT_CAUSE payload, plus `evidence`.
     *
     * `attempt` is not here: it belongs to the run, not to the script, so the
     * agent stamps it from the task context. A scripted 1 would be a lie the
     * second time round the dev↔QA loop.
     */
    rootCause: Omit<RootCauseData, 'attempt'> & { evidence: string[] }
    /** The contract's PR payload, plus the diff stat the UI puts on the header. */
    pr: Omit<PrData, 'real'> & { additions: number; deletions: number }
  }

  /** The validation agent's answer. */
  validation?: {
    summary: string
    detail: string[]
    logs: string[]
    durationMs: number
    tool: { server: string; call: string }
    /** The contract's TEST_RESULT payload, plus the named cases. */
    result: Omit<TestResultData, 'branch' | 'attempt' | 'durationMs'> & { cases: string[] }
  }

  /** Blast radius, when the analytics copilot has something to say. */
  impact?: ImpactData & {
    summary: string
    detail: string[]
    logs: string[]
    durationMs: number
    /** What one record is called here — "invoices", "sessions". */
    recordLabel: string
  }

  /**
   * The remediation Brain drafts when the product is behaving correctly.
   *
   * `requiresCodeChange` and `customer` are filled in by the run: the first
   * is what this branch means, the second is on the ticket.
   */
  configFix?: Omit<ConfigFixData, 'requiresCodeChange' | 'customer'> & {
    /** Additive: the system the change is made in, and what it changes. */
    system: string
    change: string
  }

  /** The answer Brain gives when the customer only needs information. */
  answer?: {
    summary: string
    detail: string[]
  }

  reply: {
    subject: string
    body: string[]
    /** What the answer rests on. Shown under the draft at the gate. */
    citations: string[]
  }

  memory: {
    title: string
    symptom: string
    rootCause: string
    resolution: string
    tags: string[]
    minutesSavedPerReuse: number
    relatedKnowledgeIds: string[]
  }
}

/** Artifacts a path is expected to produce, used by the policy lookup. */
export const PATH_ARTIFACTS: Record<ResolutionPath, ArtifactKind[]> = {
  CODE_FIX: ['ROOT_CAUSE', 'PR', 'TEST_RESULT', 'CUSTOMER_REPLY'],
  CONFIG_FIX: ['CONFIG_FIX', 'CUSTOMER_REPLY'],
  ANSWER_ONLY: ['CUSTOMER_REPLY'],
  PROCESS: ['PROCESS_RESULT'],
}

// ---------------------------------------------------------------------------
// CASE 1 — Procol · invoice tax defect · the full loop
// ---------------------------------------------------------------------------

const INVOICE_TAX: Playbook = {
  id: 'invoice-tax',
  workspaceId: 'procol',
  match: {
    strong: ['gst', 'tax'],
    terms: ['invoice', '18%', '12%', 'billing', 'calculat', 'payment run', 'po '],
  },
  ticket: {
    title: 'Invoice GST calculation incorrect',
    description: 'Invoices are being billed at the platform default tax rate instead of the tenant’s configured rate.',
    category: 'BUG',
    categoryLabel: 'Billing & invoicing',
    priority: 'HIGH',
    impact: 'Every purchase order raised this month',
    defaultCustomer: 'ABC Corp',
    reportedBy: 'Finance team',
  },
  path: 'CODE_FIX',
  approvalPolicyId: 'code-billing',

  narration: {
    received: [
      'Classified as a billing defect, high priority. I do not have this tenant’s tax configuration, so I need product context before anyone touches code.',
    ],
    routing: [
      'I am not calling Clara because I know Clara exists. I am asking the registry who declares product_knowledge — in this workspace, that is Clara.',
    ],
    decision: [
      'The tenant is configured correctly and the defect is in product behaviour, so I am routing to engineering. If the configuration had been wrong I would have stopped here and drafted a remediation instead.',
    ],
    gate: [
      'Code changes to billing always require human approval. I have a root cause, a pull request, a passing suite and a blast radius — the decision is yours.',
    ],
  },

  knowledge: {
    summary: 'Expected GST 18%, discount 10%, formula base − discount + gst',
    detail: [
      'The tenant is configured correctly for intra-state GST at 18%. The billed rate does not match the configured rate, so this is a product defect rather than a tenant misconfiguration.',
    ],
    logs: ['matched 2 knowledge documents', 'read billing-config.md#gst', 'read tenant settings v1.4'],
    durationMs: 820,
    result: {
      expectedGst: 18,
      discount: 10,
      formula: 'base - discount + gst',
      configNotes: 'Tenant configured for intra-state GST at 18%.',
      isProductDefect: true,
      remediation: null,
    },
    citations: ['billing-config.md#gst'],
  },

  engineering: {
    summary: 'Root cause: tenant context never reaches the GST calculator',
    detail: [
      'calculateInvoice() reads the module-level DEFAULT_GST_RATE constant instead of the tenant’s configured rate, so every tenant is billed at the 12% default regardless of their settings.',
    ],
    logs: [
      'indexed 3 files in src/billing',
      'located calculateInvoice() in invoiceCalculator.js:7',
      'confirmed customerConfig.js holds gstPercent: 18 for this tenant',
      'opened PR #452 against main',
    ],
    durationMs: 4180,
    confidence: 0.94,
    tool: { server: 'github', call: 'read_file + create_branch + create_pr' },
    rootCause: {
      rootCause:
        'calculateInvoice() applies the module-level DEFAULT_GST_RATE constant instead of the tenant’s configured gstPercent, so every tenant falls back to the default 12% slab regardless of their settings.',
      file: 'src/invoiceCalculator.js',
      confidence: 0.94,
      evidence: [
        'src/invoiceCalculator.js:7 — const gst = taxable * (DEFAULT_GST_RATE / 100)',
        'src/customerConfig.js — ABC Corp: { gstPercent: 18, discountPercent: 10 }',
        'tenantConfig is accepted as a parameter but only read for the discount',
      ],
    },
    pr: {
      number: 452,
      title: 'Use the tenant’s configured GST rate in calculateInvoice',
      url: 'https://github.com/procol-hack/demo-repo/pull/452',
      branch: 'fix/gst-tenant-rate',
      body: 'calculateInvoice() ignored tenantConfig.gstPercent and always applied DEFAULT_GST_RATE. This reads the tenant’s rate and falls back to the default only when it is unset.',
      state: 'mock',
      filesChanged: ['src/invoiceCalculator.js'],
      additions: 7,
      deletions: 3,
      diff: [
        '--- a/src/invoiceCalculator.js',
        '+++ b/src/invoiceCalculator.js',
        '@@ -4,7 +4,8 @@ function calculateInvoice(lineItems, tenantConfig) {',
        '   const taxable = base - discount;',
        '-  const gst = taxable * (DEFAULT_GST_RATE / 100);',
        '+  const rate = tenantConfig?.gstPercent ?? DEFAULT_GST_RATE;',
        '+  const gst = taxable * (rate / 100);',
        '   return { base, discount, taxable, gst, total: taxable + gst };',
      ].join('\n'),
    },
  },

  validation: {
    summary: '47 of 47 tests passed',
    detail: ['The invoice, tax and discount suites all pass against the patched branch.'],
    logs: [
      'checked out fix/gst-tenant-rate',
      'ran 47 assertions across 3 suites',
      'no regressions in discount or rounding',
    ],
    durationMs: 1830,
    tool: { server: 'test-runner', call: 'run_tests' },
    result: {
      status: 'passed',
      suites: ['invoice', 'tax', 'discount'],
      total: 47,
      passed: 47,
      failed: 0,
      failures: [],
      message: '47 of 47 passed across invoice, tax and discount.',
      cases: [
        'GST applied at the tenant’s configured rate',
        'Discount applied before tax',
        'Default rate used when the tenant has no override',
        'Multi-currency rounding unchanged',
        'Credit notes unchanged',
      ],
    },
  },

  impact: {
    summary: '14 tenants and 312 invoices carry the same defect',
    detail: [
      'Every tenant whose configured GST rate differs from the default has been billed at 12% since 2 March. A support tool would have closed this ticket; the other thirteen customers would have found out on their own.',
    ],
    logs: [
      'compiled canonical query against procurement-db',
      'scanned invoices since 2026-03-02',
      'grouped by tenant — 14 affected',
    ],
    durationMs: 760,
    affectedTenants: 14,
    affectedRecords: 312,
    recordLabel: 'invoices',
    firstSeen: '2 March',
    trend: [
      { date: '2 Mar', count: 18 },
      { date: '9 Mar', count: 46 },
      { date: '16 Mar', count: 83 },
      { date: '23 Mar', count: 71 },
      { date: '30 Mar', count: 94 },
    ],
    source: 'procurement-db',
    sql: [
      'SELECT COUNT(DISTINCT i.tenant_id) AS tenants,',
      '       COUNT(*)                    AS invoices',
      'FROM invoices i',
      'JOIN tenant_config c ON c.tenant_id = i.tenant_id',
      "WHERE i.issued_at >= '2026-03-02'",
      '  AND i.gst_rate <> c.gst_percent;',
    ].join('\n'),
  },

  reply: {
    subject: 'Invoice GST issue resolved',
    body: [
      'We have identified and fixed the issue causing GST to be billed at 12% instead of your configured 18%. The calculation was falling back to a default rate instead of reading your tenant configuration.',
      'The fix has passed our full invoice regression suite and has been approved for release. Your affected invoices are being re-issued — you do not need to raise them again.',
      'If anything still looks wrong on your next invoice, reply to this ticket and it will come straight back to us.',
    ],
    citations: ['PR #452', 'Invoice regression suite — 47/47', 'Tenant configuration · ABC Corp'],
  },

  memory: {
    title: 'Tenant tax configuration not read by the invoice calculator',
    symptom: 'Invoice tax billed at the platform default instead of the tenant’s configured rate',
    rootCause:
      'calculateInvoice() used the module-level DEFAULT_GST_RATE constant instead of tenantConfig.gstPercent.',
    resolution:
      'Read the rate from the tenant configuration and fall back to the default only when it is absent. PR #452.',
    tags: ['gst', 'tax', 'invoice', 'billing', 'tenant-config', 'calculation', 'rate'],
    minutesSavedPerReuse: 190,
    relatedKnowledgeIds: ['gst-configuration', 'invoice-process'],
  },
}

// ---------------------------------------------------------------------------
// CASE 2 — Procol · vendor cannot see an auction · the Brain decides
// ---------------------------------------------------------------------------

const VENDOR_ACCESS: Playbook = {
  id: 'vendor-access',
  workspaceId: 'procol',
  match: {
    strong: ['auction'],
    terms: ['vendor', 'invited', 'invite', 'dashboard', 'cannot see', 'not visible', 'bidding', 'participant'],
  },
  ticket: {
    title: 'Vendor cannot see the auction',
    description: 'An invited vendor reports that the auction does not appear in their dashboard.',
    category: 'CONFIG',
    categoryLabel: 'Auctions',
    priority: 'MEDIUM',
    impact: 'One auction, closing this week',
    defaultCustomer: 'XYZ Metals',
    reportedBy: 'Sourcing team',
  },
  path: 'CONFIG_FIX',
  stages: ['context', 'approve'],
  approvalPolicyId: 'config-change',

  narration: {
    received: [
      'Classified as an auction visibility issue, medium priority. Before I wake engineering I want to know whether the vendor was actually added to the invited list.',
    ],
    routing: ['Asking whoever declares product_knowledge in this workspace.'],
    decision: [
      'The product is behaving as designed, so there is nothing for the development or QA agents to do. I am drafting the remediation and the customer reply instead. Restraint is the decision here.',
    ],
    gate: [
      'Configuration changes to a live tenant require human approval. One step, no code, no tests — and the same gate.',
    ],
  },

  knowledge: {
    summary: 'The vendor was never added to the auction’s invited list',
    detail: [
      'Auction visibility is driven by the participant list. The vendor exists on this tenant but is not a participant on the auction, so the dashboard is behaving correctly. This is a configuration gap, not a product defect.',
    ],
    logs: [
      'matched 1 knowledge document',
      'read auctions.md#participants',
      'checked participant list — 4 vendors, the named vendor absent',
    ],
    durationMs: 690,
    result: {
      isProductDefect: false,
      remediation: 'Add the vendor under Auction → Participants. No code change required.',
      configNotes: 'Visibility is driven by the participant list, not by vendor registration.',
    },
    citations: ['auctions.md#participants'],
  },

  configFix: {
    title: 'Add the vendor to the auction participant list.',
    system: 'Procol sourcing console',
    change: 'Auction → Participants → add the invited vendor',
    steps: [
      'Open the auction in the sourcing console',
      'Go to Participants and add the vendor',
      'Confirm the invitation email is queued to their registered contact',
      'The auction appears on their dashboard within one minute',
    ],
    rationale:
      'Auction visibility is driven by the participant list, not by vendor registration. The vendor is registered and active, so nothing in the product is behaving incorrectly — they were simply never invited to this auction.',
    citations: ['auctions.md#participants'],
  },

  reply: {
    subject: 'Vendor auction visibility',
    body: [
      'The vendor was not on the invited participant list for this auction, which is why nothing appeared on their dashboard.',
      'We have added them under Auction → Participants and their invitation is on its way. The auction will show on their dashboard within a minute of them signing in.',
      'No product change was needed here, so nothing else on your account is affected.',
    ],
    citations: ['auctions.md#participants', 'Vendor record · active on this tenant'],
  },

  memory: {
    title: 'Auction invisible to a vendor that is not on the participant list',
    symptom: 'An invited vendor reports that an auction does not appear on their dashboard',
    rootCause:
      'Auction visibility is driven by the participant list; the vendor existed on the tenant but was never added as a participant.',
    resolution: 'Add the vendor under Auction → Participants. No code change required.',
    tags: ['auction', 'vendor', 'visibility', 'participants', 'invite', 'dashboard', 'access'],
    minutesSavedPerReuse: 55,
    relatedKnowledgeIds: ['auction-participants'],
  },
}

// ---------------------------------------------------------------------------
// CASE 3 — AcmeCloud · tenant-wide 401s · a different company, same Brain
// ---------------------------------------------------------------------------

const AUTH_401: Playbook = {
  id: 'auth-401',
  workspaceId: 'acmecloud',
  match: {
    strong: ['401', 'unauthorized', 'unauthorised', 'jwt'],
    terms: ['log in', 'login', 'sign in', 'token', 'auth', 'deployment', 'deploy', 'session'],
  },
  ticket: {
    title: 'All users receiving 401 Unauthorized after deployment',
    description: 'Every user on the tenant is rejected at login with 401 Unauthorized since the last deployment.',
    category: 'BUG',
    categoryLabel: 'Authentication',
    priority: 'CRITICAL',
    impact: 'All users on the tenant — complete login outage',
    defaultCustomer: 'XYZ Corp',
    reportedBy: 'IT Operations',
  },
  path: 'CODE_FIX',
  approvalPolicyId: 'production-auth',

  narration: {
    received: [
      'Classified as an authentication failure, critical, tenant-wide. A total login outage that began after a deployment is almost never a customer configuration problem, but I am not going to assume that — I need the deployment history first.',
    ],
    routing: [
      'This workspace has no Clara. It declares an agent with product_knowledge and incident_history — the customer’s own Company Knowledge Agent. I route to the capability, so nothing about this run is different.',
    ],
    decision: [
      'The tenant is configured correctly and the regression came from our own release, so this goes to engineering. Same decision rule as every other workspace.',
    ],
    gate: [
      'Changes to authentication in production always require human approval. Root cause, pull request and a passing suite are attached — the decision is yours.',
    ],
  },

  knowledge: {
    summary: 'Authentication uses JWT; the last release changed the issuer configuration',
    detail: [
      'The authentication service validates JWTs against a configured issuer. Release 2026.09.10 altered the JWT_ISSUER environment variable. Incident INC-382 had the same signature in January and was also an issuer mismatch.',
    ],
    logs: [
      'searched internal documentation — 3 matches',
      'read auth-service runbook §4 (token validation)',
      'read release notes 2026.09.10',
      'matched previous incident INC-382',
    ],
    durationMs: 940,
    result: {
      authMechanism: 'JWT',
      expectedIssuer: 'auth.acmecloud.com',
      changedIn: 'release 2026.09.10',
      isProductDefect: true,
      priorIncidents: ['INC-382'],
    },
    citations: ['auth-service-runbook.md#token-validation', 'release-notes-2026-09-10.md'],
  },

  engineering: {
    summary: 'Root cause: JWT_ISSUER was set to the API host instead of the auth host',
    detail: [
      'The deployment manifest sets JWT_ISSUER to api.acmecloud.com. Tokens are minted with issuer auth.acmecloud.com, so every token fails the issuer check and the service returns 401 — correctly, against the wrong expectation.',
    ],
    logs: [
      'indexed 4 files in services/auth',
      'diffed deploy/production.yaml against the previous release',
      'located verifyToken() in services/auth/jwt.js:34',
      'opened PR #892 against main',
    ],
    durationMs: 3960,
    confidence: 0.97,
    tool: { server: 'github', call: 'read_file + create_branch + create_pr' },
    rootCause: {
      rootCause:
        'JWT_ISSUER was changed to the API host during deployment. Tokens are minted with issuer auth.acmecloud.com, but the deployed auth service validates against api.acmecloud.com — every token fails the issuer check, so the service returns 401 for every user on every tenant.',
      file: 'deploy/production.yaml',
      confidence: 0.97,
      evidence: [
        'deploy/production.yaml — JWT_ISSUER: api.acmecloud.com',
        'services/auth/jwt.js:34 — issuer compared strictly against process.env.JWT_ISSUER',
        'Incident INC-382 (January) — identical signature, identical cause',
      ],
    },
    pr: {
      number: 892,
      title: 'Fix JWT issuer configuration',
      url: 'https://github.com/acmecloud/platform/pull/892',
      branch: 'fix/jwt-issuer',
      body: 'The deployed auth service validated tokens against api.acmecloud.com while they are minted with auth.acmecloud.com. This restores the issuer and fails loudly at boot when it is unset, so the same deployment cannot silently 401 every user again.',
      state: 'mock',
      filesChanged: ['deploy/production.yaml', 'services/auth/jwt.js'],
      additions: 6,
      deletions: 2,
      diff: [
        '--- a/deploy/production.yaml',
        '+++ b/deploy/production.yaml',
        '@@ -18,7 +18,7 @@ services:',
        '   env:',
        '-    JWT_ISSUER: api.acmecloud.com',
        '+    JWT_ISSUER: auth.acmecloud.com',
        '',
        '--- a/services/auth/jwt.js',
        '+++ b/services/auth/jwt.js',
        '@@ -32,6 +32,7 @@ export function verifyToken(token) {',
        '+  assertIssuerConfigured(process.env.JWT_ISSUER);',
        '   const claims = decode(token);',
      ].join('\n'),
    },
  },

  validation: {
    summary: '32 of 32 tests passed',
    detail: [
      'Login, logout, token refresh, invalid token, expired token and multi-tenant authentication all pass against the patched branch.',
    ],
    logs: [
      'checked out fix/jwt-issuer',
      'ran 32 assertions across 6 suites',
      'verified tokens minted before the fix still validate',
    ],
    durationMs: 2240,
    tool: { server: 'test-runner', call: 'run_tests' },
    result: {
      status: 'passed',
      suites: ['login', 'tokens', 'multi-tenant'],
      total: 32,
      passed: 32,
      failed: 0,
      failures: [],
      message: '32 of 32 passed across login, tokens and multi-tenant.',
      cases: [
        'Login',
        'Logout',
        'Token refresh',
        'Invalid token rejected',
        'Expired token rejected',
        'Multi-tenant authentication',
      ],
    },
  },

  reply: {
    subject: 'Authentication issue resolved',
    body: [
      'We have identified and fixed the authentication issue that was causing 401 errors after our recent deployment. A configuration value for token validation was pointing at the wrong host, so valid tokens were being rejected.',
      'The fix has passed our full authentication regression suite and has been approved for deployment.',
      'Please try logging in again. If you continue to experience any issues, reply to this ticket.',
    ],
    citations: ['PR #892', 'Authentication regression suite — 32/32', 'Incident INC-382'],
  },

  memory: {
    title: 'JWT issuer mismatch after deployment causes tenant-wide 401s',
    symptom: 'All users receive 401 Unauthorized immediately after a release',
    rootCause:
      'The deployment set JWT_ISSUER to the API host while tokens are minted with the auth host, so every issuer check failed.',
    resolution:
      'Restore JWT_ISSUER to the auth host and assert the value at boot so the mismatch fails loudly on start. PR #892.',
    tags: ['401', 'unauthorized', 'auth', 'authentication', 'jwt', 'login', 'deployment', 'token'],
    minutesSavedPerReuse: 240,
    relatedKnowledgeIds: ['auth-runbook', 'incident-inc-382'],
  },
}

// ---------------------------------------------------------------------------
// CASE 4 — Procol · a question · restraint reads as intelligence
// ---------------------------------------------------------------------------

const AUCTION_HOWTO: Playbook = {
  id: 'auction-howto',
  workspaceId: 'procol',
  match: {
    strong: ['how do i', 'how to', 'how can i'],
    terms: ['extend', 'deadline', 'close date', 'end time', 'auction'],
    veto: ['cannot see', 'not visible', 'error'],
  },
  ticket: {
    title: 'How do I extend an auction deadline?',
    description: 'A how-to question about extending the closing time of a live auction.',
    category: 'QUESTION',
    categoryLabel: 'How-to',
    priority: 'LOW',
    impact: 'One user',
    defaultCustomer: 'Kanti Metals',
    reportedBy: 'Buyer',
  },
  path: 'ANSWER_ONLY',
  stages: ['context'],

  narration: {
    received: [
      'This reads as a question rather than a defect. I am going to check the documentation before I wake anybody up.',
    ],
    routing: ['Asking whoever declares document_search in this workspace.'],
    decision: [
      'The customer needs information, not a change. No code, no configuration, no approval gate — I am answering and closing. Waking three agents for this would be theatre.',
    ],
    gate: [],
  },

  knowledge: {
    summary: 'An auction can be extended until it closes, from the auction header',
    detail: [
      'A live auction’s closing time can be changed by the buyer who created it, up until the moment it closes. Participants are notified automatically and the extension is recorded on the auction’s audit trail.',
    ],
    logs: ['matched 1 knowledge document', 'read auctions.md#extending-a-live-auction'],
    durationMs: 610,
    result: {
      isProductDefect: false,
      isQuestion: true,
      remediation: null,
    },
    citations: ['auctions.md#extending-a-live-auction'],
  },

  answer: {
    summary: 'Open the auction, choose Extend, and set the new closing time.',
    detail: [
      'Open the auction from Sourcing → Auctions, choose Extend on the auction header, and set the new closing time. It can be extended any number of times while the auction is still live.',
      'Every participant is emailed the new deadline automatically, and the change is recorded on the auction’s audit trail with your name against it.',
      'Once an auction has closed it cannot be extended — you would need to clone it into a new round instead.',
    ],
  },

  reply: {
    subject: 'Extending an auction deadline',
    body: [
      'You can extend a live auction from Sourcing → Auctions: open the auction, choose Extend on the header, and set the new closing time.',
      'Participants are notified automatically, and the change is recorded on the auction’s audit trail. An auction that has already closed cannot be extended — clone it into a new round instead.',
    ],
    citations: ['auctions.md#extending-a-live-auction'],
  },

  memory: {
    title: 'Extending a live auction deadline',
    symptom: 'A buyer asks how to move an auction’s closing time',
    rootCause: 'Not a defect — a documentation question.',
    resolution: 'Sourcing → Auctions → open the auction → Extend. Participants are notified automatically.',
    tags: ['auction', 'deadline', 'extend', 'how-to', 'documentation'],
    minutesSavedPerReuse: 12,
    relatedKnowledgeIds: ['auction-participants'],
  },
}


// ---------------------------------------------------------------------------
// CASE 5 — AcmeCloud · webhook deliveries abandoned · their own config fix
// ---------------------------------------------------------------------------

const WEBHOOK_RETRY: Playbook = {
  id: 'webhook-retry',
  workspaceId: 'acmecloud',
  match: {
    strong: ['webhook'],
    terms: ['retry', 'retries', 'delivery', 'deliveries', 'events', 'not receiving', 'callback', 'endpoint'],
  },
  ticket: {
    title: 'Webhook deliveries stopped reaching our endpoint',
    description: 'Events stop arriving at the customer’s endpoint with no error surfaced to them.',
    category: 'CONFIG',
    categoryLabel: 'Integrations',
    priority: 'HIGH',
    impact: 'Every event for the affected tenant',
    defaultCustomer: 'Northwind Ltd',
    reportedBy: 'Platform team',
  },
  path: 'CONFIG_FIX',
  stages: ['context', 'approve'],
  approvalPolicyId: 'config-change',

  narration: {
    received: [
      'Classified as an integration failure, high priority. Deliveries that stop silently are usually a budget or a threshold rather than a defect, so I want the delivery history before I involve engineering.',
    ],
    routing: ['Asking whoever declares product_knowledge and incident_history in this workspace.'],
    decision: [
      'The platform behaved as configured — the retry budget is simply below this endpoint’s response time. That is a configuration change on the tenant, not a code change, so engineering stays out of it.',
    ],
    gate: [
      'Configuration changes to a live environment require human approval. One change, no code, no tests — and the same gate.',
    ],
  },

  knowledge: {
    summary: 'The retry budget is lower than this endpoint’s p99 response time',
    detail: [
      'Deliveries are abandoned after the configured retry budget is exhausted. This tenant’s endpoint answers in 4.2s at p99 while the budget allows 3s, so slow-but-healthy deliveries are being dropped. The platform is behaving exactly as configured.',
    ],
    logs: [
      'searched internal documentation — 2 matches',
      'read webhook-delivery runbook §2 (retry budget)',
      'read delivery log — 212 abandoned, 0 rejected',
    ],
    durationMs: 780,
    result: {
      isProductDefect: false,
      remediation: 'Raise the tenant’s retry budget to 10s and alert when the abandon rate crosses 1%.',
      configNotes: 'Retry budget is per-tenant and defaults to 3s.',
    },
    citations: ['webhook-delivery-runbook.md#retry-budget'],
  },

  configFix: {
    title: 'Raise the tenant’s webhook retry budget from 3s to 10s.',
    system: 'AcmeCloud admin console',
    change: 'Tenant settings → Integrations → retry budget: 3s → 10s',
    steps: [
      'Open the tenant in the admin console',
      'Under Integrations, set the retry budget to 10s',
      'Replay the 212 abandoned deliveries from the delivery log',
      'Add an alert when the abandon rate for a tenant crosses 1%',
    ],
    rationale:
      'The delivery pipeline is working exactly as configured: it abandons a delivery that exceeds the tenant’s retry budget. The endpoint’s p99 is 6.2s against a 3s budget, so healthy-but-slow deliveries were being dropped. Nothing in the product needs changing — the budget does.',
    citations: ['webhooks.md#retry-budget', 'Delivery log · 212 abandoned since 4 September'],
  },

  reply: {
    subject: 'Webhook delivery issue resolved',
    body: [
      'Your events were being abandoned because your endpoint’s response time is longer than the retry budget configured on your tenant, so slow-but-successful deliveries were dropped before they completed.',
      'We have raised the budget on your tenant and replayed the deliveries that were abandoned, so nothing is lost. We have also added an alert so this surfaces to us next time instead of to you.',
      'No change to your integration is needed on your side.',
    ],
    citations: ['webhooks.md#retry-budget', 'Delivery log · 212 replayed'],
  },

  memory: {
    title: 'Webhook deliveries abandoned when the retry budget is below endpoint latency',
    symptom: 'Events stop arriving at a customer endpoint with no error reported to them',
    rootCause:
      'The per-tenant retry budget was shorter than the endpoint’s p99 response time, so healthy deliveries were abandoned.',
    resolution: 'Raise the tenant’s retry budget and alert on the abandon rate. No code change required.',
    tags: ['webhook', 'retry', 'delivery', 'integration', 'timeout', 'events'],
    minutesSavedPerReuse: 90,
    relatedKnowledgeIds: [],
  },
}

// ---------------------------------------------------------------------------
// Fallback — anything the classifier does not recognise
// ---------------------------------------------------------------------------

/**
 * Nothing matched.
 *
 * This playbook exists so that an unrecognised ticket still behaves *well*
 * rather than behaving *confidently*. Brain asks the knowledge agent, is told
 * there is nothing on file, and hands the ticket to a person with everything
 * it gathered attached.
 *
 * Borrowing another case's root cause here would be the single most damaging
 * thing this service could do: a plausible answer to a question nobody
 * checked is worse than no answer, and a demo that invents a pull request for
 * an unrelated ticket deserves the question it will get.
 */
const UNRECOGNISED: Playbook = {
  id: 'unrecognised',
  workspaceId: 'procol',
  match: { terms: [] },
  ticket: {
    title: 'Reported issue',
    description: 'Raised from the customer’s own description.',
    category: 'BUG',
    categoryLabel: 'Uncategorised',
    priority: 'MEDIUM',
    impact: 'Not yet assessed',
    defaultCustomer: 'Your organisation',
    reportedBy: 'Customer',
  },
  path: 'CONFIG_FIX',
  stages: ['context', 'approve'],

  narration: {
    received: [
      'I do not recognise this symptom from anything this control tower has seen before. I will ask for product context and say plainly what I do and do not know.',
    ],
    routing: ['Asking whoever declares product_knowledge in this workspace.'],
    decision: [
      'There is nothing on file for this. I am not going to invent a root cause, so I am handing it to a person with everything I gathered attached.',
    ],
    gate: [],
  },

  knowledge: {
    summary: 'Nothing on file matches this symptom',
    detail: [
      'No document, configuration note or previous incident in this workspace covers what the customer is describing. I cannot say whether this is a defect, a configuration gap or expected behaviour.',
    ],
    logs: ['searched knowledge index — 0 confident matches', 'searched previous incidents — 0 matches'],
    durationMs: 700,
    result: {
      isProductDefect: false,
      /** Tells the orchestrator to stop rather than pick a branch. */
      needsHuman: true,
      remediation: null,
    },
    citations: [],
  },

  reply: {
    subject: 'We are looking into your issue',
    body: [
      'Thanks for reporting this. We have not seen this particular symptom before, so rather than guess we have put it in front of a person on our team.',
      'You will hear from us directly once we know what is happening.',
    ],
    citations: [],
  },

  memory: {
    title: 'Unrecognised symptom handed to a person',
    symptom: 'A report that matches nothing this workspace has on file',
    rootCause: 'Unknown at the time of handover.',
    resolution: 'Escalated to a person with the gathered context attached.',
    tags: [],
    minutesSavedPerReuse: 0,
    relatedKnowledgeIds: [],
  },
}

export const PLAYBOOKS: Playbook[] = [
  INVOICE_TAX,
  VENDOR_ACCESS,
  AUTH_401,
  AUCTION_HOWTO,
  WEBHOOK_RETRY,
]

export const FALLBACK_PLAYBOOK = UNRECOGNISED

export function getPlaybook(id: string): Playbook {
  return PLAYBOOKS.find((playbook) => playbook.id === id) ?? FALLBACK_PLAYBOOK
}
