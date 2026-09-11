/**
 * Agent-to-agent (A2A) contract.
 *
 * Brain never talks to an agent's internals - it sends a task envelope and
 * reads a response envelope. Swapping Clara, Dev or QA for a different
 * implementation changes nothing here, which is the whole point.
 *
 * MCP is the other axis: A2A is agent <-> agent, MCP is agent -> tool.
 * A tool call shows up in the activity feed as an {@link AgentActivity} with
 * `via: 'MCP'`, never as an A2A task.
 */

/** Known participants. Open to extension so a host can register more agents. */
export type AgentId =
  | 'procol-brain'
  | 'clara'
  | 'dev-agent'
  | 'qa-agent'
  | 'manager'
  | (string & {})

export type A2ATaskType =
  | 'GET_PRODUCT_CONTEXT'
  | 'INVESTIGATE_BUG'
  | 'RUN_TESTS'
  | 'REQUEST_APPROVAL'

export type A2AStatus = 'pending' | 'running' | 'completed' | 'failed'

/** POST /a2a/tasks */
export interface A2ATask<TContext = A2ATaskContext> {
  taskId: string
  from: AgentId
  to: AgentId
  type: A2ATaskType
  context: TContext
}

export interface A2ATaskContext {
  ticketId: string
  customer?: string
  issue?: string
  /** Anything an agent needs that earlier agents produced. */
  [key: string]: unknown
}

/** The response every agent returns, whatever it does internally. */
export interface A2AResponse<TResult = unknown> {
  taskId: string
  status: A2AStatus
  result?: TResult
  error?: string
}

/* ------------------------------------------------------------------ results */

/** Clara: product + customer knowledge. */
export interface ClaraResult {
  expected: string
  customerConfig: Record<string, string>
  formula?: string
  notes?: string
}

/** Dev Agent: root cause and a pull request (real or mocked). */
export interface DevAgentResult {
  rootCause: string
  filesChanged: string[]
  pr: {
    number: number
    status: 'created' | 'open' | 'merged'
    title?: string
    url?: string
  }
}

/** QA Agent: test run over the proposed fix. */
export interface QaAgentResult {
  status: 'passed' | 'failed'
  tests: number
  passed: number
  failed: number
  message: string
}

/** Manager: the human gate. */
export interface ApprovalResult {
  approved: boolean
  approver: string
  note?: string
}

/* ----------------------------------------------------------------- registry */

/** A tool an agent reaches through MCP. */
export interface McpToolBinding {
  /** MCP server name, e.g. `github`, `test-runner`, `product-db`. */
  server: string
  /** Tool calls the agent is allowed to make. */
  capabilities: string[]
}

/** GET /agents */
export interface AgentDescriptor {
  id: AgentId
  name: string
  role: string
  capabilities: string[]
  protocol: 'A2A'
  status: 'connected' | 'degraded' | 'offline'
  /** Tools reached via MCP. Absent for agents that only answer from knowledge. */
  tools?: McpToolBinding[]
  /** Emoji or image URL used in the activity feed. */
  avatar?: string
}

/* ----------------------------------------------------------------- activity */

/**
 * One line in the agent communication feed. Covers both A2A hops
 * (`via: 'A2A'`) and MCP tool calls (`via: 'MCP'`).
 */
export interface AgentActivity {
  id: string
  from: AgentId
  to: AgentId
  /** What is being said, in plain language the customer can follow. */
  text: string
  via: 'A2A' | 'MCP'
  kind: 'request' | 'response' | 'tool'
  taskId?: string
  /** Set when `via` is 'MCP'. */
  tool?: {
    server: string
    call: string
  }
  /** ISO timestamp, when the backend provides one. */
  at?: string
}
