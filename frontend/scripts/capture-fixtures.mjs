#!/usr/bin/env node
/**
 * Captures a live service's responses into src/platform/api/fixtures.json,
 * in the shape contract §5 describes: one object keyed by "METHOD /path".
 *
 *   node scripts/capture-fixtures.mjs [http://localhost:4000/api]
 *
 * Run it whenever the seeded board changes. The fixtures are what the console
 * falls back to with the backend stopped, so a stale capture shows a stale
 * board — not a broken one.
 */
import { writeFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:4000/api'
const out = {}

async function capture(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    console.warn(`  skip ${method} ${path} (${response.status})`)
    return undefined
  }

  const json = await response.json()
  out[`${method} ${path}`] = json
  return json
}

const workspaces = (await capture('GET', '/workspaces'))?.data ?? [{ id: '' }]

await capture('GET', '/agents')
await capture('GET', '/connectors')
await capture('GET', '/processes')

for (const workspace of workspaces) {
  const scope = workspace.id ? `?workspace=${encodeURIComponent(workspace.id)}` : ''
  await capture('GET', `/stats${scope}`)
  await capture('GET', `/agents${scope}`)
  await capture('GET', `/connectors${scope}`)
  await capture('GET', `/memory${scope}`)
  await capture('GET', `/knowledge${scope}`)

  const tickets = (await capture('GET', `/tickets${scope}`))?.data ?? []

  for (const ticket of tickets) {
    const detail = await capture('GET', `/tickets/${encodeURIComponent(ticket.id)}`)
    await capture('GET', `/tickets/${encodeURIComponent(ticket.id)}/activities`)

    if (!detail) continue
    await capture('POST', `/memory/search${scope}`, {
      query: `${detail.ticket.title} ${detail.ticket.description}`,
    })
  }
}

const path = new URL('../src/platform/api/fixtures.json', import.meta.url).pathname
writeFileSync(path, `${JSON.stringify(out, null, 2)}\n`)
console.log(`\ncaptured ${Object.keys(out).length} responses -> src/platform/api/fixtures.json`)
