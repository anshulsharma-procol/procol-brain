import type { AgentNode, AgentRecord, Skill } from './types'

const AGENTS_STORAGE_KEY = 'clara_agents_v1'
const AGENT_SKILLS_STORAGE_KEY = 'clara_agent_skills_v1'
const CURRENT_USER = 'Anshul Sharma'

const HOUR_MS = 60 * 60 * 1000

interface AgentSeed {
  name: string
  description: string
  status: AgentRecord['status']
  sources: string[]
  agentCount: number
  workflowKind: AgentRecord['workflowKind']
  runCount: number
}

const AGENTS_SEED: AgentSeed[] = [
  {
    name: 'Award Email Drafter',
    description: 'Drafts award recommendation emails from bid data.',
    status: 'Draft',
    sources: ['QCS bid data'],
    agentCount: 1,
    workflowKind: 'Agent',
    runCount: 0,
  },
  {
    name: 'Demand Aggregation Agent',
    description: 'Groups line items into sourcing lots, flags low-competition risk.',
    status: 'Live',
    sources: ['QCS bid data', 'Material master'],
    agentCount: 1,
    workflowKind: 'Workflow',
    runCount: 12,
  },
  {
    name: 'Vendor Risk Screener',
    description: 'Screens vendor profiles for compliance and financial risk before onboarding.',
    status: 'Live',
    sources: ['Vendor master'],
    agentCount: 2,
    workflowKind: 'Workflow',
    runCount: 34,
  },
  {
    name: 'Negotiation Prep Agent',
    description: 'Builds a negotiation brief with leverage points and counter-offer targets.',
    status: 'Draft',
    sources: [],
    agentCount: 1,
    workflowKind: 'Agent',
    runCount: 0,
  },
]

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

function defaultTriggerNode(): AgentNode {
  return {
    id: 'n_trigger',
    kind: 'trigger',
    title: 'When a user starts a chat',
    subtitle: 'Trigger · Chat',
    triggerType: 'Chat message',
  }
}

function seedAgents(): AgentRecord[] {
  const now = Date.now()
  const seeded = AGENTS_SEED.map((seed, index) => ({
    ...seed,
    id: randomId('agent'),
    owner: CURRENT_USER,
    updatedAt: new Date(now - index * HOUR_MS).toISOString(),
    lastRunAt: seed.runCount > 0 ? new Date(now - (index + 1) * HOUR_MS).toISOString() : null,
    nodes: [defaultTriggerNode()],
  }))
  saveAgentsToStorage(seeded)
  return seeded
}

export function loadAgentsFromStorage(): AgentRecord[] {
  try {
    const raw = localStorage.getItem(AGENTS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as AgentRecord[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // fall through to reseed
  }
  return seedAgents()
}

export function saveAgentsToStorage(agents: AgentRecord[]): void {
  try {
    localStorage.setItem(AGENTS_STORAGE_KEY, JSON.stringify(agents))
  } catch {
    // localStorage unavailable (private mode, quota) — fail silently, in-memory state still works
  }
}

export function formatAgentRelativeTime(iso: string | null): string {
  if (!iso) return 'Never run'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour
  if (diffMs < minute) return 'Just now'
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const AGENT_SKILLS_SEED: Skill[] = [
  {
    id: 'skill_bid_summary',
    name: 'Bid Summarizer',
    category: 'analysis',
    description: 'Summarises all vendor bids — participation rate, L1/L2/L3 prices, price variance, and award recommendation.',
  },
  {
    id: 'skill_tco_calc',
    name: 'TCO Calculator',
    category: 'analysis',
    description: 'Calculates Total Cost of Ownership across vendor bids — unit price, quantity, logistics, payment terms, and risk premium.',
  },
  {
    id: 'skill_vendor_risk',
    name: 'Vendor Risk Checker',
    category: 'validation',
    description: 'Analyses vendor profiles for compliance, performance history, and financial risk indicators.',
  },
  {
    id: 'skill_negotiation_strategy',
    name: 'Negotiation Strategist',
    category: 'analysis',
    description: 'Identifies leverage points, proposes counter-offer targets, and guides negotiation strategy based on bid data.',
  },
]

export function loadAgentSkillsFromStorage(): Skill[] {
  try {
    const raw = localStorage.getItem(AGENT_SKILLS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Skill[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // fall through to reseed
  }
  saveAgentSkillsToStorage(AGENT_SKILLS_SEED)
  return AGENT_SKILLS_SEED
}

export function saveAgentSkillsToStorage(skills: Skill[]): void {
  try {
    localStorage.setItem(AGENT_SKILLS_STORAGE_KEY, JSON.stringify(skills))
  } catch {
    // ignore — see saveAgentsToStorage
  }
}

export function createEmptyAgentDraft(): AgentRecord {
  const now = new Date().toISOString()
  return {
    id: randomId('agent'),
    name: '',
    description: '',
    status: 'Draft',
    sources: [],
    agentCount: 1,
    workflowKind: 'Agent',
    runCount: 0,
    owner: CURRENT_USER,
    updatedAt: now,
    lastRunAt: null,
    nodes: [defaultTriggerNode()],
  }
}

export function newNodeId(kind: string): string {
  return `n_${kind}_${Math.random().toString(36).slice(2, 8)}`
}

export function newSkillId(): string {
  return `skill_${Math.random().toString(36).slice(2, 10)}`
}

export { CURRENT_USER }
