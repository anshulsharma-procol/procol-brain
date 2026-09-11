import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_WORKSPACE_ID, getWorkspace, WORKSPACES } from '../workspaces'
import { WorkspaceContext, type WorkspaceContextValue } from './workspaceContext'

const STORAGE_KEY = 'brain.workspace'

function initialWorkspaceId(): string {
  if (typeof window === 'undefined') return DEFAULT_WORKSPACE_ID

  // `?workspace=acmecloud` wins, so a demo can be deep-linked.
  const fromUrl = new URLSearchParams(window.location.search).get('workspace')
  if (fromUrl && WORKSPACES.some((workspace) => workspace.id === fromUrl)) return fromUrl

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && WORKSPACES.some((workspace) => workspace.id === stored)) return stored
  } catch {
    // Private browsing, blocked storage: fall through to the default.
  }

  return DEFAULT_WORKSPACE_ID
}

/**
 * Puts one company's control tower in context.
 *
 * The switcher below this provider is not a demo toy: it is the product claim
 * made clickable. Every screen reads the workspace instead of hardcoding a
 * company, which is the reason one build serves Procol and AcmeCloud.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setStoredWorkspaceId] = useState(initialWorkspaceId)

  const setWorkspaceId = useCallback((id: string) => {
    setStoredWorkspaceId(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // Remembering the choice is a convenience, never a requirement.
    }
  }, [])

  const value = useMemo<WorkspaceContextValue>(
    () => ({ workspace: getWorkspace(workspaceId), workspaces: WORKSPACES, setWorkspaceId }),
    [workspaceId, setWorkspaceId],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}
