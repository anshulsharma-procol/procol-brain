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
        filesChanged: engineering.pr.files,
        tool: engineering.tool,
      },
      artifacts: [
        {
          kind: 'ROOT_CAUSE',
          title: 'Root cause',
          data: { ...engineering.rootCause },
        },
        {
          kind: 'PR',
          title: `PR #${engineering.pr.number}`,
          // 'mock' is the contract's word for a pull request this deployment
          // did not really open, and it is the honest one while CODE_HOST is
          // a mock. Calling it 'created' or flipping it to 'merged' after an
          // approval would claim a merge that never happened.
          data: { ...engineering.pr, state: 'mock' },
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

    return {
      taskId: task.taskId,
      status: validation.failed > 0 ? 'failed' : 'completed',
      agent: agentId,
      durationMs: validation.durationMs,
      log: validation.logs,
      result: {
        summary: validation.summary,
        detail: validation.detail,
        tool: validation.tool,
        status: validation.failed > 0 ? 'failed' : 'passed',
      },
      artifacts: [
        {
          kind: 'TEST_RESULT',
          title: 'Test results',
          data: {
            status: validation.failed > 0 ? 'failed' : 'passed',
            suites: validation.suites,
            total: validation.total,
            passed: validation.passed,
            failed: validation.failed,
            durationMs: validation.durationMs,
            cases: validation.cases,
            failures: [],
          },
        },
      ],
    }
  }
}
