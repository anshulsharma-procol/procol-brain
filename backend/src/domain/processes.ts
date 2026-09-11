import type { ProcessDefinition } from '../contract.js'

/**
 * Flow: the same orchestrator with a different trigger.
 *
 * A process is a chain of capabilities and a gate — which is what a support
 * run already is. Nothing here is a second engine; `POST /api/processes/:key/run`
 * creates a ticket and starts the same walk, which is why a business process
 * renders in a screen built for support tickets without looking out of place.
 */
export const PROCESSES: ProcessDefinition[] = [
  {
    key: 'vendor-onboarding',
    name: 'Onboard vendor',
    trigger: 'event',
    steps: [
      { id: 'verify', requiredCapability: 'document_search' },
      { id: 'create', requiredCapability: 'create_record' },
      { id: 'assign', requiredCapability: 'product_knowledge' },
      { id: 'notify', requiredCapability: 'notify' },
    ],
    approvals: [
      { after: 'verify', reason: 'Process actions that write to your systems require approval.' },
    ],
  },
  {
    key: 'reissue-invoices',
    name: 'Re-issue invoices for affected tenants',
    trigger: 'manual',
    steps: [
      { id: 'list', requiredCapability: 'impact_analysis' },
      { id: 'regenerate', requiredCapability: 'create_record' },
      { id: 'notify', requiredCapability: 'notify' },
    ],
    approvals: [
      { after: 'list', reason: 'Re-issuing invoices writes to a live tenant and requires approval.' },
    ],
  },
]
