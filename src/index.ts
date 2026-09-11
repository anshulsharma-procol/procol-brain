/**
 * Public API of `@procol/brain-chat`.
 *
 * Everything not exported here is an internal implementation detail and may
 * change without a major version bump.
 */

export { ProcolBrain } from './components/ProcolBrain/ProcolBrain'

// Services - swap the mock for a real backend without touching the UI.
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
