import type { ConnectionCategory } from './connections.js'

/**
 * What a company can plug in, as the "Add connection" panel offers it.
 *
 * Five types, and the order matters: an agent first, because the argument of
 * the whole product is that the AI a company already owns is a first-class
 * participant rather than something to replace.
 */
export interface ConnectionType {
  id: ConnectionCategory
  name: string
  description: string
  /** Colour token the UI paints the tile with. */
  accent: 'violet' | 'blue' | 'green' | 'orange' | 'red'
  /** What the form asks for once this type is chosen. */
  fields: {
    key: 'name' | 'endpoint' | 'token'
    label: string
    placeholder: string
    required: boolean
    /** Kept out of logs and never echoed back. */
    secret?: boolean
  }[]
  /** Shown while the connection is being probed. */
  discovering: string
}

export const CONNECTION_TYPES: ConnectionType[] = [
  {
    id: 'agent',
    name: 'AI Agent',
    description: 'Connect another AI agent using A2A (Agent-to-Agent).',
    accent: 'violet',
    fields: [
      { key: 'name', label: 'Agent name', placeholder: 'Acme Dev Agent', required: true },
      {
        key: 'endpoint',
        label: 'Agent card URL',
        placeholder: 'https://agents.acme.com/.well-known/agent-card.json',
        required: true,
      },
      { key: 'token', label: 'Token', placeholder: 'Optional', required: false, secret: true },
    ],
    discovering: 'Reading the agent card and its declared skills',
  },
  {
    id: 'mcp',
    name: 'MCP Server',
    description: 'Connect tools and data through MCP (Model Context Protocol).',
    accent: 'blue',
    fields: [
      { key: 'name', label: 'Server name', placeholder: 'GitHub', required: true },
      { key: 'endpoint', label: 'Server URL', placeholder: 'mcp://github.com/your-org', required: true },
      { key: 'token', label: 'Token', placeholder: 'Optional', required: false, secret: true },
    ],
    discovering: 'Listing the tools this server exposes',
  },
  {
    id: 'database',
    name: 'Database',
    description: 'PostgreSQL, MySQL, MongoDB, SQL Server, etc.',
    accent: 'green',
    fields: [
      { key: 'name', label: 'Display name', placeholder: 'Procurement DB', required: true },
      {
        key: 'endpoint',
        label: 'Connection string',
        placeholder: 'postgres://read-only@host:5432/db',
        required: true,
        secret: true,
      },
    ],
    discovering: 'Describing the schema through a read-only user',
  },
  {
    id: 'saas',
    name: 'API / SaaS',
    description: 'Jira, Salesforce, SAP, Slack, custom REST API, etc.',
    accent: 'orange',
    fields: [
      { key: 'name', label: 'Service name', placeholder: 'Jira', required: true },
      { key: 'endpoint', label: 'Base URL', placeholder: 'https://your-org.atlassian.net', required: true },
      { key: 'token', label: 'API token', placeholder: 'Required by most services', required: false, secret: true },
    ],
    discovering: 'Reading the API description and its operations',
  },
  {
    id: 'knowledge',
    name: 'Knowledge Source',
    description: 'Google Drive, Notion, Confluence, SharePoint, etc.',
    accent: 'red',
    fields: [
      { key: 'name', label: 'Source name', placeholder: 'Google Drive', required: true },
      { key: 'endpoint', label: 'Workspace or folder', placeholder: 'https://drive.google.com/…', required: true },
      { key: 'token', label: 'Token', placeholder: 'Optional', required: false, secret: true },
    ],
    discovering: 'Indexing titles and structure — documents stay where they are',
  },
]
