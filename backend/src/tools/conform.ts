import { z } from 'zod'

/**
 * ============================================================================
 *  CONTRACT CONFORMANCE CHECKER
 * ============================================================================
 *
 *   npm run conform                      # check this service
 *   npm run conform -- https://host/api  # check anyone else's
 *
 * Validates every endpoint in docs/API_CONTRACT.md §2 against the types in
 * contracts/api.ts, with Zod standing in for the compiler at runtime.
 *
 * This is what makes "point the console at the real backend and it just
 * works" a claim you can check instead of a hope. Run it against Ayush's host
 * the moment it is up: anything it reports is a place where the frontend
 * would have broken, named before anyone opens a browser.
 *
 * It is deliberately strict about the shapes the UI reads and relaxed about
 * extra fields, because the contract says additive changes are free and the
 * frontend ignores what it does not know.
 */

const BASE = process.argv[2] ?? 'http://localhost:4000/api'

// ---------------------------------------------------------------------------
// §1 shapes
// ---------------------------------------------------------------------------

const iso = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'not an ISO timestamp')

const priority = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const channel = z.enum(['email', 'portal', 'slack', 'signal', 'event'])
const category = z.enum(['BUG', 'CONFIG', 'QUESTION', 'PROCESS']).nullable()
const ticketStatus = z.enum([
  'NEW',
  'RUNNING',
  'AWAITING_APPROVAL',
  'RESOLVED',
  'NEEDS_HUMAN',
  'REJECTED',
])
const runState = z.enum([
  'RECEIVED',
  'CLASSIFYING',
  'GATHERING_CONTEXT',
  'DECIDING',
  'INVESTIGATING',
  'VERIFYING',
  'DRAFTING_REMEDIATION',
  'DRAFTING_REPLY',
  'EXECUTING_PROCESS',
  'AWAITING_APPROVAL',
  'RESOLVED',
  'NEEDS_HUMAN',
])
const runPath = z.enum(['CODE_FIX', 'CONFIG_FIX', 'ANSWER_ONLY', 'PROCESS']).nullable()
const level = z.enum(['info', 'success', 'warn', 'error'])
const artifactKind = z.enum([
  'ROOT_CAUSE',
  'PR',
  'TEST_RESULT',
  'CONFIG_FIX',
  'CUSTOMER_REPLY',
  'IMPACT',
  'PROCESS_RESULT',
])
const activityType = z.enum([
  'ticket.created',
  'run.started',
  'run.state',
  'brain.thought',
  'a2a.request',
  'a2a.response',
  'agent.log',
  'artifact.created',
  'run.awaiting_approval',
  'run.completed',
  'agent.status',
  'signal.raised',
])

const ticket = z.object({
  id: z.string().min(1),
  customer: z.string().nullable(),
  title: z.string(),
  description: z.string(),
  channel,
  priority,
  status: ticketStatus,
  category,
  processKey: z.string().nullable(),
  createdAt: iso,
  updatedAt: iso,
})

const run = z.object({
  id: z.string().min(1),
  ticketId: z.string().min(1),
  state: runState,
  path: runPath,
  attempt: z.number().int().min(1).max(2),
  summary: z.string().nullable(),
  policyReason: z.string().nullable(),
  startedAt: iso,
  endedAt: iso.nullable(),
})

const stage = z.object({
  context: z.string().nullable(),
  investigate: z.string().nullable(),
  verify: z.string().nullable(),
  approve: z.string().nullable(),
})

const activity = z.object({
  id: z.string().min(1),
  ticketId: z.string().min(1),
  runId: z.string().nullable(),
  seq: z.number().int(),
  type: activityType,
  fromAgent: z.string().nullable(),
  toAgent: z.string().nullable(),
  title: z.string(),
  // The one field people get wrong: it stays a string, so the frontend never
  // calls JSON.parse on a response.
  body: z.string().nullable(),
  level,
  taskId: z.string().nullable(),
  durationMs: z.number().nullable(),
  createdAt: iso,
})

