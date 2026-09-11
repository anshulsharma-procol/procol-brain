import { createHttpConsoleApi } from './httpApi'
import { MockConsoleApi } from './mockApi'
import type { ConsoleApi } from './types'

/**
 * ============================================================================
 *  THE ONE LINE THAT SWITCHES THE PRODUCT ON
 * ============================================================================
 *
 * No `VITE_BRAIN_API_URL` -> the scripted control towers in `scenarios/`.
 * With one          -> the live Brain API, same interface, same screens.
 *
 *   # .env.local
 *   VITE_BRAIN_API_URL=https://brain.procol.in/api
 *   VITE_BRAIN_API_TOKEN=...            # optional
 *
 * Nothing else in the application reads `import.meta.env`.
 */
const baseUrl = import.meta.env.VITE_BRAIN_API_URL as string | undefined
const token = import.meta.env.VITE_BRAIN_API_TOKEN as string | undefined

export const consoleApi: ConsoleApi = baseUrl
  ? createHttpConsoleApi({
      baseUrl,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
  : new MockConsoleApi()

/** True while the console is running on scripted data. Shown in the UI. */
export const isDemoData = !baseUrl

export { createHttpConsoleApi, MockConsoleApi }
export type { ConsoleApi } from './types'
export type {
  CreateTicketInput,
  DecisionInput,
  StreamListener,
  StreamMessage,
  StreamTarget,
  TicketFilter,
  Unsubscribe,
} from './types'
