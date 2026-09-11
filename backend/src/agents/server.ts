import { Router } from 'express'
import type { AgentDef, Workspace } from '../domain/types.js'
import { WORKSPACES } from '../domain/workspaces.js'
import { baseUrlFor } from '../brain/registry.js'
import { engineeringHandler, knowledgeHandler, validationHandler, type AgentHandler } from './handlers.js'

/**
 * Mounts every A2A agent as its own HTTP service under `/agents/<id>`.
 *
 * Two endpoints each, which is the whole protocol surface an agent needs:
 *
 *   GET  /agents/:id/.well-known/agent-card.json   who I am, what I can do
 *   POST /agents/:id/a2a/tasks                     do this piece of work
 *
 * A judge can curl either one. In development these can be split into three
 * separate processes by setting AGENT_MODE=separate — the orchestrator calls
 * them over the same client either way, so the protocol does not change, and
 * that is exactly how it should be described out loud.
 */

const HANDLERS: Record<string, (agentId: string) => AgentHandler> = {
  knowledge: knowledgeHandler,
  engineering: engineeringHandler,
  validation: validationHandler,
}

interface MountedAgent {
  agent: AgentDef
  workspace: Workspace
  handle: AgentHandler
}

function mountedAgents(): MountedAgent[] {
  const mounted: MountedAgent[] = []

  for (const workspace of WORKSPACES) {
    for (const agent of workspace.agents) {
      const build = HANDLERS[agent.role]
      if (!build || agent.protocol !== 'A2A') continue
      mounted.push({ agent, workspace, handle: build(agent.id) })
    }
  }

  return mounted
}

/** The card, in the shape the A2A spec uses. */
export function agentCard(agent: AgentDef, workspace: Workspace) {
  return {
    protocolVersion: '0.3',
    id: agent.id,
    name: agent.name,
    description: agent.description,
    url: baseUrlFor(agent) ?? null,
    version: '0.1.0',
    workspace: workspace.id,
    capabilities: { streaming: false },
    skills: agent.capabilities.map((capability) => ({
      id: capability,
      name: capability.replace(/_/g, ' '),
    })),
    tools: agent.tools.map((tool) => ({ name: tool.name, server: tool.server, via: tool.via })),
  }
}

export function agentsRouter(): Router {
  const router = Router()
  const agents = new Map(mountedAgents().map((entry) => [entry.agent.id, entry]))

  router.get('/:agentId/.well-known/agent-card.json', (request, response) => {
    const entry = agents.get(request.params.agentId)
    if (!entry) {
      response.status(404).json({ error: { code: 'not_found', message: 'No such agent' } })
      return
    }
    response.json(agentCard(entry.agent, entry.workspace))
  })

  router.post('/:agentId/a2a/tasks', async (request, response) => {
    const entry = agents.get(request.params.agentId)
    if (!entry) {
      response.status(404).json({ error: { code: 'not_found', message: 'No such agent' } })
      return
    }

    const task = request.body
    if (!task?.taskId || !task?.type) {
      response.status(400).json({ error: { code: 'bad_request', message: 'taskId and type are required' } })
      return
    }

    // A pace hint from the caller. Absent or unparseable means "your own".
    const hinted = Number(request.header('X-Brain-Run-Speed'))
    const speed = Number.isFinite(hinted) ? hinted : undefined

    try {
      response.json(await entry.handle(task, { speed }))
    } catch (cause) {
      // An agent that throws answers `failed`, so the orchestrator can render
      // it calmly instead of receiving a 500 it has to interpret.
      response.json({
        taskId: task.taskId,
        status: 'failed',
        agent: entry.agent.id,
        error: cause instanceof Error ? cause.message : 'Agent error',
      })
    }
  })

  return router
}
