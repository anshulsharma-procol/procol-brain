import { createContext, useContext } from 'react'
import type { Workspace } from '../types'

export interface WorkspaceContextValue {
  workspace: Workspace
  workspaces: Workspace[]
  setWorkspaceId: (id: string) => void
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

/** Which control tower the console is currently driving. */
export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside <WorkspaceProvider>')
  return value
}
