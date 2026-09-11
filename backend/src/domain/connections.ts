import type { Connector } from '../contract.js'

/**
 * ============================================================================
 *  CONNECTIONS
 * ============================================================================
 *
 * What a company plugs into Brain: their agents, their tools, their data and
 * their APIs. Brain discovers what each one can do and makes those
 * capabilities available to the agents that declare a need for them — which
 * is why a connection is described by its capabilities rather than by a
 * hand-written integration.
 *
 * The contract's `Connector` is four fields: id, kind, capabilities, health.
 * Everything else here is additive, so a backend that implements only the
 * contract still renders a usable Connections screen — one card per
 * connector, named by its id, with its capabilities listed. The extra fields
 * make it legible; they are not what makes it work.
 */

/** The filter tabs on the Connections screen. */
export type ConnectionCategory = 'agent' | 'mcp' | 'database' | 'saas' | 'knowledge'

export type ConnectionStatus = 'connected' | 'action_required' | 'not_connected'

export interface ConnectionDef extends Connector {
  name: string
  description: string
  category: ConnectionCategory
  /** What a person calls this kind of thing. */
  typeLabel: string
  status: ConnectionStatus
  /** Present when something needs doing — shown on the card and the panel. */
  statusDetail?: string
  /** Agents currently using it, by display name. */
  usedBy: string[]
  /** Brand key the UI renders a mark for. Unknown keys get a monogram. */
  logo: string
  /** Where it lives. Shown on the detail panel. */
  endpoint?: string
  /** What crosses the boundary. The first question every buyer asks. */
  dataMode: 'query-in-place' | 'pushdown' | 'replicated' | 'metadata-only'
  addedAt: string
}

/**
 * The contract has six connector kinds and they describe data sources, so an
 * A2A agent and a SaaS API both land on `saas-api`: both are an HTTP service
 * someone else operates. `category` is what the UI groups by, and it is
 * additive precisely because the contract's vocabulary does not have a word
 * for "another company's agent".
 */
const KIND: Record<ConnectionCategory, Connector['kind']> = {
  agent: 'saas-api',
  mcp: 'mcp',
  database: 'database',
  saas: 'saas-api',
  knowledge: 'file',
}

const TYPE_LABEL: Record<ConnectionCategory, string> = {
  agent: 'A2A Agent',
  mcp: 'MCP Server',
  database: 'Database',
  saas: 'API / SaaS',
  knowledge: 'Knowledge Source',
}

function connection(
  input: Omit<ConnectionDef, 'kind' | 'typeLabel' | 'health' | 'addedAt'> & {
    latencyMs?: number
    addedAt?: string
  },
): ConnectionDef {
  const { latencyMs, addedAt, ...rest } = input

  return {
    ...rest,
    kind: KIND[input.category],
    typeLabel: TYPE_LABEL[input.category],
    health: { ok: input.status === 'connected', latencyMs: latencyMs ?? 0 },
    addedAt: addedAt ?? '2026-08-01',
  }
}

