// Shared domain types for the Procol Brain demo frontend.
// All data is mocked — these types just keep the mock data and components honest.

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export type AgentId = 'brain' | 'clara' | 'dev' | 'qa' | 'manager'

export interface Agent {
  id: AgentId
  name: string
  shortLabel: string
  role: string
  description: string
  connected: boolean
  color: string // tailwind color token, e.g. 'violet'
  capabilities: string[]
  protocol: {
    name: string
    description: string
  }
  tools: {
    name: string
    description: string
  }[]
  sampleInteraction: {
    from: string
    text: string
  }[]
}

export interface BrainActivityStep {
  label: string
  detail: string
  time: string
  state: 'done' | 'active' | 'pending'
}

export interface ChatMessage {
  fromId: AgentId
  from: string
  to: string
  text: string[]
  time: string
  loading?: boolean
}

export interface TestResults {
  suite: string
  total: number
  passed: number
  failed: number
}

export interface Ticket {
  id: string
  number: string
  title: string
  description: string
  customer: string
  /** Detail-page status label, e.g. "AI Investigating" or "Resolved". */
  status: string
  /** Table-pill status shown in the Home "Active AI Operations" list. */
  tableStatus: 'In Progress' | 'Pending' | 'Resolved'
  priority: 'High' | 'Medium' | 'Low'
  category: string
  createdAt: string
  reportedBy: string
  impact: string
  attachment: string
  issueQuote: string[]
  progress: number
  currentAgentId: AgentId
  currentAgentAction: string
  updated: string
  brainActivity: BrainActivityStep[]
  messages: ChatMessage[]
  rootCause: {
    headline: string
    detail: string
  }
  fix: {
    prNumber: string
    file: string
    description: string
    merged: boolean
  }
  testResults: TestResults
  timeline: {
    label: string
    detail: string
    time: string
    state: 'done' | 'current'
  }[]
}

export interface KnowledgeEntry {
  id: string
  title: string
  description: string
  type: 'Product Doc' | 'Customer Config' | 'Business Rule' | 'FAQ'
  updatedAt: string
  usedBy: AgentId[]
  version: string
  content: {
    heading: string
    bullets: string[]
  }[]
  relatedTickets: {
    number: string
    title: string
    status: 'Resolved' | 'In Progress'
    date: string
  }[]
}
