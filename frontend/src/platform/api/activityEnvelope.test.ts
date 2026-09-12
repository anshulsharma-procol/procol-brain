/**
 * The transcript is the demo, and it is the one thing that breaks silently
 * when a backend changes shape: every row still arrives, they just stop
 * carrying anything the renderer reads. So this feeds the deployed Brain's
 * real rows all the way through to the exchanges the transcript draws, and
 * asserts there is something on the screen at the end of it.
 *
 *   npm test
 *
 * The flat rows below are copied verbatim from
 * `GET /api/tickets/PRO-1245/activities` on the tunnelled deployment. If that
 * backend changes its envelope again, this fails here rather than on stage.
 */
import { normaliseActivities } from './activityEnvelope'
import { toExchanges } from '../../utils/exchanges'
import { normaliseArtifact } from './httpApi'
import type { ActivityDto } from '../contract'

/** Verbatim from the deployed Brain. Flat: one shape for every type. */
const FLAT = [
  {
    id: '4d76ed2f-9060-4d21-bda2-f34d8e31400d',
    ticketId: 'PRO-1245',
    runId: 'cmtxkr45m0001s4p0065qepre',
    seq: 1,
    type: 'run.started',
    fromAgent: null,
    toAgent: null,
    title: 'Run started for PRO-1245',
    body: null,
    level: 'info',
    createdAt: '2026-09-11T23:15:40.048Z',
  },
  {
    id: 'row-2',
    ticketId: 'PRO-1245',
    runId: 'r1',
    seq: 2,
    type: 'ticket.created',
    fromAgent: null,
    toAgent: null,
    title: 'PRO-1245 raised',
    body: 'Our March invoices are showing GST of 12% instead of 18%.',
    level: 'info',
    createdAt: '2026-09-11T23:15:40.100Z',
  },
  {
    id: 'row-3',
    ticketId: 'PRO-1245',
    runId: 'r1',
    seq: 3,
    type: 'brain.thought',
    fromAgent: 'brain',
    toAgent: null,
    title: 'Investigation started',
    body: 'Classified as a billing defect, high priority.',
    level: 'info',
    createdAt: '2026-09-11T23:15:41.000Z',
  },
  {
    id: 'row-4',
    ticketId: 'PRO-1245',
    runId: 'r1',
    seq: 4,
    type: 'a2a.request',
    fromAgent: 'brain',
    toAgent: 'clara',
    title: 'Get product context',
    body: null,
    level: 'info',
    createdAt: '2026-09-11T23:15:42.000Z',
  },
  {
    id: 'row-5',
    ticketId: 'PRO-1245',
    runId: 'r1',
    seq: 5,
    type: 'agent.log',
    fromAgent: 'clara',
    toAgent: null,
    title: null,
    body: 'Searched 3 knowledge sources',
    level: 'info',
    createdAt: '2026-09-11T23:15:43.000Z',
  },
  {
    id: 'row-6',
    ticketId: 'PRO-1245',
    runId: 'r1',
    seq: 6,
    type: 'a2a.response',
    fromAgent: 'clara',
    toAgent: 'brain',
    title: 'Tax config returned',
    body: 'GST slab table is stale for FY26.',
    level: 'info',
    createdAt: '2026-09-11T23:15:44.000Z',
  },
  {
    id: 'row-7',
    ticketId: 'PRO-1245',
    runId: 'r1',
    seq: 7,
    type: 'run.awaiting_approval',
    fromAgent: 'brain',
    toAgent: null,
    title: 'Waiting for approval',
    body: 'Code changes to billing always require human approval.',
    level: 'warn',
    createdAt: '2026-09-11T23:15:59.000Z',
  },
]

/** The in-repo backend's envelope. It must come through completely untouched. */
const CONTRACT = [
  {
    id: 'act_1',
    seq: 1,
    type: 'brain.thought',
    ticketId: 'PRO-1245',
    at: '2026-09-11T22:37:49.346Z',
    text: 'Investigation started\n\nClassified as a billing defect.',
    heading: 'Investigation started',
    detail: 'Classified as a billing defect.',
  },
]

let failures = 0

function check(label: string, condition: boolean, detail = ''): void {
  if (!condition) failures += 1
  console.log(`  ${condition ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`)
}

const find = <T,>(rows: ActivityDto[], type: string): T | undefined =>
  rows.find((row) => row.type === type) as T | undefined

console.log('\nthe deployed Brain’s flat envelope')

