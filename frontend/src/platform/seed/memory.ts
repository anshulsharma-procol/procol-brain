import type { MemoryEntry } from '../types'

/**
 * Institutional memory learned before today — the runs this control tower
 * already closed. Scenario memories are added to these at runtime, so the
 * store reflects both what the product has learned historically and what it
 * learns during the demo.
 *
 * This is the asset that compounds. A support tool answers a ticket; a
 * control tower remembers how the last one was answered, and hands that to
 * whoever — human or agent — picks up the next one.
 */
export const SEED_MEMORY: MemoryEntry[] = [
  {
    id: 'mem-pro-1189',
    workspaceId: 'procol',
    sourceTicketRef: 'PRO-1189',
    title: 'GST omitted entirely on renewal invoices',
    symptom: 'Invoice generated with no tax line for a tenant that has GST configured',
    rootCause:
      'The renewal invoice path built its own line items and never called the tax step, so GST was skipped rather than miscalculated.',
    resolution: 'Route renewal invoices through the same calculator as new invoices. PR #331.',
    path: 'CODE_FIX',
    tags: ['gst', 'tax', 'invoice', 'renewal', 'billing'],
    reuseCount: 2,
    minutesSavedPerReuse: 150,
    learnedAt: '2026-08-21',
    relatedKnowledgeIds: ['gst-configuration', 'invoice-process'],
  },
  {
    id: 'mem-pro-1102',
    workspaceId: 'procol',
    sourceTicketRef: 'PRO-1102',
    title: 'Approval matrix ignores the delegated approver',
    symptom: 'Purchase orders sit unapproved while the delegate reports seeing nothing to approve',
    rootCause:
      'Delegation was stored on the user but the approval query filtered on the original approver id only.',
    resolution: 'Include active delegations in the approver lookup. PR #287.',
    path: 'CODE_FIX',
    tags: ['approval', 'delegation', 'purchase-order', 'workflow'],
    reuseCount: 4,
    minutesSavedPerReuse: 120,
    learnedAt: '2026-07-14',
    relatedKnowledgeIds: ['approval-matrix'],
  },
  {
    id: 'mem-pro-0997',
    workspaceId: 'procol',
    sourceTicketRef: 'PRO-0997',
    title: 'Vendor cannot upload documents over 10 MB',
    symptom: 'Document upload fails silently for large files',
    rootCause: 'The gateway body limit was lower than the limit advertised in the product.',
    resolution: 'Raise the gateway limit to match the documented 25 MB and surface a clear error above it.',
    path: 'CONFIG_FIX',
    tags: ['upload', 'document', 'vendor', 'limit'],
    reuseCount: 6,
    minutesSavedPerReuse: 40,
    learnedAt: '2026-06-02',
    relatedKnowledgeIds: [],
  },
  {
    id: 'mem-acme-inc-382',
    workspaceId: 'acmecloud',
    sourceTicketRef: 'INC-382',
    title: 'Tenant-wide 401s traced to an environment variable drift',
    symptom: 'All users rejected at login shortly after a release',
    rootCause:
      'A deployment changed an authentication environment variable and nothing asserted the value at boot.',
    resolution:
      'Restore the value and add a boot-time assertion so the service refuses to start on a mismatch.',
    path: 'CODE_FIX',
    tags: ['401', 'auth', 'jwt', 'deployment', 'environment', 'login'],
    reuseCount: 1,
    minutesSavedPerReuse: 240,
    learnedAt: '2026-01-19',
    relatedKnowledgeIds: ['auth-runbook', 'incident-inc-382'],
  },
  {
    id: 'mem-acme-7612',
    workspaceId: 'acmecloud',
    sourceTicketRef: 'ACME-7612',
    title: 'Webhook deliveries dropped after a retry budget change',
    symptom: 'Downstream systems stop receiving events without any error surfacing to the customer',
    rootCause: 'The retry budget was reduced below the p99 downstream latency, so slow endpoints were abandoned.',
    resolution: 'Restore the retry budget and alert when the abandon rate crosses 1%.',
    path: 'CONFIG_FIX',
    tags: ['webhook', 'retry', 'integration', 'delivery'],
    reuseCount: 2,
    minutesSavedPerReuse: 90,
    learnedAt: '2026-05-08',
    relatedKnowledgeIds: [],
  },
]
