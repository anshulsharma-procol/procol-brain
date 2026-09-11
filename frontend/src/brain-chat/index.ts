/**
 * Public API of `@procol/brain-chat`.
 *
 * Everything not exported here is an internal implementation detail and may
 * change without a major version bump.
 */

export { ProcolBrain } from './components/ProcolBrain/ProcolBrain'

// Services - swap the scripted demo for a real backend without touching the UI.
export { A2ABrainApi } from './services/a2aBrainApi'
export type { A2ABrainApiOptions, A2AExchange, A2AAgentResult } from './services/a2aBrainApi'
export { createRestBrainClient } from './services/restBrainApi'
export type { RestBrainClientOptions, A2ATaskRecord, ApprovalRequest } from './services/restBrainApi'
export { createBrainClient } from './services/brainApi'
export { MockBrainApi } from './services/mockBrainApi'
export type {
  BrainApi,
  BrainClientOptions,
  BrainRequest,
  MessageRequest,
  TicketRequest,
  InvestigationOptions,
} from './services/brainApi'
export type { MockBrainApiOptions } from './services/mockBrainApi'

// Headless usage - build a custom UI on top of the same conversation engine.
export { useProcolBrain } from './hooks/useProcolBrain'
export type { UseProcolBrainOptions, UseProcolBrainResult } from './hooks/useProcolBrain'
export type { BrainState, BrainIntent } from './hooks/brainMachine'

// Demo data - delete this import once the Brain API is live.
export {
  AGENT_REGISTRY,
  INVESTIGATION_PLAN,
  KNOWLEDGE_BASE,
  SCENARIOS,
  matchScenario,
} from './data/demoScenario'
export type { DemoScenario } from './data/demoScenario'

// A2A / MCP contract
export type {
  AgentId,
  AgentDescriptor,
  AgentActivity,
  A2ATask,
  A2ATaskType,
  A2ATaskContext,
  A2AResponse,
  A2AStatus,
  ClaraResult,
  DevAgentResult,
  QaAgentResult,
  ApprovalResult,
  McpToolBinding,
} from './types/a2a'

// Theming
export { defaultTheme } from './theme/defaultTheme'

// Types
export type { ProcolBrainProps, ProcolBrainTheme, BrainPosition } from './types/config'
export type {
  BrainContext,
  BrainIdentity,
  BrainTicket,
  TicketStatus,
  SimilarIssue,
  InvestigationStep,
  InvestigationStepStatus,
  InvestigationProgressUpdate,
  Resolution,
  ResolutionCheck,
  BrainReply,
} from './types/brain'
export type {
  WorkflowState,
  BrainMessage,
  MessageAuthor,
  SuggestedAction,
} from './types/messages'
