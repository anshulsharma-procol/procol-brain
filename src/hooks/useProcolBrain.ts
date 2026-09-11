import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react'
import type { BrainApi } from '../services/brainApi'
import type {
  BrainContext,
  BrainIdentity,
  BrainTicket,
  Resolution,
} from '../types/brain'
import type { BrainMessage, SuggestedAction, WorkflowState } from '../types/messages'
import {
  brainReducer,
  createInitialState,
  getSuggestedActions,
  isBusy,
  type BrainIntent,
  type BrainState,
} from './brainMachine'
import { createId } from '../utils/id'
import { delay } from '../utils/delay'

export interface UseProcolBrainOptions {
  api: BrainApi
  identity: BrainIdentity
  context?: BrainContext
  greeting: string
  onTicketCreated?: (ticket: BrainTicket) => void
  onTicketResolved?: (ticket: BrainTicket) => void
  onResolutionReady?: (resolution: Resolution) => void
}

export interface UseProcolBrainResult {
  state: BrainState
  workflow: WorkflowState
  messages: BrainMessage[]
  suggestedActions: SuggestedAction[]
  busy: boolean
  sendMessage: (text: string) => void
  runAction: (actionId: string) => void
  reset: () => void
}

const RESOLVED_CHECKS = ['Solution provided', 'Ticket resolved', 'Activity logged']

const INTENT_PROMPTS: Record<BrainIntent, string> = {
  report:
    'Sure - tell me what went wrong. Include the module and any reference number if you have one.',
  search:
    'Happy to look. Describe the issue and I will search previously resolved tickets.',
  question: 'Go ahead - what would you like to know?',
}

/**
 * Owns the support conversation: talks to the {@link BrainApi}, feeds the
 * state machine, and exposes exactly what the UI needs to render.
 */
