import type { KnowledgeEntry } from './types'

/**
 * What the knowledge agents read. Procol's documents are served by Clara;
 * AcmeCloud's by their own Company Knowledge Agent. Same shape, so the
 * Knowledge screen never asks which company it is rendering.
 */
export const SEED_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'gst-configuration',
    workspaceId: 'procol',
    title: 'GST configuration',
    description: 'Tax configuration and calculation rules by tenant',
    type: 'Customer Config',
    version: 'v1.2',
    updatedAt: '10 Sep 2026',
    usedBy: ['clara', 'dev-agent'],
    content: [
      {
        heading: 'Calculation rules',
        bullets: [
          'Default GST rate: 12% (platform fallback only)',
          'Calculation: (base − discount) + gst',
          'Tenant-specific rates override the default',
          'Applies to every invoice type, including renewals',
        ],
      },
      {
        heading: 'ABC Corp',
        bullets: ['GST rate: 18%', 'Discount: 10%', 'Currency: INR', 'Region: India (intra-state)'],
      },
    ],
    relatedTicketRefs: ['PRO-1245', 'PRO-1189'],
  },
  {
    id: 'invoice-process',
    workspaceId: 'procol',
    title: 'Invoice generation process',
    description: 'End-to-end invoice flow from confirmed order to delivered PDF',
    type: 'Product Doc',
    version: 'v2.0',
    updatedAt: '8 Sep 2026',
    usedBy: ['clara', 'dev-agent', 'qa-agent'],
    content: [
      {
        heading: 'Flow',
        bullets: [
          'Order confirmed and line items locked',
          'Discounts applied per tenant configuration',
          'GST calculated from the tenant’s tax settings',
          'Invoice PDF generated and delivered to the billing contact',
        ],
      },
    ],
    relatedTicketRefs: ['PRO-1245'],
  },
  {
    id: 'auction-participants',
    workspaceId: 'procol',
    title: 'Auction participants and visibility',
    description: 'Who can see an auction, and why a vendor might not',
    type: 'Business Rule',
    version: 'v1.1',
    updatedAt: '1 Sep 2026',
    usedBy: ['clara'],
    content: [
      {
        heading: 'Visibility rules',
        bullets: [
          'An auction is visible only to vendors on its participant list',
          'Being a vendor on the tenant is not sufficient',
          'Participants can be added until the auction closes',
          'Adding a participant queues an invitation to their registered contact',
        ],
      },
    ],
    relatedTicketRefs: ['PRO-1238'],
  },
  {
    id: 'approval-matrix',
    workspaceId: 'procol',
    title: 'Approval matrix',
    description: 'Thresholds, approvers and delegation',
    type: 'Business Rule',
    version: 'v3.0',
    updatedAt: '14 Jul 2026',
    usedBy: ['clara', 'dev-agent'],
    content: [
      {
        heading: 'Rules',
        bullets: [
          'Value thresholds determine the approver level',
          'Delegations are active for a date range and apply to every pending item',
          'Delegated approvals are recorded against both people',
        ],
      },
    ],
    relatedTicketRefs: ['PRO-1102'],
  },
  {
    id: 'auth-runbook',
    workspaceId: 'acmecloud',
    title: 'Authentication service runbook',
    description: 'Token issuance, validation and the failure modes that produce 401s',
    type: 'Runbook',
    version: 'v4.2',
    updatedAt: '10 Sep 2026',
    usedBy: ['acme-knowledge', 'dev-agent', 'qa-agent'],
    content: [
      {
        heading: 'Token validation',
        bullets: [
          'Tokens are minted by the auth service with issuer auth.acmecloud.com',
          'Every service validates the issuer strictly against JWT_ISSUER',
          'A mismatch returns 401 for every request, including admin sessions',
          'JWT_ISSUER is set per environment in deploy/<env>.yaml',
        ],
      },
      {
        heading: 'First checks on a tenant-wide 401',
        bullets: [
          'Compare JWT_ISSUER against the last known-good release',
          'Confirm clock skew is within tolerance',
          'Check whether the signing key rotated in the same window',
        ],
      },
    ],
    relatedTicketRefs: ['ACME-7821', 'INC-382'],
  },
  {
    id: 'incident-inc-382',
    workspaceId: 'acmecloud',
    title: 'INC-382 — tenant-wide login failure',
    description: 'January incident with the same signature as ACME-7821',
    type: 'Incident',
    version: 'final',
    updatedAt: '19 Jan 2026',
    usedBy: ['acme-knowledge'],
    content: [
      {
        heading: 'Summary',
        bullets: [
          'All users on all tenants received 401 for 41 minutes',
          'Cause: an environment variable drift introduced by a release',
          'Detection: customer report, not monitoring',
          'Action item: assert authentication configuration at boot (not completed)',
        ],
      },
    ],
    relatedTicketRefs: ['INC-382'],
  },
  {
    id: 'release-notes-0910',
    workspaceId: 'acmecloud',
    title: 'Release notes — 2026.09.10',
    description: 'The deployment that preceded the outage',
    type: 'Product Doc',
    version: '2026.09.10',
    updatedAt: '10 Sep 2026',
    usedBy: ['acme-knowledge', 'dev-agent'],
    content: [
      {
        heading: 'Changes',
        bullets: [
          'Consolidated gateway and auth hostnames in the deployment manifest',
          'Upgraded the token library to 4.1.0',
          'Enabled structured request logging in production',
        ],
      },
    ],
    relatedTicketRefs: ['ACME-7821'],
  },
]
