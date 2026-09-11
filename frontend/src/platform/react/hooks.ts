import { useCallback, useEffect, useRef, useState } from 'react'
import { consoleApi } from '../api'
import type { StreamMessage, StreamTarget } from '../api/types'
import type {
  ActivityEvent,
  DecisionOutcome,
  KnowledgeEntry,
  MemoryEntry,
  Ticket,
  TicketDetail,
  WorkspaceStats,
} from '../types'
import { useWorkspace } from './workspaceContext'

/**
 * Data hooks. Every screen gets its data from here, and none of them know
 * whether it came from a scenario file or from the Brain API.
 */

export interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: string | undefined
}

interface Result<T> {
  /** Which request produced this. Anything else on screen is stale. */
  key: string
  data?: T
  error?: string
}

/**
 * Runs a loader whenever `key` changes and drops results from stale calls.
 *
 * `loading` and `data` are derived from whether the stored result belongs to
 * the current key, rather than pushed into state up front — so switching
 * workspaces never shows the previous tenant's rows for a frame.
 */
function useAsync<T>(key: string, load: () => Promise<T>): AsyncState<T> & { reload: () => void } {
  const [result, setResult] = useState<Result<T>>({ key: '' })
  const [nonce, setNonce] = useState(0)

  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    let live = true

    loadRef
      .current()
      .then((data) => {
        if (live) setResult({ key, data })
      })
      .catch((error: unknown) => {
        if (!live) return
        setResult({
          key,
          // A calm sentence, never a stack trace.
          error: error instanceof Error ? error.message : 'Lost connection to Brain.',
        })
      })

    return () => {
      live = false
    }
  }, [key, nonce])

  const current = result.key === key ? result : undefined

  return {
    data: current?.data,
    error: current?.error,
    loading: current === undefined,
    reload: useCallback(() => setNonce((value) => value + 1), []),
  }
}

/** Live-updating stream subscription, shared by the board and the ticket page. */
function useStream(target: StreamTarget | undefined, onMessage: (message: StreamMessage) => void) {
  const handler = useRef(onMessage)
  useEffect(() => {
    handler.current = onMessage
  })

  const kind = target?.kind
  const key = target ? (target.kind === 'ticket' ? target.ticketRef : target.workspaceId) : undefined

  useEffect(() => {
    if (!kind || !key) return

    const resolved: StreamTarget =
      kind === 'ticket' ? { kind: 'ticket', ticketRef: key } : { kind: 'workspace', workspaceId: key }

    return consoleApi.subscribe(resolved, (message) => handler.current(message))
  }, [kind, key])
}

/**
 * The board re-reads when a run advances.
 *
 * A ticket list is a summary of many runs, and the contract's events describe
 * one step of one run — reconstructing the list from them would be a second,
 * subtly different implementation of the backend's own ordering. Re-reading is
 * cheap and cannot drift. The ticket page, where the timeline matters, appends
 * instead.
 */
export function useTickets(): AsyncState<Ticket[]> & { reload: () => void } {
  const { workspace } = useWorkspace()
  const state = useAsync(`tickets:${workspace.id}`, () => consoleApi.listTickets(workspace.id))

  useStream({ kind: 'workspace', workspaceId: workspace.id }, state.reload)

  return state
}

export function useStats(): AsyncState<WorkspaceStats> {
  const { workspace } = useWorkspace()
  const state = useAsync(`stats:${workspace.id}`, () => consoleApi.getStats(workspace.id))
  useStream({ kind: 'workspace', workspaceId: workspace.id }, state.reload)
  return state
}

/**
 * One ticket, kept current by the stream. The initial fetch and the stream
 * write into the same piece of state, so a refresh mid-run rebuilds exactly
 * the timeline that was on screen.
 */
