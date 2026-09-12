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
const chatBaseUrl = import.meta.env.VITE_BRAIN_CHAT_API_URL as string | undefined

/**
 * Sent on every request, always.
 *
 * A free ngrok tunnel answers a browser with an HTML interstitial rather than
 * the JSON asked for, and this header is the documented way past it. It is
 * meaningless to any other host, so it costs nothing to send unconditionally
 * and removes a failure that presents as "the backend returned HTML".
 *
 * It cannot help `EventSource`, which has no way to set headers — so if a
 * tunnel ever does interstitial the live transcript, the answer is to serve
 * the API same-origin through the dev proxy (`VITE_BRAIN_API_URL=/api`)
 * rather than to add anything here.
 */
const NGROK_BYPASS = { 'ngrok-skip-browser-warning': 'true' }

export const consoleApi: ConsoleApi = baseUrl
  ? createHttpConsoleApi({
      baseUrl,
      headers: token ? { ...NGROK_BYPASS, Authorization: `Bearer ${token}` } : NGROK_BYPASS,
    })
  : createFixtureConsoleApi()

/** True while the console is running on captured fixtures. Shown in the UI. */
export const isDemoData = !baseUrl

/**
 * Where the embedded chat widget should point.
 *
 * The customer-facing API keeps its own vocabulary under `/chat`, so by
 * default one variable configures both surfaces — and both read the same
 * tickets, which is the point: a customer raising an issue in their own
 * dashboard lands on our board immediately.
 *
 * `VITE_BRAIN_CHAT_API_URL` overrides that when the two surfaces are not on
 * one service. They are separate products and a backend may implement only
 * the console's half: the deployment this console currently points at serves
 * 25 endpoints and none of them is a `/chat` route, so without an override
 * every widget call 404s — search, raising a ticket, and the poll that waits
 * on an investigation alike. Pointing the widget at a service that does serve
 * `/chat` keeps both working while the deployed Brain catches up.
 */
export const chatApiBaseUrl =
  chatBaseUrl?.replace(/\/+$/, '') ?? (baseUrl ? `${baseUrl.replace(/\/+$/, '')}/chat` : undefined)

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
