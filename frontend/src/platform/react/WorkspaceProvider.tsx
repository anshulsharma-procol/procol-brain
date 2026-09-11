import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { consoleApi } from '../api'
import type { Workspace } from '../types'
import { WorkspaceContext, type WorkspaceContextValue } from './workspaceContext'

const STORAGE_KEY = 'brain.workspace'

function preferredWorkspaceId(): string | undefined {
  if (typeof window === 'undefined') return undefined

  // `?workspace=acmecloud` wins, so a demo can be deep-linked.
  const fromUrl = new URLSearchParams(window.location.search).get('workspace')
  if (fromUrl) return fromUrl

  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined
  } catch {
    // Private browsing, blocked storage: the default is fine.
    return undefined
  }
}

/**
 * Which control tower the console is driving.
 *
 * The list comes from the backend, not from a file: the contract has no
 * workspace concept, so a service that serves one tenant reports one, and the
 * switcher is simply not worth showing. A service that serves several reports
 * several. Either way this is the only place that decides.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [workspaceId, setStoredWorkspaceId] = useState<string | undefined>(preferredWorkspaceId)

  useEffect(() => {
    let live = true

    consoleApi
      .listWorkspaces()
      .then((loaded) => {
        if (live) setWorkspaces(loaded)
      })
      .catch(() => {
        // A registry we cannot read is not a reason to show nothing: the
        // board and the ticket pages do not depend on it.
        if (live) setWorkspaces([])
      })

    return () => {
      live = false
    }
  }, [])

  const setWorkspaceId = useCallback((id: string) => {
    setStoredWorkspaceId(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Remembering the choice is a convenience, never a requirement.
    }
  }, [])

  const value = useMemo<WorkspaceContextValue>(() => {
    const active =
      workspaces.find((workspace) => workspace.id === workspaceId) ?? workspaces[0] ?? PLACEHOLDER

    return { workspace: active, workspaces, setWorkspaceId, loading: workspaces.length === 0 }
  }, [workspaces, workspaceId, setWorkspaceId])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

/** Rendered for the moment before the registry arrives. */
const PLACEHOLDER: Workspace = {
  id: 'default',
  name: 'Control tower',
  product: '',
  ticketPrefix: 'TKT',
  tagline: '',
  accent: 'violet',
  supportEmailDomain: '',
  agents: [],
  connectors: [],
  approvalPolicies: [],
}
