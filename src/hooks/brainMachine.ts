import type {
  BrainTicket,
  InvestigationStep,
  Resolution,
  SimilarIssue,
} from '../types/brain'
import type {
  BrainMessage,
  SuggestedAction,
  WorkflowState,
} from '../types/messages'
import { createId } from '../utils/id'

/** What the user came here to do. Drives how a typed message is handled. */
export type BrainIntent = 'report' | 'search' | 'question'

export interface BrainState {
  workflow: WorkflowState
  intent: BrainIntent
  messages: BrainMessage[]
  ticket: BrainTicket | null
  similarIssue: SimilarIssue | null
  resolution: Resolution | null
  error: string | null
}

export type BrainEvent =
  | { type: 'reset'; greeting: string }
  | { type: 'set_intent'; intent: BrainIntent }
  | { type: 'idle' }
  | { type: 'user_message'; text: string }
  | { type: 'assistant_message'; text: string }
  | { type: 'status'; id: string; text: string; status: 'running' | 'done' | 'empty' }
  | { type: 'searching_similar_issues' }
  | { type: 'similar_issue_found'; issue: SimilarIssue }
  | { type: 'awaiting_confirmation' }
  | { type: 'ticket_created'; ticket: BrainTicket }
  | { type: 'investigation_started'; ticket: BrainTicket; steps: InvestigationStep[] }
  | { type: 'investigation_progress'; steps: InvestigationStep[] }
  | { type: 'resolution_ready'; resolution: Resolution }
  | { type: 'resolved'; ticket: BrainTicket; headline: string; checks: string[] }
  | { type: 'error'; message: string }

export function createInitialState(greeting: string): BrainState {
  return {
    workflow: 'INITIAL',
    intent: 'report',
    messages: [textMessage('assistant', greeting)],
    ticket: null,
    similarIssue: null,
    resolution: null,
    error: null,
  }
}

/**
 * Pure transition function. The widget's entire behaviour lives here, which
 * keeps the React components free of workflow branching.
 */
export function brainReducer(state: BrainState, event: BrainEvent): BrainState {
  switch (event.type) {
    case 'reset':
      return createInitialState(event.greeting)

    case 'set_intent':
      return { ...state, intent: event.intent }

    // Back to "waiting for the user", keeping the transcript intact.
    case 'idle':
      return { ...state, workflow: 'INITIAL' }

    case 'user_message':
      return {
        ...state,
        workflow: 'USER_MESSAGE',
        error: null,
        messages: [...state.messages, textMessage('user', event.text)],
      }

    case 'assistant_message':
      return {
        ...state,
        messages: [...state.messages, textMessage('assistant', event.text)],
      }

    case 'status':
      return { ...state, messages: upsertStatus(state.messages, event) }

    case 'searching_similar_issues':
      return { ...state, workflow: 'SEARCHING_SIMILAR_ISSUES' }

    case 'similar_issue_found':
      return {
        ...state,
        workflow: 'SIMILAR_ISSUE_FOUND',
        similarIssue: event.issue,
        messages: [
          ...state.messages,
          { id: createId('msg'), createdAt: Date.now(), kind: 'similar-issue', issue: event.issue },
        ],
      }

    case 'awaiting_confirmation':
      return { ...state, workflow: 'WAITING_FOR_CONFIRMATION' }

    case 'ticket_created':
      return { ...state, ticket: event.ticket }

    case 'investigation_started':
      return {
        ...state,
        workflow: 'INVESTIGATING',
        ticket: event.ticket,
        messages: [
          ...state.messages,
          {
            id: createId('msg'),
            createdAt: Date.now(),
            kind: 'investigation',
            ticket: event.ticket,
            steps: event.steps,
          },
        ],
      }

    case 'investigation_progress':
      return {
        ...state,
        workflow: 'AGENTS_WORKING',
        messages: state.messages.map((message) =>
          message.kind === 'investigation' ? { ...message, steps: event.steps } : message,
        ),
      }

    case 'resolution_ready':
      return {
        ...state,
        workflow: 'RESOLUTION_READY',
        resolution: event.resolution,
        messages: [
          ...state.messages,
          {
            id: createId('msg'),
            createdAt: Date.now(),
            kind: 'resolution',
            resolution: event.resolution,
          },
        ],
      }

    case 'resolved':
      return {
        ...state,
        workflow: 'RESOLVED',
        ticket: event.ticket,
        messages: [
          ...state.messages,
          {
            id: createId('msg'),
            createdAt: Date.now(),
            kind: 'resolved',
            ticket: event.ticket,
            headline: event.headline,
            checks: event.checks,
          },
        ],
      }

    case 'error':
      return {
        ...state,
        workflow: 'INITIAL',
        error: event.message,
        messages: [...state.messages, textMessage('assistant', event.message)],
      }

    default:
      return state
  }
}

/** States in which the composer should be disabled and a spinner shown. */
export function isBusy(workflow: WorkflowState): boolean {
  return (
    workflow === 'SEARCHING_SIMILAR_ISSUES' ||
    workflow === 'INVESTIGATING' ||
    workflow === 'AGENTS_WORKING'
  )
}

/** Buttons offered under the thread, derived from the workflow state. */
export function getSuggestedActions(state: BrainState): SuggestedAction[] {
  switch (state.workflow) {
    case 'INITIAL':
      return [
        { id: 'report', label: 'Report a problem', tone: 'primary' },
        { id: 'search', label: 'Check previous solutions' },
        { id: 'question', label: 'Ask a question' },
      ]

    case 'WAITING_FOR_CONFIRMATION':
      return [
        { id: 'confirm_yes', label: 'Yes, this helps', tone: 'primary' },
        { id: 'confirm_no', label: 'No, investigate further' },
      ]

    case 'RESOLUTION_READY':
      return [{ id: 'accept_resolution', label: 'Great, mark as resolved', tone: 'primary' }]

    case 'RESOLVED':
      return [{ id: 'restart', label: 'Report another problem' }]

    default:
      return []
  }
}

function textMessage(author: 'user' | 'assistant', text: string): BrainMessage {
  return { id: createId('msg'), createdAt: Date.now(), kind: 'text', author, text }
}

function upsertStatus(
  messages: BrainMessage[],
  event: { id: string; text: string; status: 'running' | 'done' | 'empty' },
): BrainMessage[] {
  const existing = messages.find(
    (message) => message.kind === 'status' && message.id === event.id,
  )

  if (existing) {
    return messages.map((message) =>
      message.id === event.id && message.kind === 'status'
        ? { ...message, text: event.text, status: event.status }
        : message,
    )
  }

  return [
    ...messages,
    { id: event.id, createdAt: Date.now(), kind: 'status', text: event.text, status: event.status },
  ]
}
