import type { Workspace } from '../types'

/**
 * A generic SaaS company's control tower.
 *
 * This file is the product argument. It is the same shape as `procol.ts`,
 * written by a different company, and it changes nothing about Brain: the
 * knowledge agent here is AcmeCloud's own internal documentation agent, not
 * Clara. Same orchestrator, same protocol, same approval gate, same timeline.
 *
 * Onboarding a new customer is writing this file and mapping their schema —
 * not rebuilding the product.
 */
export const acmeCloudWorkspace: Workspace = {
  id: 'acmecloud',
  name: 'AcmeCloud',
  product: 'AcmeCloud Platform',
  ticketPrefix: 'ACME',
  tagline: 'Generic SaaS · their own knowledge agent, not ours',
  accent: 'blue',
  supportEmailDomain: 'acmecloud.com',

  agents: [
    {
      id: 'brain',
      name: 'Procol Brain',
      shortLabel: 'BR',
      role: 'orchestrator',
      summary: 'The same orchestrator, unchanged',
      description:
        'Identical to the Procol deployment. It routes by declared capability, so it never needed to know that this company has no Clara.',
      protocol: 'A2A',
      protocolNote: 'Speaks A2A to every agent and never imports agent code.',
      capabilities: ['classify_ticket', 'route_capability', 'draft_reply', 'summarise_resolution'],
      tools: [],
      status: 'connected',
      ownership: 'procol',
    },
    {
      id: 'acme-knowledge',
      name: 'Company Knowledge Agent',
      shortLabel: 'CK',
      role: 'knowledge',
      summary: "AcmeCloud's own docs, runbooks and incident history",
      description:
        'Runs inside AcmeCloud. Serves internal documentation, API references, runbooks and previous incidents. Brain reaches it over A2A exactly as it reaches Clara.',
      protocol: 'A2A',
      protocolNote: 'Declares the same capabilities Clara declares, so Brain routes to it without a single line of company-specific code.',
      capabilities: ['product_knowledge', 'customer_context', 'document_search', 'incident_history'],
      tools: [
        {
          name: 'Internal documentation',
          server: 'confluence',
          via: 'MCP',
          description: 'Searches internal docs, API references and runbooks.',
        },
        {
          name: 'Incident history',
          server: 'incident-db',
          via: 'CONNECTOR',
          description: 'Reads previous incidents and their post-mortems.',
        },
      ],
      status: 'connected',
      ownership: 'customer',
      sampleInteraction: [
        { from: 'Brain → Company Knowledge Agent', text: 'What changed in yesterday’s deployment?' },
        {
          from: 'Company Knowledge Agent → Brain',
          text: 'Authentication uses JWT. The deployment altered the JWT issuer configuration. Incident INC-382 was similar.',
        },
      ],
    },
    {
      id: 'dev-agent',
      name: 'Development Agent',
      shortLabel: 'DEV',
      role: 'engineering',
      summary: 'Root cause, patch and pull request',
      description:
        'Same agent, pointed at AcmeCloud’s repository through their own code host credentials.',
      protocol: 'A2A',
      protocolNote: 'Receives A2A tasks; calls the code host over MCP.',
      capabilities: ['bug_analysis', 'code_fix', 'create_pr'],
      tools: [
        {
          name: 'GitHub',
          server: 'github',
          via: 'MCP',
          description: 'Reads files, creates branches and opens pull requests.',
        },
      ],
      status: 'connected',
      ownership: 'procol',
    },
    {
      id: 'qa-agent',
      name: 'QA Agent',
      shortLabel: 'QA',
      role: 'validation',
      summary: 'Runs AcmeCloud’s authentication regression suite',
      description: 'Executes the customer’s own test suite against the patched branch.',
      protocol: 'A2A',
      protocolNote: 'Receives A2A tasks; drives the test runner over MCP.',
      capabilities: ['run_tests', 'validate_fix'],
      tools: [
        {
          name: 'Test runner',
          server: 'test-runner',
          via: 'MCP',
          description: 'Runs the suite and parses the JSON report.',
        },
      ],
      status: 'connected',
      ownership: 'procol',
    },
    {
      id: 'human-approver',
      name: 'Human approver',
      shortLabel: 'YOU',
      role: 'approval',
      summary: 'AcmeCloud’s on-call engineering manager',
      description:
        'Production changes stop here. The policy that required the stop is shown above the button.',
      protocol: 'internal',
      protocolNote: 'Not an agent — a person, recorded as a peer on the audit trail.',
      capabilities: ['approve_fix', 'reject_fix'],
      tools: [],
      status: 'connected',
      ownership: 'customer',
    },
  ],

  connectors: [
    {
      id: 'incident-db',
      name: 'Incident history',
      kind: 'database',
      dataMode: 'query-in-place',
      capabilities: ['describe_schema', 'query'],
      status: 'connected',
      latencyMs: 41,
    },
    {
      id: 'github',
      name: 'GitHub',
      kind: 'code-host',
      dataMode: 'query-in-place',
      capabilities: ['read_file', 'create_branch', 'commit', 'create_pr'],
      status: 'connected',
      latencyMs: 186,
    },
    {
      id: 'confluence',
      name: 'Internal documentation',
      kind: 'saas-api',
      dataMode: 'metadata-only',
      capabilities: ['search_docs'],
      status: 'connected',
      latencyMs: 320,
    },
  ],

  approvalPolicies: [
    {
      id: 'production-auth',
      appliesTo: ['PR'],
      reason: 'Changes to authentication in production always require human approval.',
      risk: 'high',
    },
    {
      id: 'config-change',
      appliesTo: ['CONFIG_FIX'],
      reason: 'Configuration changes to a live environment require human approval.',
      risk: 'medium',
    },
  ],
}