const flat = normaliseActivities(FLAT)

check('every row survives', flat.length === FLAT.length, `${flat.length}/${FLAT.length}`)
check(
  'timestamps come off createdAt',
  flat.every((row) => row.at && !row.at.startsWith('1970')),
  flat[0]?.at,
)

const thought = find<{ text?: string }>(flat, 'brain.thought')
check('a thought carries text', Boolean(thought?.text))

const request = find<{ from?: string; to?: string; taskId?: string; summary?: string }>(
  flat,
  'a2a.request',
)
check('a hop knows both ends', request?.from === 'brain' && request?.to === 'clara')
check('a hop is summarised', Boolean(request?.summary), request?.summary)

const response = find<{ taskId?: string; from?: string; to?: string }>(flat, 'a2a.response')
check(
  'the response joins its request',
  Boolean(request?.taskId) && response?.taskId === request?.taskId,
)
check(
  'the response keeps the direction the request had',
  response?.from === 'brain' && response?.to === 'clara',
  `${response?.from} → ${response?.to}`,
)

const log = find<{ taskId?: string; line?: string }>(flat, 'agent.log')
check('a log line attaches to the open hop', log?.taskId === request?.taskId)
check('a log line keeps its text', Boolean(log?.line), log?.line)

console.log('\nthe transcript built from it')

const exchanges = toExchanges(flat as never)

check('is not empty', exchanges.length > 0, `${exchanges.length} exchanges`)
check(
  'every exchange says something',
  exchanges.every((exchange) => Boolean(exchange.title)),
)
check(
  'every exchange is timestamped',
  exchanges.every((exchange) => Boolean(exchange.at)),
)
check(
  'ticket.created renders rather than throwing',
  exchanges.some((exchange) => exchange.from === 'customer'),
)
check(
  'the hop carries the agent’s own log line',
  exchanges.some((exchange) => exchange.logs.length > 0),
)
check(
  'the approval gate reads as a gate',
  exchanges.some((exchange) => exchange.level === 'warn'),
)

for (const exchange of exchanges) {
  console.log(`       ${exchange.level.padEnd(7)} ${exchange.from} → ${exchange.to ?? '—'}  ${exchange.title}`)
}

console.log('\nthe in-repo backend’s envelope, unchanged')

const passthrough = normaliseActivities(CONTRACT)
check(
  'passes through byte for byte',
  JSON.stringify(passthrough[0]) === JSON.stringify(CONTRACT[0]),
)

const contractExchanges = toExchanges(passthrough as never)
check('still renders', contractExchanges.length === 1)
check('still bolds the heading', contractExchanges[0]?.title === 'Investigation started')

console.log('\nthe deployed Brain’s thin PR artifact')

// Verbatim from GET /api/tickets/PRO-1245 on the tunnelled deployment: a url
// and nothing else, where the contract's PrData has eight fields.
const thinPr = normaliseArtifact({
  id: 'a1',
  ticketId: 'PRO-1245',
  kind: 'PR',
  title: 'Pull request',
  createdAt: '2026-09-11T23:15:50.000Z',
  data: { url: 'https://github.com/ayush21kumar03/demo-repo/pull/12' },
} as never) as { data: Record<string, unknown> }

check('filesChanged is an array, so `.join()` and `[0]` cannot throw',
  Array.isArray(thinPr.data.filesChanged))
check('the PR number is recovered from the url', thinPr.data.number === 12,
  String(thinPr.data.number))
check('a PR with a url is treated as real, so it renders as a link',
  thinPr.data.real === true)
check('nothing is invented for the patch itself', thinPr.data.diff === undefined)

// A backend that does send the full shape must come through untouched.
const fullPr = normaliseArtifact({
  id: 'a2', ticketId: 'PRO-1245', kind: 'PR', title: 'Pull request',
  createdAt: '2026-09-11T23:15:50.000Z',
  data: { url: 'https://example.com/pull/7', number: 99, real: false,
          filesChanged: ['tax.ts'], diff: '--- a\n+++ b' },
} as never) as { data: Record<string, unknown> }

check('an explicit number is not overwritten by the url', fullPr.data.number === 99)
check('an explicit real:false is preserved', fullPr.data.real === false)
check('an explicit filesChanged is preserved',
  JSON.stringify(fullPr.data.filesChanged) === '["tax.ts"]')

console.log(failures ? `\n${failures} failed\n` : '\nall green\n')
process.exit(failures ? 1 : 0)
