#!/usr/bin/env node
/**
 * Is the Brain reachable, and does it still speak what this console reads?
 *
 *   node scripts/check-backend.mjs [origin]
 *
 * Defaults to VITE_BRAIN_API_TARGET from .env.local. Every request carries
 * ngrok's bypass header, so this checks the same path the dev proxy takes —
 * not a friendlier one.
 *
 * It answers three questions in order, because a failure in one makes the
 * next meaningless:
 *
 *   1. Is the tunnel up at all? A dead ngrok endpoint answers 404 with an
 *      HTML page, which parses as neither JSON nor a useful error.
 *   2. Does each endpoint the console calls answer?
 *   3. Does the response still carry the fields the console dereferences?
 */
import { readFileSync } from 'node:fs'

function envTarget() {
  for (const file of ['.env.local', '.env']) {
    let text
    try {
      text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    } catch {
      continue // Not there; try the next one.
    }

    // Whichever variable actually names a host. `VITE_BRAIN_API_URL` wins
    // because it is what the app calls; it carries the `/api` base path, so
    // take its origin. `/api` on its own names no host, which is the case
    // where the app goes through the dev proxy and TARGET is the real one.
    for (const key of ['VITE_BRAIN_API_URL', 'VITE_BRAIN_API_TARGET']) {
      const value = text.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, 'm'))?.[1].trim()
      if (!value || !/^https?:\/\//.test(value)) continue
      return new URL(value).origin
    }
  }
  return 'http://localhost:4000'
}

const ORIGIN = (process.argv[2] ?? envTarget()).replace(/\/+$/, '')
const HEADERS = { 'ngrok-skip-browser-warning': 'true', accept: 'application/json' }

const GREEN = '[32m'
const RED = '[31m'
const YELLOW = '[33m'
const OFF = '[0m'

let failures = 0
let skipped = 0

const ok = (label, note = '') => console.log(`  ${GREEN}PASS${OFF} ${label}${note ? ` — ${note}` : ''}`)
const bad = (label, why) => {
  failures += 1
  console.log(`  ${RED}FAIL${OFF} ${label} — ${why}`)
}
const meh = (label, why) => {
  skipped += 1
  console.log(`  ${YELLOW}SKIP${OFF} ${label} — ${why}`)
}

