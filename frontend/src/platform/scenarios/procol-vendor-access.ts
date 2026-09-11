import type { Scenario } from './types'

/**
 * TEST CASE 3 — Procol · the Brain decides.
 *
 * The cheapest scenario to build and the one that kills the "this is just a
 * hardcoded pipeline" objection. Clara reports that the tenant, not the
 * product, is misconfigured — so engineering and QA are never woken, the
 * stage rail skips two dots, and the run reaches the same approval gate by a
 * visibly shorter path.
 */
export const procolVendorAccessScenario: Scenario = {
  id: 'procol-vendor-access',
  workspaceId: 'procol',
  path: 'CONFIG_FIX',
  status: 'AWAITING_APPROVAL',
  approvalPolicyId: 'config-change',
  stages: ['context', 'approve'],
  replayScale: 420,

  ticket: {
    reference: 'PRO-1238',
    title: 'Vendor cannot see the auction',
    description:
      'XYZ Metals invited Sharma Steels to the MS Plate auction, but nothing appears in the vendor’s dashboard.',
    customer: 'XYZ Metals',
    reportedBy: 'Rahul Menon · Sourcing',
    channel: 'portal',
    priority: 'MEDIUM',
    category: 'Auctions',
    impact: 'One auction closing Friday',
    createdMinutesAgo: 38,
    issueQuote: [
      'We invited Sharma Steels to the MS Plate auction but they say nothing shows in their dashboard.',
      'The auction closes Friday and we need them bidding before then.',
    ],
  },

  events: [
    {
      atSeconds: 0,
      from: 'brain',
      kind: 'thought',
      title: 'Ticket received from the customer portal',
      body: [
        'Classified as an auction visibility issue, medium priority. Before I wake engineering I want to know whether the vendor was actually added to the invited list.',
      ],
      level: 'info',
      durationMs: 520,
    },
    {
      atSeconds: 2,
      from: 'brain',
      to: 'clara',
      taskType: 'GET_PRODUCT_CONTEXT',
      kind: 'request',
      title: 'Is Sharma Steels on the invited list for this auction?',
      payload: {
        taskId: 'TASK-2a45',
        from: 'brain',
        to: 'clara',
        type: 'GET_PRODUCT_CONTEXT',
        context: { ticketId: 'PRO-1238', customer: 'XYZ Metals', issue: 'Vendor cannot see the auction' },
      },
      level: 'info',
    },
    {
      atSeconds: 4,
      from: 'clara',
      to: 'brain',
      taskType: 'GET_PRODUCT_CONTEXT',
      kind: 'response',
      title: 'The vendor was never added to the auction’s invited list',
      body: [
        'Auction visibility is driven by the participant list. Sharma Steels exists as a vendor on this tenant but is not a participant on the MS Plate auction, so the dashboard is behaving correctly. This is a configuration gap, not a product defect.',
      ],
      logs: ['matched 1 knowledge document', 'read auctions.md#participants', 'checked participant list — 4 vendors, Sharma Steels absent'],
      durationMs: 690,
      level: 'success',
      completesStage: 'context',
      payload: {
        taskId: 'TASK-2a45',
        status: 'completed',
        agent: 'clara',
        result: {
          isProductDefect: false,
          remediation:
            'Add Sharma Steels under Auction → Participants. No code change required.',
          citations: ['auctions.md#participants'],
        },
      },
    },
    {
      atSeconds: 6,
      from: 'brain',
      kind: 'thought',
      title: 'Decision: configuration fix — engineering is not involved',
      body: [
        'The product is behaving as designed, so there is nothing for the development or QA agents to do. I am drafting the remediation and the customer reply instead. Restraint is the decision here.',
      ],
      level: 'info',
      durationMs: 740,
    },
    {
      atSeconds: 8,
      from: 'brain',
      kind: 'artifact',
      artifactId: 'config-invite',
      title: 'Configuration remediation drafted',
      level: 'success',
    },
    {
      atSeconds: 10,
      from: 'brain',
      kind: 'gate',
      title: 'Stopping for human approval',
      body: [
        'Configuration changes to a live tenant require human approval. One step, no code, no tests — and the same gate.',
      ],
      level: 'warn',
    },
  ],

  artifacts: [
    {
      id: 'config-invite',
      kind: 'CONFIG_FIX',
      title: 'Configuration remediation',
      createdBy: 'brain',
      data: {
        summary: 'Add Sharma Steels to the MS Plate auction participant list.',
        change: 'Auction → Participants → add vendor "Sharma Steels" (GSTIN 27AAACS1429B1ZN)',
        steps: [
          'Open the MS Plate auction in the sourcing console',
          'Go to Participants and add Sharma Steels',
          'Confirm the invitation email is queued to their registered contact',
          'The auction appears on their dashboard within one minute',
        ],
      },
    },
    {
      id: 'reply-invite',
      kind: 'CUSTOMER_REPLY',
      title: 'Customer reply',
      createdBy: 'brain',
      data: {
        subject: 'Vendor auction visibility — PRO-1238',
        body: [
          'Hi XYZ Metals,',
          'Sharma Steels was not on the invited participant list for the MS Plate auction, which is why nothing appeared on their dashboard.',
          'We have added them under Auction → Participants and their invitation is on its way. The auction will show on their dashboard within a minute of them signing in.',
          'No product change was needed here, so nothing else on your account is affected.',
        ],
        signature: 'Procol Support',
        sent: false,
      },
    },
  ],

  memory: {
    title: 'Auction invisible to a vendor that is not on the participant list',
    symptom: 'An invited vendor reports that an auction does not appear on their dashboard',
    rootCause:
      'Auction visibility is driven by the participant list; the vendor existed on the tenant but was never added as a participant.',
    resolution: 'Add the vendor under Auction → Participants. No code change required.',
    path: 'CONFIG_FIX',
    tags: ['auction', 'vendor', 'visibility', 'participants', 'invite', 'dashboard', 'access'],
    reuseCount: 3,
    minutesSavedPerReuse: 55,
    relatedKnowledgeIds: ['auction-participants'],
  },
}
