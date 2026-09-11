// Domain types for the Agent Builder feature. Ported from a vanilla-JS
// reference implementation (localStorage-backed agents + skills, a linear
// node-chain workflow builder) and adapted to React + TypeScript.

export type NodeKind = 'trigger' | 'agent' | 'classify' | 'end' | 'mcp' | 'custom' | 'web_search'

export interface AgentNode {
  id: string
  kind: NodeKind
  title: string
  subtitle: string
  instructions?: string
  skillIds?: string[]
  model?: string
  temperature?: number
  triggerType?: string
}

export type AgentStatus = 'Draft' | 'Live'
export type WorkflowKind = 'Agent' | 'Workflow'

export interface AgentRecord {
  id: string
  name: string
  description: string
  status: AgentStatus
  sources: string[]
  agentCount: number
  workflowKind: WorkflowKind
  runCount: number
  owner: string
  updatedAt: string
  lastRunAt: string | null
  /** The node chain, persisted so a Draft agent can be reopened and edited. */
  nodes: AgentNode[]
}

export type SkillCategory = 'analysis' | 'validation'

export interface Skill {
  id: string
  name: string
  category: SkillCategory
  description: string
}