/** §3 — the approval panel depends on these exactly. */
const ARTIFACT_DATA: Record<string, z.ZodTypeAny> = {
  ROOT_CAUSE: z.object({
    summary: z.string(),
    detail: z.string(),
    confidence: z.number().min(0).max(1),
  }),
  PR: z.object({
    number: z.number(),
    url: z.string(),
    state: z.enum(['created', 'merged', 'mock']),
    branch: z.string(),
    files: z.array(z.string()),
    additions: z.number(),
    deletions: z.number(),
    patch: z.string(),
  }),
  TEST_RESULT: z.object({
    status: z.enum(['passed', 'failed']),
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    durationMs: z.number(),
    suites: z.array(z.string()),
    failures: z.array(z.string()),
  }),
  CONFIG_FIX: z.object({
    summary: z.string(),
    steps: z.array(z.string()),
    system: z.string(),
  }),
  CUSTOMER_REPLY: z.object({
    subject: z.string(),
    body: z.string(),
    sentTo: z.string(),
  }),
  IMPACT: z.object({
    affectedTenants: z.number(),
    affectedRecords: z.number(),
    firstSeen: z.string(),
  }),
  PROCESS_RESULT: z.object({
    processKey: z.string(),
    stepsCompleted: z.array(z.string()),
    records: z.array(z.object({ type: z.string(), id: z.string() })),
  }),
}

const artifact = z
  .object({
    id: z.string().min(1),
    ticketId: z.string().min(1),
    kind: artifactKind,
    title: z.string(),
    data: z.record(z.unknown()),
    createdAt: iso,
  })
  .superRefine((value, ctx) => {
    const shape = ARTIFACT_DATA[value.kind]
    if (!shape) return
    const result = shape.safeParse(value.data)
    if (result.success) return

    for (const issue of result.error.issues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['data', ...issue.path],
        message: `${value.kind}: ${issue.message}`,
      })
    }
  })

const task = z.object({
  id: z.string().min(1),
  ticketId: z.string().min(1),
  runId: z.string(),
  fromAgent: z.string(),
  toAgent: z.string(),
  type: z.string(),
  status: z.enum(['PENDING', 'WORKING', 'COMPLETED', 'FAILED']),
  input: z.unknown(),
  output: z.unknown().nullable(),
  error: z.string().nullable(),
  durationMs: z.number().nullable(),
  startedAt: iso,
  endedAt: iso.nullable(),
})

const agent = z.object({
  id: z.string().min(1),
  name: z.string(),
  kind: z.enum(['knowledge', 'engineering', 'validation', 'ops']),
  baseUrl: z.string(),
  protocol: z.literal('A2A'),
  status: z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN']),
  capabilities: z.array(z.string()),
  tools: z.array(z.object({ name: z.string(), via: z.enum(['MCP', 'CONNECTOR']) })),
  description: z.string().nullable(),
  lastSeenAt: iso.nullable(),
  tasksToday: z.number(),
})

const connector = z.object({
  id: z.string().min(1),
  kind: z.enum(['database', 'warehouse', 'saas-api', 'file', 'event-stream', 'mcp']),
  capabilities: z.array(z.string()),
  health: z.object({ ok: z.boolean(), latencyMs: z.number() }),
})

const stats = z.object({
  active: z.number(),
  aiWorking: z.number(),
  needsApproval: z.number(),
  resolvedToday: z.number(),
  avgResolutionMins: z.number(),
})

const list = <T extends z.ZodTypeAny>(item: T) => z.object({ data: z.array(item) })

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

interface Check {
  name: string
  run: () => Promise<void>
}

let failures = 0
let passes = 0

