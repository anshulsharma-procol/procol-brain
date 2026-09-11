import type { AgentDef, AgentRole, Workspace } from '../types'
import { acmeCloudWorkspace } from './acmecloud'
import { procolWorkspace } from './procol'

/**
 * The control towers this console can drive. A new customer is one more file
 * in this folder and one more entry here — nothing else in the app changes.
 */
export const WORKSPACES: Workspace[] = [procolWorkspace, acmeCloudWorkspace]

export const DEFAULT_WORKSPACE_ID = procolWorkspace.id

export function getWorkspace(id: string): Workspace {
  return WORKSPACES.find((workspace) => workspace.id === id) ?? procolWorkspace
}

export function findAgent(workspace: Workspace, agentId: string): AgentDef | undefined {
  return workspace.agents.find((agent) => agent.id === agentId)
}

/**
 * Resolve an agent by what it does rather than what it is called. This is how
 * a screen asks for "the knowledge agent" without knowing whether this company
 * calls it Clara.
 */
export function agentByRole(workspace: Workspace, role: AgentRole): AgentDef | undefined {
  return workspace.agents.find((agent) => agent.role === role)
}

/** The agent that declares a capability. Brain routes this way, and so do we. */
export function agentsByCapability(workspace: Workspace, capability: string): AgentDef[] {
  return workspace.agents.filter((agent) => agent.capabilities.includes(capability))
}

export { acmeCloudWorkspace, procolWorkspace }
