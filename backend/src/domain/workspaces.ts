import type { AgentDef, AgentRole, Workspace } from './types'
import { acmeCloudWorkspace } from './workspace.acmecloud'
import { procolWorkspace } from './workspace.procol'

/**
 * The control towers this deployment serves. A new customer is one more file
 * beside these two and one more entry here.
 */
export const WORKSPACES: Workspace[] = [procolWorkspace, acmeCloudWorkspace]

export const DEFAULT_WORKSPACE_ID = procolWorkspace.id

export function getWorkspace(id: string | undefined): Workspace {
  return WORKSPACES.find((workspace) => workspace.id === id) ?? procolWorkspace
}

export function findAgent(workspace: Workspace, agentId: string): AgentDef | undefined {
  return workspace.agents.find((agent) => agent.id === agentId)
}

/**
 * Resolve an agent by what it declares, not by what it is called. The
 * orchestrator only ever asks this way — it is why a workspace with no Clara
 * needs no special case anywhere in the run.
 */
export function agentByCapability(workspace: Workspace, capability: string): AgentDef | undefined {
  return workspace.agents.find((agent) => agent.capabilities.includes(capability))
}

export function agentByRole(workspace: Workspace, role: AgentRole): AgentDef | undefined {
  return workspace.agents.find((agent) => agent.role === role)
}
