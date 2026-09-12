import type { ActivityDto, ActivityType, AgentId } from '../contract'

/**
 * ============================================================================
 *  ONE TRANSCRIPT, TWO ENVELOPES
 * ============================================================================
 *
 * The contract's activity row is a discriminated union: a thought carries
 * `text`, a hop carries `from`/`to`/`taskId`/`summary`, a log carries `line`,
 * and every row carries `at`. `utils/exchanges.ts` reads exactly those names.
 *
 * The deployed Brain sends a flatter row instead — one shape for every type:
 *
 *   { id, seq, type, ticketId, runId, fromAgent, toAgent, title, body,
 *     level, createdAt }
 *
 * Handed to the transcript unchanged that row renders nothing useful and
 * `ticket.created` throws outright, because `row.ticket.id` dereferences an
 * object that is not there — one bad row blanks the whole ticket page.
 *
 * So the two envelopes are reconciled here, at the edge, and nothing above
 * this file learns there was ever more than one. A row that already speaks
 * the contract is returned untouched: this is a widening, not a rewrite, and
 * the backend in ../../backend keeps working exactly as it did.
 *
 * What cannot be recovered is stated as such rather than invented. The flat
 * envelope does not carry the task id that groups a hop's three rows into one
 * exchange, so it is reconstructed from the delegation order — see
 * `taskIdFor` — and where even that cannot apply, the row is rendered on its
 * own rather than dropped.
 */

/** The flat envelope, as the deployed Brain sends it. Every field optional. */
interface FlatRow {
  id?: string
  seq?: number
  type?: string
  ticketId?: string
  runId?: string
  fromAgent?: string | null
  toAgent?: string | null
  title?: string | null
  body?: string | null
  level?: string | null
  createdAt?: string
  /** Fields either envelope may carry; read when present. */
  at?: string
  taskId?: string
  status?: string
  outcome?: string
  durationMs?: number | null
  text?: string
  summary?: string
  line?: string
  policyId?: string
  policyReason?: string
  state?: string
  path?: string | null
  attempt?: number
  artifact?: unknown
  ticket?: unknown
  [key: string]: unknown
}

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined

/** A row already in contract shape carries `at`; the flat one carries `createdAt`. */
export function isContractEnvelope(row: unknown): boolean {
  const candidate = row as FlatRow | null
  return Boolean(candidate && typeof candidate === 'object' && str(candidate.at))
}

/**
 * Two lines into one thought.
 *
 * `exchanges.ts` bolds `heading` and sets `detail` beneath it when the backend
 * sends them, and falls back to `text` when it does not. The flat envelope's
 * `title`/`body` pair is the same split under different names, so it is passed
 * through as both — the richer rendering when it can, and a correct `text`
 * either way.
 */
function joined(title: string | undefined, body: string | undefined): string {
  return [title, body].filter(Boolean).join('\n\n')
}

/**
 * Reconstructs the task id that groups a hop.
 *
 * A delegation is three rows — request, the agent's own log lines, response —
 * and the contract ties them together with `taskId`. The flat envelope has no
 * such field, but it does say which agent each row concerns, and a run only
 * ever has one delegation open per agent at a time. So the agent on the row is
 * the key, and the request is what opens it.
 *
 * This is an inference and is treated like one: when it cannot find an open
 * delegation it returns undefined, and the caller renders the row by itself
 * rather than silently discarding it.
 */
function createTaskIds() {
  const open = new Map<string, string>()

  return {
    /** A request opens a delegation to `toAgent`. */
    opened(row: FlatRow, id: string): string {
      const agent = str(row.toAgent) ?? str(row.fromAgent) ?? 'agent'
      open.set(agent, id)
      return id
    },

    /** A response or a log belongs to whichever delegation that agent has open. */
    current(row: FlatRow): string | undefined {
      // A response is the agent answering, so it is `fromAgent` that names the
      // delegation — the mirror of the request that opened it.
      const agent = str(row.fromAgent) ?? str(row.toAgent)
      return agent ? open.get(agent) : undefined
    },

    closed(row: FlatRow): void {
      const agent = str(row.fromAgent) ?? str(row.toAgent)
      if (agent) open.delete(agent)
    },
  }
}

/**
 * A normaliser with memory.
 *
 * Stateful because hop grouping depends on the rows already seen, which means
 * one of these per timeline: the history fetch gets one, and each SSE
 * subscription gets its own so a reconnect cannot inherit half-open
 * delegations from the last one.
 */