export function useTicketDetail(ticketRef: string | undefined) {
  const key = ticketRef ?? ''
  const { workspace, setWorkspaceId } = useWorkspace()
  const [result, setResult] = useState<Result<TicketDetail>>({ key: '' })
  /**
   * Activity ids already on screen, from the history fetch and from the
   * stream alike. The contract puts `activityId` on every event for exactly
   * this: without it the entry at the boundary between the two renders twice,
   * which is the commonest bug in a timeline like this one.
   */
  const seen = useRef(new Set<string>())

  useEffect(() => {
    if (!ticketRef) return
    let live = true

    seen.current = new Set()

    consoleApi
      .getTicket(ticketRef)
      .then((detail) => {
        if (!live) return
        for (const row of detail.activity) seen.current.add(row.id)
        setResult({ key: ticketRef, data: detail })
      })
      .catch((cause: unknown) => {
        if (!live) return
        setResult({
          key: ticketRef,
          error: cause instanceof Error ? cause.message : 'Lost connection to Brain.',
        })
      })

    return () => {
      live = false
    }
  }, [ticketRef])

  const refresh = useCallback(() => {
    if (!ticketRef) return

    void consoleApi.getTicket(ticketRef).then((detail) => {
      for (const row of detail.activity) seen.current.add(row.id)
      setResult({ key: ticketRef, data: detail })
    })
  }, [ticketRef])

  useStream(
    ticketRef ? { kind: 'ticket', ticketRef } : undefined,
    useCallback(
      (message: StreamMessage) => {
        if (message.type !== 'activity') return

        const row = message.activity
        // Dedupe on the id, order on the seq. Both travel on the row itself,
        // which is what makes the history/stream boundary safe: the entry
        // that arrives on the stream and the one already fetched are the
        // same object, so it cannot render twice.
        if (seen.current.has(row.id)) return
        seen.current.add(row.id)

        // Not ticket-scoped, by the contract's own rule. Keep it off the
        // timeline rather than letting a seq of -1 sort it to the top.
        if (row.type === 'agent.status') return

        // Events that change more than the timeline — an artifact appearing,
        // a run reaching the gate or closing — are re-read rather than
        // reconstructed, so the page and the backend cannot disagree about a
        // ticket's state.
        if (RE_READ.has(row.type)) {
          refresh()
          return
        }

        setResult((current) => {
          if (!current.data) return current

          return {
            ...current,
            data: {
              ...current.data,
              activity: [...current.data.activity, row].sort((a, b) => a.seq - b.seq),
            },
          }
        })
      },
      [refresh],
    ),
  )

  const startInvestigation = useCallback(async () => {
    if (!ticketRef) return
    await consoleApi.startInvestigation(ticketRef)
  }, [ticketRef])

  const decide = useCallback(
    async (outcome: DecisionOutcome, by: string, note?: string) => {
      if (!ticketRef) return
      const detail = await consoleApi.submitDecision(ticketRef, { outcome, by, note })
      setResult({ key: ticketRef, data: detail })
    },
    [ticketRef],
  )

  const current = result.key === key ? result : undefined
  const ticketWorkspaceId = current?.data?.ticket.workspaceId

  // A link into another company's ticket switches the console to that control
  // tower, so the sidebar, the agent names and the memory all belong to the
  // company whose ticket is on screen.
  useEffect(() => {
    if (ticketWorkspaceId && ticketWorkspaceId !== workspace.id) {
      setWorkspaceId(ticketWorkspaceId)
    }
  }, [ticketWorkspaceId, workspace.id, setWorkspaceId])

  return {
    detail: current?.data,
    error: current?.error,
    loading: current === undefined,
    startInvestigation,
    decide,
  }
}

/**
 * Events whose consequence is not just another line on the timeline. The
 * cheapest correct response to these is to re-read the ticket.
 */
const RE_READ = new Set<ActivityEvent['type']>([
  'artifact.created',
  'run.awaiting_approval',
  'run.completed',
  'ticket.created',
])

export function useMemory(): AsyncState<MemoryEntry[]> {
  const { workspace } = useWorkspace()
  const state = useAsync(`memory:${workspace.id}`, () => consoleApi.listMemory(workspace.id))
  useStream({ kind: 'workspace', workspaceId: workspace.id }, state.reload)
  return state
}

export function useKnowledge(): AsyncState<KnowledgeEntry[]> {
  const { workspace } = useWorkspace()
  return useAsync(`knowledge:${workspace.id}`, () => consoleApi.listKnowledge(workspace.id))
}
