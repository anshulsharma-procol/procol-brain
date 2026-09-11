/**
 * The Brain console platform: a tenant-agnostic control tower.
 *
 *   types.ts      the domain model — no company appears in it
 *   workspaces/   one file per customer control tower
 *   scenarios/    one file per end-to-end case, written as data
 *   seed/         knowledge base and institutional memory
 *   api/          ConsoleApi + the mock and HTTP implementations
 *   react/        provider, hooks and role-based visuals
 */
export * from './types'
export { consoleApi, isDemoData } from './api'
export type { ConsoleApi } from './api'
export { agentByRole, agentsByCapability, findAgent, getWorkspace, WORKSPACES } from './workspaces'
export { SCENARIOS, scenariosForWorkspace } from './scenarios'
export * from './react'