export function createActivityNormaliser(): (row: unknown) => ActivityDto | null {
  const tasks = createTaskIds()

  return (input: unknown): ActivityDto | null => {
    if (!input || typeof input !== 'object') return null
    const row = input as FlatRow

    const type = str(row.type) as ActivityType | undefined
    if (!type) return null

    // Already the contract's shape — hand it straight through. This is the
    // path the in-repo backend takes, and it must stay byte-for-byte what it
    // was before this file existed.
    if (isContractEnvelope(row)) return row as unknown as ActivityDto

    const id = str(row.id) ?? `${type}-${row.seq ?? 0}`
    const at = str(row.createdAt) ?? str(row.at) ?? new Date(0).toISOString()
    const title = str(row.title)
    const body = str(row.body)
    const from = (str(row.fromAgent) ?? 'brain') as AgentId
    const to = (str(row.toAgent) ?? 'brain') as AgentId

    const base = { id, seq: row.seq ?? 0, type, ticketId: str(row.ticketId) ?? '', at }

    switch (type) {
      case 'ticket.created':
        // The flat envelope does not repeat the ticket here; the page already
        // holds it from `GET /tickets/:id`. Enough of one is synthesised for
        // the row to render — anything more would be invention.
        return {
          ...base,
          type,
          ticket: (row.ticket ?? {
            id: str(row.ticketId) ?? '',
            description: body ?? title ?? '',
          }) as never,
        } as ActivityDto

      case 'run.started':
        return { ...base, type, runId: str(row.runId) ?? '' } as ActivityDto

      case 'run.state':
        return {
          ...base,
          type,
          runId: str(row.runId) ?? '',
          state: str(row.state) ?? '',
          path: (str(row.path) ?? null) as never,
          attempt: row.attempt ?? 1,
        } as unknown as ActivityDto

      case 'brain.thought':
        return {
          ...base,
          type,
          text: str(row.text) ?? joined(title, body),
          // Additive, and the reason the transcript can bold the first line:
          // the flat envelope already splits the thought exactly this way.
          heading: title,
          detail: body ?? null,
        } as unknown as ActivityDto

      case 'a2a.request':
        return {
          ...base,
          type,
          taskId: str(row.taskId) ?? tasks.opened(row, id),
          from,
          to,
          taskType: (str(row.taskType as string) ?? '') as never,
          summary: str(row.summary) ?? title ?? '',
        } as unknown as ActivityDto

      case 'a2a.response': {
        const taskId = str(row.taskId) ?? tasks.current(row) ?? id
        tasks.closed(row)
        return {
          ...base,
          type,
          taskId,
          // A response reads agent → brain on the wire. The transcript shows a
          // hop as one act in the direction it was made, so the ends are put
          // back the way the request had them.
          from: to === 'brain' ? to : from,
          to: to === 'brain' ? from : to,
          status: str(row.status) ?? (str(row.level) === 'error' ? 'failed' : 'completed'),
          summary: str(row.summary) ?? title ?? '',
          durationMs: row.durationMs ?? null,
          detail: body ?? null,
        } as unknown as ActivityDto
      }

      case 'agent.log':
        return {
          ...base,
          type,
          // Undefined when no delegation is open: the transcript then shows the
          // line on its own rather than dropping it.
          taskId: str(row.taskId) ?? tasks.current(row),
          agent: from,
          line: str(row.line) ?? body ?? title ?? '',
        } as unknown as ActivityDto

      case 'artifact.created':
        return { ...base, type, artifact: row.artifact as never } as ActivityDto

      case 'run.awaiting_approval':
        return {
          ...base,
          type,
          runId: str(row.runId) ?? '',
          policyId: str(row.policyId) ?? '',
          policyReason: str(row.policyReason) ?? body ?? title ?? '',
        } as ActivityDto

      case 'run.completed':
        return {
          ...base,
          type,
          runId: str(row.runId) ?? '',
          outcome: str(row.outcome) ?? outcomeFrom(title, body),
          summary: body ?? undefined,
        } as unknown as ActivityDto

      default:
        // agent.status, signal.raised and anything this frontend has not been
        // taught yet: carried through with the envelope fixed up, so a future
        // event type arrives as a row rather than an exception.
        return { ...base, type, ...stripFlat(row) } as unknown as ActivityDto
    }
  }
}

/**
 * How a run ended, when the row does not say.
 *
 * The flat envelope states the outcome in the sentence rather than a field.
 * `RESOLVED` is the only value the transcript branches on, so the test is for
 * that and everything else is left to mean "a person has it".
 */
function outcomeFrom(title: string | undefined, body: string | undefined): string {
  return /\b(resolved|closed|approved)\b/i.test(`${title ?? ''} ${body ?? ''}`)
    ? 'RESOLVED'
    : 'NEEDS_HUMAN'
}

/** Everything except the flat envelope's own field names. */
const FLAT_KEYS = [
  'id',
  'seq',
  'type',
  'ticketId',
  'createdAt',
  'fromAgent',
  'toAgent',
  'title',
  'body',
] as const

function stripFlat(row: FlatRow): Record<string, unknown> {
  const rest: Record<string, unknown> = { ...row }
  for (const key of FLAT_KEYS) delete rest[key]
  return rest
}

/** The history fetch: one normaliser for the whole list, ordered by `seq`. */
export function normaliseActivities(rows: unknown[]): ActivityDto[] {
  const normalise = createActivityNormaliser()
  return rows
    .map(normalise)
    .filter((row): row is ActivityDto => row !== null)
    .sort((left, right) => left.seq - right.seq)
}
