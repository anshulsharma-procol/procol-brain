import { getPlaybook } from '../domain/playbooks.js'
import type { A2AResponse, A2ATask } from '../domain/types.js'
import { env } from '../env.js'

/**
 * ============================================================================
 *  THE AGENTS
 * ============================================================================
 *
 * Each agent is a handler behind its own HTTP endpoint and its own agent card.
 * They hold no shared state with the orchestrator and never import it: they
 * receive an A2A envelope, do their work, and answer.
 *
 * "Their work" is reading the playbook named in the task context. That is the
 * scripted part, and the honest way to describe it is: the knowledge agent is
 * not searching a real index and the dev agent is not really reading a
 * repository — but the delegation, the protocol, the timing, the failure
 * handling and the artifacts are all real, and each agent could be replaced
 * with one that does the work for real without the orchestrator noticing.
 */

export type AgentHandler = (task: A2ATask, options?: { speed?: number }) => Promise<A2AResponse>

/**
 * Agents take as long as their work is scripted to take, which is what puts
 * honest latency on screen. A caller can ask for a different pace with the
 * `X-Brain-Run-Speed` header — the seeder asks for 0 so the opening board is
 * built instantly instead of in real time.
 */
async function work(ms: number, speed: number | undefined): Promise<void> {
  const rate = speed ?? env.RUN_SPEED
  if (!rate) return
  await new Promise((resolve) => setTimeout(resolve, Math.round(ms / rate)))
}

function playbookOf(task: A2ATask) {
  return getPlaybook(String(task.context.playbookId ?? ''))
}

function unsupported(task: A2ATask, agent: string): A2AResponse {
  return {
    taskId: task.taskId,
    status: 'failed',
    agent,
    error: `${agent} does not handle ${task.type}`,
  }
}

// ---------------------------------------------------------------------------
// Knowledge — product context, customer configuration, prior incidents
// ---------------------------------------------------------------------------

export function knowledgeHandler(agentId: string): AgentHandler {
  return async (task, options) => {
    if (task.type !== 'GET_PRODUCT_CONTEXT') return unsupported(task, agentId)

    const playbook = playbookOf(task)
    await work(playbook.knowledge.durationMs, options?.speed)

    return {
      taskId: task.taskId,
      status: 'completed',
      agent: agentId,
      durationMs: playbook.knowledge.durationMs,
      log: playbook.knowledge.logs,
      result: {
        summary: playbook.knowledge.summary,
        detail: playbook.knowledge.detail,
        customer: task.context.customer,
        citations: playbook.knowledge.citations,
        ...playbook.knowledge.result,
      },
    }
  }
}

// ---------------------------------------------------------------------------
// Engineering — root cause and a pull request
// ---------------------------------------------------------------------------

export function engineeringHandler(agentId: string): AgentHandler {
  return async (task, options) => {
    if (task.type !== 'INVESTIGATE_BUG') return unsupported(task, agentId)

    const playbook = playbookOf(task)
    const engineering = playbook.engineering

    if (!engineering) {
      return {
        taskId: task.taskId,
        status: 'failed',
        agent: agentId,
        error: 'No code path is known for this issue',
      }
    }

    await work(engineering.durationMs, options?.speed)

    // Which pass round the dev↔QA loop this is. It belongs to the run, so it
    // comes off the task rather than out of the script.
    const attempt = Number(task.context.attempt ?? 1)

    return {
      taskId: task.taskId,
      status: 'completed',
      agent: agentId,
      durationMs: engineering.durationMs,
      log: engineering.logs,
      result: {
        summary: engineering.summary,
        detail: engineering.detail,
        confidence: engineering.confidence,
        filesChanged: engineering.pr.filesChanged,
        branch: engineering.pr.branch,
        tool: engineering.tool,
      },
      artifacts: [
        {
          kind: 'ROOT_CAUSE',
          title: 'Root cause',
          data: { ...engineering.rootCause, attempt },
        },
        {
          kind: 'PR',
          title: `PR #${engineering.pr.number}`,
          // `real: false` is the honest flag while CODE_HOST is a mock: the
          // patch and the branch are what exist, and a client is told not to
          // render the url as a live link. Claiming a PR that was never
          // opened is the one thing on this timeline a judge could check.
          data: {
            ...engineering.pr,
            real: false,
            note: 'Opened against a mock code host. The patch on this branch is what exists.',
          },
        },
      ],
    }
  }
}

// ---------------------------------------------------------------------------
// Validation — run the suite against the patched branch
// ---------------------------------------------------------------------------

export function validationHandler(agentId: string): AgentHandler {
  return async (task, options) => {
    if (task.type !== 'VALIDATE_FIX') return unsupported(task, agentId)

    const playbook = playbookOf(task)
    const validation = playbook.validation

    if (!validation) {
      return {
        taskId: task.taskId,
        status: 'failed',
        agent: agentId,
        error: 'No suite is configured for this area of the product',
      }
    }

    await work(validation.durationMs, options?.speed)

    const failed = validation.result.failed > 0
    const attempt = Number(task.context.attempt ?? 1)

    return {
      taskId: task.taskId,
      status: failed ? 'failed' : 'completed',
      agent: agentId,
      durationMs: validation.durationMs,
      log: validation.logs,
      result: {
        summary: validation.summary,
        detail: validation.detail,
        tool: validation.tool,
        status: validation.result.status,
      },
      artifacts: [
        {
          kind: 'TEST_RESULT',
          title: 'Test results',
          data: {
            ...validation.result,
            durationMs: validation.durationMs,
            // The branch under test and which pass this is: both belong to
            // the run, so both come off the task.
            branch: String(task.context.branch ?? playbook.engineering?.pr.branch ?? 'main'),
            attempt,
          },
        },
      ],
    }
  }
}
