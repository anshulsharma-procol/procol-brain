import { Brain, Code, FlaskConical, Network, ScanSearch, User, Workflow } from 'lucide-react'
import type { ColorToken } from '../../components/colorClasses'
import type { AgentDef, AgentRole, Workspace } from '../types'
import { findAgent } from '../workspaces'

/**
 * Colour and icon come from an agent's ROLE, never from its id.
 *
 * That single decision is what lets one build serve every customer: Procol's
 * knowledge agent is teal-violet and carries the knowledge glyph because it is
 * the knowledge agent, not because it is called Clara. Drop in a company whose
 * knowledge agent is called something else and the screens are unchanged.
 */
const ROLE_COLOR: Record<AgentRole, ColorToken> = {
  orchestrator: 'violet',
  knowledge: 'violet',
  engineering: 'blue',
  validation: 'green',
  approval: 'amber',
  analytics: 'gray',
  process: 'gray',
}

const ROLE_ICON: Record<AgentRole, typeof Brain> = {
  orchestrator: Brain,
  knowledge: Network,
  engineering: Code,
  validation: FlaskConical,
  approval: User,
  analytics: ScanSearch,
  process: Workflow,
}

export interface AgentVisual {
  id: string
  name: string
  shortLabel: string
  role: AgentRole
  color: ColorToken
  icon: typeof Brain
  /** True for the orchestrator, which wears the brand gradient. */
  isOrchestrator: boolean
}

/** A person acting on the timeline, rendered as a peer of the agents. */
const HUMAN: AgentVisual = {
  id: 'human',
  name: 'You',
  shortLabel: 'YOU',
  role: 'approval',
  color: ROLE_COLOR.approval,
  icon: ROLE_ICON.approval,
  isOrchestrator: false,
}

/** The person who raised the ticket. On the record, not driving it. */
const CUSTOMER: AgentVisual = {
  id: 'customer',
  name: 'Customer',
  shortLabel: 'CUS',
  role: 'analytics',
  color: 'gray',
  icon: ROLE_ICON.approval,
  isOrchestrator: false,
}

/** No agent holds this yet — neutral, never another role's colour. */
const UNASSIGNED: AgentVisual = {
  id: 'unassigned',
  name: 'Unassigned',
  shortLabel: '—',
  role: 'analytics',
  color: 'gray',
  icon: ROLE_ICON.approval,
  isOrchestrator: false,
}

export function agentVisual(workspace: Workspace, agentId: string | undefined): AgentVisual {
  if (!agentId) return UNASSIGNED
  if (agentId === 'human') return HUMAN
  if (agentId === 'customer') return CUSTOMER

  const agent = findAgent(workspace, agentId)
  if (!agent) {
    // An agent the workspace has not declared still renders calmly rather than
    // crashing a timeline — the registry can be behind the run.
    return { ...UNASSIGNED, id: agentId, name: agentId, shortLabel: agentId.slice(0, 3).toUpperCase() }
  }

  return visualForAgent(agent)
}

export function visualForAgent(agent: AgentDef): AgentVisual {
  return {
    id: agent.id,
    name: agent.name,
    shortLabel: agent.shortLabel,
    role: agent.role,
    color: ROLE_COLOR[agent.role],
    icon: ROLE_ICON[agent.role],
    isOrchestrator: agent.role === 'orchestrator',
  }
}

export { ROLE_COLOR, ROLE_ICON }