function report(name: string, error?: string) {
  if (error) {
    failures++
    console.log(`  FAIL  ${name}\n        ${error.replace(/\n/g, '\n        ')}`)
  } else {
    passes++
    console.log(`  ok    ${name}`)
  }
}

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${BASE}${path}`)
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

async function post(path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: text ? JSON.parse(text) : undefined }
}

function expect(schema: z.ZodTypeAny, value: unknown): string | undefined {
  const result = schema.safeParse(value)
  if (result.success) return undefined
  return result.error.issues
    .slice(0, 6)
    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n')
}

async function main() {
  console.log(`\nContract conformance · ${BASE}\n`)

  const checks: Check[] = []
  let sampleTicketId = ''

  checks.push({
    name: 'GET /tickets — list of Ticket + run + stage',
    run: async () => {
      const { status, body } = await get('/tickets')
      if (status !== 200) throw new Error(`expected 200, got ${status}`)

      const rows = (body as { data: unknown[] }).data
      const error = expect(list(ticket.passthrough().and(z.object({ run: run.partial().nullable(), stage }))), body)
      if (error) throw new Error(error)
      if (rows.length === 0) throw new Error('no tickets to check — seed the board first')

      sampleTicketId = (rows[0] as { id: string }).id
    },
  })

  checks.push({
    name: 'GET /stats — exactly the five numbers',
    run: async () => {
      const { body } = await get('/stats')
      const error = expect(stats, body)
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'GET /agents — registry',
    run: async () => {
      const { body } = await get('/agents')
      const error = expect(list(agent.passthrough()), body)
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'GET /agents/:id — agent, raw card, recent tasks',
    run: async () => {
      const { body: listBody } = await get('/agents')
      const first = (listBody as { data: { id: string }[] }).data[0]
      if (!first) throw new Error('no agents registered')

      const { status, body } = await get(`/agents/${encodeURIComponent(first.id)}`)
      if (status !== 200) throw new Error(`expected 200, got ${status}`)

      const error = expect(
        z.object({ agent: agent.passthrough(), card: z.unknown(), recentTasks: z.array(task.passthrough()) }),
        body,
      )
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'GET /connectors',
    run: async () => {
      const { body } = await get('/connectors')
      const error = expect(list(connector.passthrough()), body)
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'GET /tickets/:id — ticket, run, artifacts, insight',
    run: async () => {
      const { status, body } = await get(`/tickets/${encodeURIComponent(sampleTicketId)}`)
      if (status !== 200) throw new Error(`expected 200, got ${status}`)

      const error = expect(
        z.object({
          ticket: ticket.passthrough(),
          run: run.passthrough().nullable(),
          artifacts: z.array(artifact),
          insight: z
            .object({ affectedTenants: z.number(), affectedRecords: z.number() })
            .passthrough()
            .nullable(),
        }),
        body,
      )
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'GET /tickets/:id/activities — ordered by seq, body is a string',
    run: async () => {
      const { body } = await get(`/tickets/${encodeURIComponent(sampleTicketId)}/activities`)
      const error = expect(list(activity.passthrough()), body)
      if (error) throw new Error(error)

      const rows = (body as { data: { seq: number }[] }).data
      const seqs = rows.map((row) => row.seq)
      if (seqs.some((value, index) => index > 0 && value <= seqs[index - 1]!)) {
        throw new Error(`seq is not strictly ascending: ${seqs.join(', ')}`)
      }
    },
  })

  checks.push({
    name: 'GET /tickets/:id/tasks',
    run: async () => {
      const { body } = await get(`/tickets/${encodeURIComponent(sampleTicketId)}/tasks`)
      const error = expect(list(task.passthrough()), body)
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'GET /tickets/:id — 404 in the error shape for an unknown ticket',
    run: async () => {
      const { status, body } = await get('/tickets/NOPE-9999')
      if (status !== 404) throw new Error(`expected 404, got ${status}`)
      const error = expect(
        z.object({ error: z.object({ code: z.string(), message: z.string() }) }),
        body,
      )
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'POST /tickets → 201 with a Ticket, then a 202 investigate',
    run: async () => {
      const created = await post('/tickets', {
        customer: 'Conformance Co',
        title: 'Conformance probe',
        description: 'Raised by the contract conformance checker. Safe to ignore.',
        priority: 'LOW',
        channel: 'portal',
      })
      if (created.status !== 201) throw new Error(`expected 201, got ${created.status}`)

      const error = expect(ticket.passthrough(), created.body)
      if (error) throw new Error(error)

      const id = (created.body as { id: string }).id
      const started = await post(`/tickets/${encodeURIComponent(id)}/investigate`)
      if (started.status !== 202 && started.status !== 200) {
        throw new Error(`investigate: expected 202 (or 200 when joining), got ${started.status}`)
      }

      const shape = expect(z.object({ runId: z.string(), state: runState }), started.body)
      if (shape) throw new Error(shape)

      // A second POST must join the run in flight, never fork one.
      const again = await post(`/tickets/${encodeURIComponent(id)}/investigate`)
      if (again.status !== 200 && again.status !== 202) {
        throw new Error(`second investigate: expected 200/202, got ${again.status}`)
      }
      const firstRun = (started.body as { runId: string }).runId
      const secondRun = (again.body as { runId: string }).runId
      if (firstRun !== secondRun) {
        throw new Error(`double investigate forked a second run: ${firstRun} then ${secondRun}`)
      }
    },
  })

  checks.push({
    name: 'POST /tickets — a new ticket never takes an id already in use',
    run: async () => {
      const before = await get('/tickets')
      const ids = new Set((before.body as { data: { id: string }[] }).data.map((row) => row.id))

      for (let index = 0; index < 3; index++) {
        const created = await post('/tickets', {
          customer: 'Conformance Co',
          title: 'Uniqueness probe',
          description: 'Checks that references are not reused.',
        })
        const id = (created.body as { id: string }).id
        if (ids.has(id)) throw new Error(`reference ${id} was handed out twice`)
        ids.add(id)
      }
    },
  })

  checks.push({
    name: 'POST /tickets/:id/decision — 409 when the run is not at the gate',
    run: async () => {
      const { body } = await get('/tickets?status=NEW')
      const rows = (body as { data: { id: string }[] }).data
      if (rows.length === 0) return

      const { status } = await post(`/tickets/${encodeURIComponent(rows[0]!.id)}/decision`, {
        decision: 'APPROVE',
      })
      if (status !== 409) throw new Error(`expected 409, got ${status}`)
    },
  })

  checks.push({
    name: 'POST /ask — discriminated on shape, sql always present',
    run: async () => {
      const { body } = await post('/ask', {
        question: 'Which category manager saved the most this quarter?',
      })
      const error = expect(
        z.discriminatedUnion('shape', [
          z.object({
            shape: z.literal('table'),
            title: z.string(),
            columns: z.array(z.object({ key: z.string(), label: z.string(), type: z.string() }).passthrough()),
            rows: z.array(z.record(z.unknown())),
            sql: z.string(),
            tookMs: z.number(),
          }),
          z.object({
            shape: z.literal('number'),
            title: z.string(),
            value: z.number(),
            sql: z.string(),
            tookMs: z.number(),
          }).passthrough(),
          z.object({
            shape: z.literal('series'),
            title: z.string(),
            points: z.array(z.object({ x: z.string(), y: z.number() })),
            sql: z.string(),
            tookMs: z.number(),
          }).passthrough(),
        ]),
        body,
      )
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'GET /processes',
    run: async () => {
      const { body } = await get('/processes')
      const error = expect(
        list(
          z.object({
            key: z.string(),
            name: z.string(),
            trigger: z.enum(['event', 'schedule', 'manual']),
            steps: z.array(z.object({ id: z.string(), requiredCapability: z.string() })),
            approvals: z.array(z.object({ after: z.string(), reason: z.string() })),
          }),
        ),
        body,
      )
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'POST /signals — signal plus an optional ticket',
    run: async () => {
      const { status, body } = await post('/signals', {
        source: 'conformance',
        kind: 'PROBE',
        summary: 'Contract conformance probe signal.',
        metrics: { probes: 1 },
      })
      if (status !== 200 && status !== 201) throw new Error(`expected 200/201, got ${status}`)

      const error = expect(
        z.object({
          signal: z.object({ id: z.string(), summary: z.string() }).passthrough(),
          ticket: ticket.passthrough().nullable(),
        }),
        body,
      )
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'SSE /tickets/:id/stream — every event carries activityId and seq',
    run: async () => {
      const controller = new AbortController()
      const response = await fetch(`${BASE}/tickets/${encodeURIComponent(sampleTicketId)}/stream`, {
        headers: { Accept: 'text/event-stream' },
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`expected 200, got ${response.status}`)
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text/event-stream')) {
        throw new Error(`expected text/event-stream, got "${contentType}"`)
      }
      if ((response.headers.get('cache-control') ?? '').includes('no-cache') === false) {
        throw new Error('missing Cache-Control: no-cache')
      }

      // Read whatever arrives in a short window; an idle stream is fine.
      const reader = response.body!.getReader()
      const timer = setTimeout(() => controller.abort(), 1500)
      let buffer = ''
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += new TextDecoder().decode(value)
        }
      } catch {
        /* aborted on purpose */
      } finally {
        clearTimeout(timer)
      }

      for (const line of buffer.split('\n')) {
        if (!line.startsWith('data:')) continue
        const payload = JSON.parse(line.slice(5))
        if (!('activityId' in payload) || !('seq' in payload)) {
          throw new Error(`event payload is missing activityId/seq: ${line.slice(0, 120)}`)
        }
      }
    },
  })

  for (const check of checks) {
    try {
      await check.run()
      report(check.name)
    } catch (error) {
      report(check.name, error instanceof Error ? error.message : String(error))
    }
  }

  console.log(`\n  ${passes} passed, ${failures} failed\n`)
  process.exit(failures === 0 ? 0 : 1)
}

void main()
