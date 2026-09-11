import { env } from '../env.js'
import type { AgentDef, Workspace } from '../domain/types.js'
import { WORKSPACES } from '../domain/workspaces.js'

/**
 * Agent discovery.
 *
 * The orchestrator never hardcodes an agent id. It asks this registry who
 * declares a capability, and gets back a base URL. That is the entire reason
 * a workspace whose knowledge agent is not called Clara needs no special case
 * anywhere in the run.
 *
 * In `mounted` mode the agents are served by this process behind
 * `/agents/<id>`; in `separate` mode they are their own services on the URLs
 * in AGENT_URLS. Either way the orchestrator reaches them over HTTP through
 * the same client, so nothing about the protocol changes between the two.
 */

/** Agent id -> its own service URL, for `AGENT_MODE=separate`. */
const SEPARATE_PORT_ORDER = ['knowledge', 'engineering', 'validation'] as const

let selfOrigin = `http://127.0.0.1:${env.PORT}`

export function setSelfOrigin(origin: string): void {
  selfOrigin = origin
}

export function baseUrlFor(agent: AgentDef): string | undefined {
  // Agents that are not reached over the wire (the orchestrator itself, the
  // human gate, the in-process analytics copilot) have no base URL, and the
  // orchestrator calls them directly.
  if (agent.protocol !== 'A2A' || agent.role === 'orchestrator') return undefined

  if (env.AGENT_MODE === 'separate') {
    const index = SEPARATE_PORT_ORDER.indexOf(agent.role as (typeof SEPARATE_PORT_ORDER)[number])
    return index >= 0 ? env.agentUrls[index] : undefined
  }

  return `${selfOrigin}/agents/${agent.id}`
}

/** The capability index the orchestrator routes against. */
export function findByCapability(workspace: Workspace, capability: string): AgentDef[] {
  return workspace.agents.filter((agent) => agent.capabilities.includes(capability))
}

/**
 * Resolve one agent for a capability, with its address. Returns undefined when
 * nobody in this workspace declares it — which the orchestrator surfaces as a
 * calm activity entry rather than a crash, because a control tower has to
 * start with zero agents online.
 */
export function resolve(
  workspace: Workspace,
  capability: string,
): { agent: AgentDef; baseUrl: string } | undefined {
  for (const agent of findByCapability(workspace, capability)) {
    const baseUrl = baseUrlFor(agent)
    if (baseUrl) return { agent, baseUrl }
  }
  return undefined
}

/** Every agent across every workspace, with its address and live status. */
export function describeRegistry(): (AgentDef & { workspaceId: string })[] {
  return WORKSPACES.flatMap((workspace) =>
    workspace.agents.map((agent) => ({
      ...agent,
      workspaceId: workspace.id,
      baseUrl: baseUrlFor(agent),
    })),
  )
}

/**
 * Fetches each agent's card and marks it online. Runs at boot and every 30s.
 * Discovery failures are warnings: Brain must start with zero agents online.
 */
export async function discover(): Promise<void> {
  const seen = new Date().toISOString()

  await Promise.all(
    WORKSPACES.flatMap((workspace) =>
      workspace.agents.map(async (agent) => {
        const baseUrl = baseUrlFor(agent)
        if (!baseUrl) {
          agent.status = 'connected'
          agent.lastSeenAt = seen
          return
        }

        try {
          const response = await fetch(`${baseUrl}/.well-known/agent-card.json`, {
            signal: AbortSignal.timeout(2000),
          })
          agent.status = response.ok ? 'connected' : 'degraded'
          agent.baseUrl = baseUrl
          if (response.ok) agent.lastSeenAt = seen
        } catch {
          agent.status = 'offline'
        }
      }),
    ),
  )
}

export function startDiscovery(): NodeJS.Timeout {
  void discover()
  const timer = setInterval(() => void discover(), 30_000)
  timer.unref()
  return timer
}