export function useProcolBrain(options: UseProcolBrainOptions): UseProcolBrainResult {
  const {
    api,
    identity,
    context,
    greeting,
    onTicketCreated,
    onTicketResolved,
    onResolutionReady,
  } = options

  const [state, dispatch] = useReducer(brainReducer, greeting, createInitialState)

  // Latest props/state without re-creating the callbacks on every render.
  // Written in an effect so nothing mutates a ref during render.
  const latest = useRef({ api, identity, context, onTicketCreated, onTicketResolved, onResolutionReady })
  const stateRef = useRef(state)

  useEffect(() => {
    latest.current = { api, identity, context, onTicketCreated, onTicketResolved, onResolutionReady }
    stateRef.current = state
  })

  const lastIssueText = useRef('')
  const runId = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  /** Starts a new async run; anything from a previous run is ignored. */
  const beginRun = useCallback(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const id = ++runId.current
    return {
      signal: controller.signal,
      isCurrent: () => runId.current === id && !controller.signal.aborted,
    }
  }, [])

  const request = useCallback(
    (message: string) => ({
      message,
      identity: latest.current.identity,
      context: latest.current.context,
    }),
    [],
  )

  const runInvestigation = useCallback(
    async (issueText: string, run: { signal: AbortSignal; isCurrent: () => boolean }) => {
      const { api: brain } = latest.current

      let ticket = stateRef.current.ticket
      if (!ticket) {
        ticket = await brain.createTicket(request(issueText))
        if (!run.isCurrent()) return
        ticket = { ...ticket, status: 'investigating' }
        dispatch({ type: 'ticket_created', ticket })
        latest.current.onTicketCreated?.(ticket)
      }

      dispatch({ type: 'investigation_started', ticket, steps: [] })

      const resolution = await brain.startInvestigation(
        { ticketId: ticket.id, identity: latest.current.identity, context: latest.current.context },
        {
          signal: run.signal,
          onProgress: (update) => {
            if (!run.isCurrent()) return
            dispatch({ type: 'investigation_progress', steps: update.steps })
          },
        },
      )

      if (!run.isCurrent()) return

      dispatch({ type: 'resolution_ready', resolution })
      latest.current.onResolutionReady?.(resolution)
    },
    [request],
  )

  const guard = useCallback(async (work: () => Promise<void>) => {
    try {
      await work()
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      dispatch({
        type: 'error',
        message:
          'Something went wrong while reaching support. Please try again in a moment.',
      })
    }
  }, [])

  const sendMessage = useCallback(
    (rawText: string) => {
      const text = rawText.trim()
      if (!text || isBusy(stateRef.current.workflow)) return

      const run = beginRun()
      const intent = stateRef.current.intent
      dispatch({ type: 'user_message', text })

      void guard(async () => {
        const { api: brain } = latest.current

        if (intent === 'question') {
          const reply = await brain.sendMessage(request(text))
          if (!run.isCurrent()) return
          dispatch({ type: 'assistant_message', text: reply.message })
          dispatch({ type: 'idle' })
          return
        }

        lastIssueText.current = text

        dispatch({
          type: 'assistant_message',
          text: "Thanks for reporting this. Let me check if we've solved a similar issue before.",
        })
        dispatch({ type: 'searching_similar_issues' })

        const statusId = createId('status')
        dispatch({
          type: 'status',
          id: statusId,
          text: 'Searching previous solutions...',
          status: 'running',
        })

        const issues = await brain.searchSimilarIssues(request(text))
        if (!run.isCurrent()) return

        const issue = issues[0]
        if (issue) {
          dispatch({
            type: 'status',
            id: statusId,
            text: 'Found a similar resolved issue',
            status: 'done',
          })
          dispatch({ type: 'similar_issue_found', issue })

          await delay(600, run.signal)
          if (!run.isCurrent()) return

          dispatch({ type: 'assistant_message', text: 'Does this solution resolve your issue?' })
          dispatch({ type: 'awaiting_confirmation' })
          return
        }

        dispatch({
          type: 'status',
          id: statusId,
          text: 'No similar resolved issue found',
          status: 'empty',
        })
        dispatch({
          type: 'assistant_message',
          text: "I couldn't find a previous fix for this. I'll start a new investigation with our agent team.",
        })

        await runInvestigation(text, run)
      })
    },
    [beginRun, guard, request, runInvestigation],
  )

  const markResolved = useCallback(
    async (run: { isCurrent: () => boolean }) => {
      const existing = stateRef.current.ticket
      const ticket: BrainTicket =
        existing ??
        (await latest.current.api.createTicket(request(lastIssueText.current || 'Support request')))

      if (!run.isCurrent()) return

      const resolved: BrainTicket = { ...ticket, status: 'resolved' }
      if (!existing) latest.current.onTicketCreated?.(resolved)

      dispatch({
        type: 'resolved',
        ticket: resolved,
        headline: "Great! I'm glad we could help.",
        checks: RESOLVED_CHECKS,
      })
      latest.current.onTicketResolved?.(resolved)
    },
    [request],
  )

  const runAction = useCallback(
    (actionId: string) => {
      if (isBusy(stateRef.current.workflow)) return

      switch (actionId) {
        case 'report':
        case 'search':
        case 'question': {
          dispatch({ type: 'set_intent', intent: actionId })
          dispatch({ type: 'assistant_message', text: INTENT_PROMPTS[actionId] })
          dispatch({ type: 'idle' })
          return
        }

        case 'confirm_yes': {
          const run = beginRun()
          dispatch({ type: 'user_message', text: 'Yes, this helps' })
          void guard(() => markResolved(run))
          return
        }

        case 'confirm_no': {
          const run = beginRun()
          dispatch({ type: 'user_message', text: 'No, investigate further' })
          dispatch({
            type: 'assistant_message',
            text: "Understood. I'll start a new investigation with our agent team.",
          })
          void guard(() => runInvestigation(lastIssueText.current, run))
          return
        }

        case 'accept_resolution': {
          const run = beginRun()
          void guard(() => markResolved(run))
          return
        }

        case 'restart': {
          abortRef.current?.abort()
          runId.current++
          lastIssueText.current = ''
          dispatch({ type: 'reset', greeting })
          return
        }

        default:
          return
      }
    },
    [beginRun, greeting, guard, markResolved, runInvestigation],
  )

  const reset = useCallback(() => runAction('restart'), [runAction])

  const suggestedActions = useMemo(() => getSuggestedActions(state), [state])

  return {
    state,
    workflow: state.workflow,
    messages: state.messages,
    suggestedActions,
    busy: isBusy(state.workflow),
    sendMessage,
    runAction,
    reset,
  }
}
