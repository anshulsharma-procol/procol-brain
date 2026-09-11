import { acmeAuthScenario } from './acme-auth'
import { procolGstScenario } from './procol-gst'
import { procolVendorAccessScenario } from './procol-vendor-access'
import type { Scenario } from './types'

/**
 * Every scripted run the console can replay. A new customer case is a new
 * file in this folder and one more line here.
 */
export const SCENARIOS: Scenario[] = [
  procolGstScenario,
  procolVendorAccessScenario,
  acmeAuthScenario,
]

export function scenariosForWorkspace(workspaceId: string): Scenario[] {
  return SCENARIOS.filter((scenario) => scenario.workspaceId === workspaceId)
}

export { acmeAuthScenario, procolGstScenario, procolVendorAccessScenario }
export type { Scenario, ScenarioEvent, BackgroundTicket } from './types'