export const PROCOL_CONNECTIONS: ConnectionDef[] = [
  connection({
    id: 'github',
    name: 'GitHub',
    category: 'mcp',
    logo: 'github',
    description: 'Access repositories, create PRs, review code and more.',
    status: 'connected',
    capabilities: [
      'create_pr',
      'search_code',
      'get_pr',
      'read_file',
      'create_branch',
      'commit',
      'list_repos',
      'get_commit',
      'review_pr',
      'merge_pr',
      'list_issues',
      'create_issue',
    ],
    usedBy: ['Development Agent', 'QA Agent'],
    endpoint: 'mcp://github.com/procol-hack',
    dataMode: 'query-in-place',
    latencyMs: 210,
  }),
  connection({
    id: 'jira',
    name: 'Jira',
    category: 'saas',
    logo: 'jira',
    description: 'Manage issues, projects and workflows.',
    status: 'connected',
    capabilities: ['create_issue', 'update_issue', 'search', 'get_issue', 'transition', 'add_comment', 'list_projects', 'get_sprint'],
    usedBy: ['Procol Brain', 'Development Agent'],
    endpoint: 'https://procol.atlassian.net',
    dataMode: 'query-in-place',
    latencyMs: 380,
  }),
  connection({
    id: 'procurement-db',
    name: 'Procurement DB',
    category: 'database',
    logo: 'postgres',
    description: 'Internal procurement database for purchase orders, vendors and invoices.',
    status: 'connected',
    capabilities: ['search_po', 'get_vendor', 'get_invoice', 'describe_schema', 'query', 'fetch_record'],
    usedBy: ['Lens', 'Procurement Agent'],
    endpoint: 'postgres://read-only@procurement-db',
    dataMode: 'query-in-place',
    latencyMs: 34,
  }),
  connection({
    id: 'slack',
    name: 'Slack',
    category: 'saas',
    logo: 'slack',
    description: 'Send notifications and get channel updates.',
    status: 'connected',
    capabilities: ['send_message', 'read_channel', 'search', 'list_channels', 'upload_file'],
    usedBy: ['Procol Brain'],
    endpoint: 'https://slack.com/api',
    dataMode: 'query-in-place',
    latencyMs: 290,
  }),
  connection({
    id: 'acme-dev-agent',
    name: 'Acme Dev Agent',
    category: 'agent',
    logo: 'agent',
    description: 'External development agent from Acme Corp.',
    status: 'connected',
    capabilities: ['code_fix', 'create_pr', 'review_code', 'bug_analysis'],
    usedBy: ['Development Agent'],
    endpoint: 'https://agents.acme.com/a2a',
    dataMode: 'query-in-place',
    latencyMs: 450,
  }),
  connection({
    id: 'google-drive',
    name: 'Google Drive',
    category: 'knowledge',
    logo: 'googledrive',
    description: 'Access documents, specs and design files.',
    status: 'action_required',
    statusDetail: 'The access token expired on 9 September. Reconnect to restore document search.',
    capabilities: ['search_docs', 'read_file', 'list_files', 'get_metadata', 'watch_changes'],
    usedBy: ['Clara', 'Lens'],
    endpoint: 'https://www.googleapis.com/drive/v3',
    dataMode: 'metadata-only',
  }),
  connection({
    id: 'sap',
    name: 'SAP',
    category: 'saas',
    logo: 'sap',
    description: 'Enterprise resource planning system.',
    status: 'not_connected',
    capabilities: ['get_material', 'create_order', 'check_status'],
    usedBy: [],
    dataMode: 'query-in-place',
  }),
  connection({
    id: 'notion',
    name: 'Notion',
    category: 'knowledge',
    logo: 'notion',
    description: 'Access product docs, meeting notes and wikis.',
    status: 'not_connected',
    capabilities: ['search_pages', 'read_page', 'list_spaces'],
    usedBy: [],
    dataMode: 'metadata-only',
  }),
]

export const ACME_CONNECTIONS: ConnectionDef[] = [
  connection({
    id: 'github',
    name: 'GitHub',
    category: 'mcp',
    logo: 'github',
    description: 'Access repositories, create PRs, review code and more.',
    status: 'connected',
    capabilities: ['create_pr', 'search_code', 'read_file', 'create_branch', 'commit'],
    usedBy: ['Development Agent', 'QA Agent'],
    endpoint: 'mcp://github.com/acmecloud',
    dataMode: 'query-in-place',
    latencyMs: 186,
  }),
  connection({
    id: 'confluence',
    name: 'Confluence',
    category: 'knowledge',
    logo: 'confluence',
    description: 'Internal documentation, runbooks and API references.',
    status: 'connected',
    capabilities: ['search_docs', 'read_page', 'list_spaces'],
    usedBy: ['Company Knowledge Agent'],
    endpoint: 'https://acmecloud.atlassian.net/wiki',
    dataMode: 'metadata-only',
    latencyMs: 320,
  }),
  connection({
    id: 'incident-db',
    name: 'Incident history',
    category: 'database',
    logo: 'postgres',
    description: 'Previous incidents, post-mortems and their resolutions.',
    status: 'connected',
    capabilities: ['describe_schema', 'query', 'search_incidents'],
    usedBy: ['Company Knowledge Agent'],
    endpoint: 'postgres://read-only@incident-db',
    dataMode: 'query-in-place',
    latencyMs: 41,
  }),
  connection({
    id: 'pagerduty',
    name: 'PagerDuty',
    category: 'saas',
    logo: 'pagerduty',
    description: 'On-call schedules and incident escalation.',
    status: 'not_connected',
    capabilities: ['get_oncall', 'create_incident', 'acknowledge'],
    usedBy: [],
    dataMode: 'query-in-place',
  }),
]

/**
 * What a newly added connection is assumed to expose, by type.
 *
 * A real integration discovers this — an MCP server lists its tools, an agent
 * card lists its skills, a database describes its schema. The discovery step
 * is real in shape and scripted in content, like everything else here.
 */
export const DISCOVERABLE: Record<ConnectionCategory, string[]> = {
  agent: ['bug_analysis', 'code_fix', 'create_pr'],
  mcp: ['list_tools', 'call_tool', 'read_resource'],
  database: ['describe_schema', 'query', 'fetch_record'],
  saas: ['search', 'create_record', 'update_record'],
  knowledge: ['search_docs', 'read_file', 'list_files'],
}

export { KIND as CONNECTION_KIND, TYPE_LABEL as CONNECTION_TYPE_LABEL }
