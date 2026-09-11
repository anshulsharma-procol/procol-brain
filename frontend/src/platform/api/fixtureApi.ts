import fixtures from './fixtures.json'
import { createHttpConsoleApi } from './httpApi'
import type { ConsoleApi } from './types'

/**
 * ============================================================================
 *  THE OFFLINE FALLBACK — contract §5
 * ============================================================================
 *
 * A snapshot of real responses, keyed by endpoint, served through the *same*
 * client as the network path. `fixtures.json` is captured from a running
 * service with `npm run fixtures:capture`.
 *
 * Doing it this way rather than writing a second in-memory simulation buys
 * three things: there is only one implementation of the contract on this side
 * to keep correct, the fixtures are parsed by exactly the code the live path
 * uses, and a fixture that has drifted from the contract fails in the same
 * place a real response would.
 *
 * What it cannot do is stream, so nothing moves on its own here. That is the
 * honest shape of a fallback: the console is browsable with the backend
 * stopped, and a live run needs the service.
 */
const NOT_FOUND = {
  error: { code: 'NOT_FOUND', message: 'Not in the captured fixtures' },
}

type FixtureMap = Record<string, unknown>

function lookup(method: string, path: string): unknown {
  const map = fixtures as FixtureMap
  const exact = map[`${method} ${path}`]
  if (exact !== undefined) return exact

  // A query this snapshot did not capture falls back to the unscoped
  // response, so an unfamiliar workspace still renders something coherent.
  const withoutQuery = path.split('?')[0]!
  return map[`${method} ${withoutQuery}`]
}

export function createFixtureConsoleApi(): ConsoleApi {
  const fixtureFetch: typeof globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const method = (init?.method ?? 'GET').toUpperCase()
    const body = lookup(method, url)

    if (body === undefined) {
      return new Response(JSON.stringify(NOT_FOUND), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return createHttpConsoleApi({ baseUrl: '', fetch: fixtureFetch, streaming: false })
}
