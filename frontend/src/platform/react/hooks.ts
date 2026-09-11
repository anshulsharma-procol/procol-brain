import { useCallback, useEffect, useRef, useState } from 'react'
import { consoleApi } from '../api'
import type { StreamTarget } from '../api/types'
import type {
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
function useStream(target: StreamTarget | undefined, onMessage: (detail?: TicketDetail) => void) {
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

    return consoleApi.subscribe(resolved, (message) => {
      handler.current(message.type === 'ticket.updated' ? message.detail : undefined)
    })
  }, [kind, key])
}

export function useTickets(): AsyncState<Ticket[]> & { reload: () => void } {
  const { workspace } = useWorkspace()
  const state = useAsync(`tickets:${workspace.id}`, () => consoleApi.listTickets(workspace.id))

  // Any run that advances anywhere in the workspace refreshes the board.
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

  useEffect(() => {
    if (!ticketRef) return
    let live = true

    consoleApi
      .getTicket(ticketRef)
      .then((detail) => {
        if (live) setResult({ key: ticketRef, data: detail })
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

  useStream(
    ticketRef ? { kind: 'ticket', ticketRef } : undefined,
    useCallback(
      (detail?: TicketDetail) => {
        if (detail) setResult({ key: detail.ticket.reference, data: detail })
      },
      [],
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