async function json(method, path, body) {
  const response = await fetch(`${ORIGIN}${path}`, {
    method,
    headers: { ...HEADERS, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })

  const text = await response.text()
  const type = response.headers.get('content-type') ?? ''

  if (!type.includes('application/json')) {
    const ngrok = text.match(/ERR_NGROK_\d+/)?.[0]
    throw new Error(
      ngrok
        ? `${ngrok} — the tunnel is not serving this backend`
        : `${response.status} returned ${type || 'no content-type'}, not JSON`,
    )
  }

  return { status: response.status, body: JSON.parse(text) }
}

/** Reach into a response the way the console does, and say so when it is not there. */
function has(value, path) {
  return (
    path.split('.').reduce((node, key) => (node == null ? undefined : node[key]), value) !== undefined
  )
}

async function check(label, run) {
  try {
    const note = await run()
    ok(label, note ?? '')
  } catch (error) {
    bad(label, error.message)
  }
}

console.log(`\nBrain at ${ORIGIN}\n`)

// -- 1. Is anything there? --------------------------------------------------

try {
  const health = await json('GET', '/health')
  console.log(
    `  tunnel up — ${JSON.stringify({
      service: health.body.service ?? 'unnamed',
      demoMode: health.body.DEMO_MODE ?? health.body.demoMode ?? null,
      agentMode: health.body.AGENT_MODE ?? health.body.agentMode ?? null,
    })}\n`,
  )
} catch (error) {
  console.log(`  ${RED}The backend is not reachable.${OFF} ${error.message}\n`)
  console.log('  If this is ngrok, restart the tunnel and put the new host into')
  console.log('  frontend/.env.local (VITE_BRAIN_API_URL) and DEMO-CURLS.md.\n')
  process.exit(1)
}

// -- 2 & 3. Every endpoint the console calls, and the fields it reads -------

console.log('Board')

let firstTicket

await check('GET /api/tickets', async () => {
  const { body } = await json('GET', '/api/tickets?workspace=procol')
  if (!Array.isArray(body.data)) throw new Error('no `data` array')
  firstTicket = body.data[0]?.id
  const missing = ['id', 'title', 'status', 'priority', 'createdAt'].filter(
    (key) => body.data[0] && !has(body.data[0], key),
  )
  if (missing.length) throw new Error(`rows missing ${missing.join(', ')}`)
  return `${body.data.length} tickets`
})

await check('GET /api/stats', async () => {
  const { body } = await json('GET', '/api/stats?workspace=procol')
  const missing = ['active', 'aiWorking', 'needsApproval', 'resolvedToday', 'avgResolutionMins'].filter(
    (key) => !has(body, key),
  )
  if (missing.length) throw new Error(`missing ${missing.join(', ')}`)
  return JSON.stringify(body)
})

await check('GET /api/agents', async () => {
  const { body } = await json('GET', '/api/agents?workspace=procol')
  if (!Array.isArray(body.data)) throw new Error('no `data` array')
  const agent = body.data[0]
  const missing = ['id', 'name', 'status', 'capabilities', 'tools'].filter((k) => !has(agent, k))
  return missing.length
    ? `${body.data.length} agents, rows lack ${missing.join(', ')} (console falls back)`
    : `${body.data.length} agents`
})

await check('GET /api/connectors', async () => {
  const { body } = await json('GET', '/api/connectors?workspace=procol')
  if (!Array.isArray(body.data)) throw new Error('no `data` array')
  if (body.data[0] && !has(body.data[0], 'health.ok')) throw new Error('rows lack health.ok')
  return `${body.data.length} connectors`
})

console.log('\nTicket detail')

const target = firstTicket ?? 'PRO-1245'

let hasImpact = false

await check(`GET /api/tickets/${target}`, async () => {
  const { body } = await json('GET', `/api/tickets/${target}`)
  const missing = ['ticket.id', 'ticket.status'].filter((key) => !has(body, key))
  if (missing.length) throw new Error(`missing ${missing.join(', ')}`)
  const kinds = (body.artifacts ?? []).map((a) => a.kind)
  hasImpact = kinds.includes('IMPACT')
  return `run=${body.run?.state ?? 'none'} artifacts=[${kinds.join(', ')}]`
})

await check(`GET /api/tickets/${target}/activities`, async () => {
  const { body } = await json('GET', `/api/tickets/${target}/activities`)
  const rows = Array.isArray(body) ? body : body.data
  if (!Array.isArray(rows)) throw new Error('neither an array nor `{data}`')
  if (!rows.length) return 'no rows yet'

  // The console orders on seq and dedupes on id; everything else it can infer.
  for (const key of ['id', 'seq', 'type']) {
    if (!has(rows[0], key)) throw new Error(`rows lack \`${key}\``)
  }

  // Which envelope is this backend speaking? Both are handled, but say which.
  const flat = has(rows[0], 'createdAt') && !has(rows[0], 'at')
  return `${rows.length} rows, ${flat ? 'flat envelope (fromAgent/title/createdAt)' : 'contract envelope (from/text/at)'}`
})

await check(`GET /api/tickets/${target}/tasks`, async () => {
  const { body } = await json('GET', `/api/tickets/${target}/tasks`)
  const rows = Array.isArray(body) ? body : body.data
  if (!Array.isArray(rows)) throw new Error('neither an array nor `{data}`')
  return `${rows.length} delegations`
})

console.log('\nLens')

await check('POST /api/ask', async () => {
  const { body } = await json('POST', '/api/ask', {
    question: 'Which category manager saved the most this quarter?',
  })
  if (!has(body, 'shape')) throw new Error('no `shape`')
  const cols = body.columns
  const kind = Array.isArray(cols) && typeof cols[0] === 'string' ? 'string columns' : 'object columns'
  return `shape=${body.shape}, ${kind}, sql=${body.sql ? 'yes' : 'no'}`
})

// Blast radius is computed off the run's IMPACT artifact, so a ticket that
// never produced one legitimately has no insights. Absent is only a failure
// when the artifact is there and the endpoint still will not answer.
if (!hasImpact) {
  meh('GET /api/insights', `${target} has no IMPACT artifact — nothing to report on`)
} else {
  await check('GET /api/insights', async () => {
    const { body } = await json('GET', `/api/insights?ticketId=${target}`)
    if (!has(body, 'affectedRecords')) throw new Error('no `affectedRecords`')
    return `${body.affectedTenants} tenants, ${body.affectedRecords} records`
  })
}

console.log('\nFlow and governance')

await check('GET /api/processes', async () => {
  const { body } = await json('GET', '/api/processes')
  if (!Array.isArray(body.data)) throw new Error('no `data` array')
  return body.data.map((p) => p.key).join(', ')
})

await check('GET /api/policies', async () => {
  const { body } = await json('GET', '/api/policies')
  if (!Array.isArray(body.data)) throw new Error('no `data` array')
  return `${body.data.length} policies`
})

// -- Extensions: absent is fine, the console hides those panels -------------

console.log('\nExtensions (optional — the console hides these when absent)')

for (const [label, path] of [
  ['GET /api/workspaces', '/api/workspaces'],
  ['GET /api/memory', '/api/memory?workspace=procol'],
  ['GET /api/knowledge', '/api/knowledge?workspace=procol'],
  ['GET /api/connection-types', '/api/connection-types'],
]) {
  try {
    const { body } = await json('GET', path)
    ok(label, Array.isArray(body.data) ? `${body.data.length} rows` : 'present')
  } catch (error) {
    meh(label, error.message)
  }
}

// -- SSE, the one the proxy exists for -------------------------------------

console.log('\nLive transcript')

await check(`GET /api/tickets/${target}/stream`, async () => {
  const response = await fetch(`${ORIGIN}/api/tickets/${target}/stream`, {
    headers: { ...HEADERS, accept: 'text/event-stream' },
    signal: AbortSignal.timeout(12_000),
  })

  const type = response.headers.get('content-type') ?? ''
  if (!type.includes('text/event-stream')) throw new Error(`content-type is ${type || 'unset'}`)

  // Read one chunk and let go — an SSE stream stays open by design, so
  // waiting for it to finish would wait forever.
  const reader = response.body.getReader()
  try {
    const first = await Promise.race([
      reader.read().then(({ value }) => new TextDecoder().decode(value ?? new Uint8Array())),
      new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
    ])
    return first
      ? `open, first frame: ${first.trim().split('\n')[0]}`
      : 'open, idle (no run in flight)'
  } finally {
    await reader.cancel().catch(() => {})
  }
})

console.log(
  `\n${failures ? `${RED}${failures} failed${OFF}` : `${GREEN}all green${OFF}`}` +
    `${skipped ? `, ${skipped} optional endpoint(s) absent` : ''}\n`,
)

process.exit(failures ? 1 : 0)
