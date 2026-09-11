import type { Workspace } from './types'

/**
 * Procol's own control tower. The knowledge agent is Clara — the AI Procol
 * already runs in production. Brain does not replace it; it reaches it over
 * A2A and puts it to work for the engineering and validation agents too.
 */
export const procolWorkspace: Workspace = {
  id: 'procol',
  name: 'Procol',
  product: 'Procol Procurement Cloud',
  ticketPrefix: 'PRO',
  tagline: 'Procurement platform · Clara is the resident AI',
  accent: 'violet',
  supportEmailDomain: 'procol.in',

  agents: [
    {
      id: 'brain',
      name: 'Procol Brain',
      shortLabel: 'BR',
      role: 'orchestrator',
      summary: 'Classifies, routes by capability, and holds the audit trail',
      description:
        'Receives every request, decides which capabilities it needs, delegates over A2A, collects the artifacts and stops at the human gate.',
      protocol: 'A2A',
      protocolNote: 'Speaks A2A to every agent and never imports agent code.',
      capabilities: ['classify_ticket', 'route_capability', 'draft_reply', 'summarise_resolution'],
      tools: [],
      status: 'connected',
      ownership: 'procol',
    },
    {
      id: 'clara',
      name: 'Clara',
      shortLabel: 'CL',
      role: 'knowledge',
      summary: "Procol's production support AI, reached over A2A",
      description:
        'Answers product and tenant configuration questions. Already deployed at Procol — Brain consumes it as an agent rather than rebuilding it.',
      protocol: 'A2A',
      protocolNote: "The customer's existing AI as a first-class agent. Zero data transfer, zero migration.",
      capabilities: ['product_knowledge', 'customer_context', 'document_search'],
      tools: [
        {
          name: 'Product knowledge base',
          server: 'product-db',
          via: 'MCP',
          description: 'Reads product docs, tenant configs and business rules over MCP.',
        },
      ],
      status: 'connected',
      ownership: 'customer',
      sampleInteraction: [
        { from: 'Brain → Clara', text: 'What should GST be for ABC Corp?' },
        {
          from: 'Clara → Brain',
          text: 'Expected GST 18%, discount 10%. The tenant is configured correctly — this is a product defect.',
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
        'Reads the repository, traces the defect to a root cause, produces a minimal patch and opens a pull request.',
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
      sampleInteraction: [
        { from: 'Brain → Dev Agent', text: 'Investigate the invoice calculation defect on PRO-1245.' },
        {
          from: 'Dev Agent → Brain',
          text: 'Tenant context is never passed into the GST calculator. Opened PR #452.',
        },
      ],
    },
    {
      id: 'qa-agent',
      name: 'QA Agent',
      shortLabel: 'QA',
      role: 'validation',
      summary: 'Runs the real regression suite',
      description:
        'Executes the test suite against the patched branch and reports pass/fail. A failure sends the work back to engineering, capped at two attempts.',
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
      sampleInteraction: [
        { from: 'Brain → QA Agent', text: 'Validate PR #452 against the invoice regression suite.' },
        { from: 'QA Agent → Brain', text: '47 of 47 passed in 1.83s.' },
      ],
    },
    {
      id: 'lens',
      name: 'Lens',
      shortLabel: 'LN',
      role: 'analytics',
      summary: 'Blast radius over the company’s own data',
      description:
        'Answers "who else is affected?" by compiling a canonical query against the connector layer. No SQL is ever written by a model.',
      protocol: 'internal',
      protocolNote: 'Runs inside Brain and reads through the connector layer.',
      capabilities: ['impact_analysis', 'answer_question'],
      tools: [
        {
          name: 'Procurement database',
          server: 'procurement-db',
          via: 'CONNECTOR',
          description: 'Read-only canonical queries against the customer’s own schema.',
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
      summary: 'The gate nothing ships without',
      description:
        'A named person approves or rejects, and their decision lands on the same timeline as the agents, in the same visual language.',
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
      id: 'procurement-db',
      name: 'Procurement database',
      kind: 'database',
      dataMode: 'query-in-place',
      capabilities: ['describe_schema', 'query', 'fetch_record'],
      status: 'connected',
      latencyMs: 34,
    },
    {
      id: 'github',
      name: 'GitHub',
      kind: 'code-host',
      dataMode: 'query-in-place',
      capabilities: ['read_file', 'create_branch', 'commit', 'create_pr'],
      status: 'connected',
      latencyMs: 210,
    },
    {
      id: 'product-db',
      name: 'Product knowledge index',
      kind: 'mcp',
      dataMode: 'metadata-only',
      capabilities: ['search_docs', 'get_customer_config'],
      status: 'connected',
      latencyMs: 58,
    },
  ],

  approvalPolicies: [
    {
      id: 'code-billing',
      appliesTo: ['PR'],
      reason: 'Code changes to billing always require human approval.',
      risk: 'high',
    },
    {
      id: 'config-change',
      appliesTo: ['CONFIG_FIX'],
      reason: 'Configuration changes to a live tenant require human approval.',
      risk: 'medium',
    },
    {
      id: 'process-write',
      appliesTo: ['PROCESS_RESULT'],
      reason: 'Process actions that write to your systems require approval.',
      risk: 'high',
    },
  ],
}
