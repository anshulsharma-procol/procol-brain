import { createFixtureConsoleApi } from './fixtureApi'
import { createHttpConsoleApi } from './httpApi'
import type { ConsoleApi } from './types'

/**
 * ============================================================================
 *  THE ONE LINE THAT POINTS THE CONSOLE AT A BACKEND
 * ============================================================================
 *
 *   # frontend/.env.local
 *   VITE_BRAIN_API_URL=https://brain.procol.in/api
 *   VITE_BRAIN_API_TOKEN=...            # optional
 *
 * Any service that implements docs/API_CONTRACT.md works, because everything
 * above this line consumes the contract and nothing else. Point it at a
 * different host and the console is pointed at a different backend — that is
 * the whole migration.
 *
 * Unset, it serves the captured fixtures in `fixtures.json`, so the console
 * is browsable with the service stopped. Nothing streams in that mode; a live
 * run needs the API.
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
  : createFixtureConsoleApi()

/** True while the console is running on captured fixtures. Shown in the UI. */
export const isDemoData = !baseUrl

/**
 * Where the embedded chat widget should point.
 *
 * The customer-facing API keeps its own vocabulary under `/chat` on the same
 * service, so one variable configures both surfaces — and both read the same
 * tickets, which is the point: a customer raising an issue in their own
 * dashboard lands on our board immediately.
 */
export const chatApiBaseUrl = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/chat` : undefined

export { createHttpConsoleApi, createFixtureConsoleApi }
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
