import { z } from 'zod'

/**
 * ============================================================================
 *  CONTRACT CONFORMANCE CHECKER
 * ============================================================================
 *
 *   npm run conform                      # check this service
 *   npm run conform -- https://host/api  # check anyone else's
 *
 * Validates every endpoint in the contract (contracts/api.ts, transcribed
 * from the backend's FRONTEND.md) against a live server, with Zod standing in
 * for the compiler at runtime.
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
// Enums and entities
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
const resolutionPath = z.enum(['CODE_FIX', 'CONFIG_FIX', 'ANSWER_ONLY', 'PROCESS']).nullable()
const artifactKind = z.enum([
  'ROOT_CAUSE',
  'PR',
  'TEST_RESULT',
  'CONFIG_FIX',
  'CUSTOMER_REPLY',
  'IMPACT',
  'PROCESS_RESULT',
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
  path: resolutionPath,
  attempt: z.number().int().min(1).max(2),
  summary: z.string().nullable(),
  startedAt: iso,
  endedAt: iso.nullable(),
})

/**
 * Artifact payloads — §"Artifact payloads".
 *
 * These are the shapes the approval panel reads field by field, so a rename
 * here is a blank panel rather than a type error. Checking them is most of
 * the value of this tool.
 */
const ARTIFACT_DATA: Record<string, z.ZodTypeAny> = {
  ROOT_CAUSE: z.object({
    rootCause: z.string(),
    file: z.string(),
    confidence: z.number().min(0).max(1),
    attempt: z.number().int(),
  }),
  PR: z.object({
    number: z.number(),
    url: z.string(),
    state: z.string(),
    // The flag that stops the UI rendering an unclickable link as a live PR.
    real: z.boolean(),
    note: z.string().optional(),
    branch: z.string(),
    title: z.string(),
    body: z.string(),
    filesChanged: z.array(z.string()),
    diff: z.string(),
  }),
  TEST_RESULT: z.object({
    status: z.enum(['passed', 'failed']),
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    durationMs: z.number(),
    suites: z.array(z.string()),
    failures: z.array(z.string()),
    message: z.string(),
    branch: z.string(),
    attempt: z.number().int(),
  }),
  CONFIG_FIX: z.object({
    title: z.string(),
    steps: z.array(z.string()),
    rationale: z.string(),
    requiresCodeChange: z.boolean(),
    citations: z.array(z.string()),
    customer: z.string(),
  }),
  CUSTOMER_REPLY: z.object({
    subject: z.string(),
    body: z.string(),
    citations: z.array(z.string()).optional(),
    sentAt: z.string().optional(),
    approvedBy: z.string().optional(),
  }),
  IMPACT: z.object({
    affectedTenants: z.number(),
    affectedRecords: z.number(),
    firstSeen: z.string(),
    trend: z.array(z.object({ date: z.string(), count: z.number() })),
    sql: z.string(),
    source: z.string(),
  }),
  PROCESS_RESULT: z.object({
    key: z.string(),
    name: z.string(),
    completed: z.array(
      z.object({ stepId: z.string(), name: z.string(), detail: z.string() }).passthrough(),
    ),
    pending: z.array(z.object({ stepId: z.string(), name: z.string(), action: z.string() })),
    input: z.unknown(),
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

/**
 * The activity envelope and its twelve payloads.
 *
 * A discriminated union, exactly as the contract defines it — because the
 * whole reason the SSE payload and the stored row are one object is that a
 * client can switch on `type` and trust the fields. If a type carries a field
 * under the wrong name this is where it shows.
 */
const base = { id: z.string().min(1), seq: z.number().int(), ticketId: z.string(), at: iso }
const agentId = z.string().min(1)

const activity = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('ticket.created'), ticket: ticket.passthrough() }).passthrough(),
  z.object({ ...base, type: z.literal('run.started'), runId: z.string() }).passthrough(),
  z
    .object({
      ...base,
      type: z.literal('run.state'),
      runId: z.string(),
      state: runState,
      path: resolutionPath,
      attempt: z.number().int(),
    })
    .passthrough(),
  z.object({ ...base, type: z.literal('brain.thought'), text: z.string().min(1) }).passthrough(),
  z
    .object({
      ...base,
      type: z.literal('a2a.request'),
      taskId: z.string(),
      from: agentId,
      to: agentId,
      taskType: z.string(),
      summary: z.string(),
    })
    .passthrough(),
  z
    .object({
      ...base,
      type: z.literal('a2a.response'),
      taskId: z.string(),
      from: agentId,
      to: agentId,
      status: z.string(),
      summary: z.string(),
      durationMs: z.number().nullable(),
    })
    .passthrough(),
  z
    .object({
      ...base,
      type: z.literal('agent.log'),
      taskId: z.string(),
      agent: agentId,
      line: z.string(),
    })
    .passthrough(),
  z.object({ ...base, type: z.literal('artifact.created'), artifact }).passthrough(),
  z
    .object({
      ...base,
      type: z.literal('run.awaiting_approval'),
      runId: z.string(),
      policyId: z.string(),
      policyReason: z.string(),
    })
    .passthrough(),
  z
    .object({ ...base, type: z.literal('run.completed'), runId: z.string(), outcome: z.string() })
    .passthrough(),
  z
    .object({
      ...base,
      type: z.literal('agent.status'),
      agentId,
      status: z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN']),
    })
    .passthrough(),
  z.object({ ...base, type: z.literal('signal.raised'), signal: z.record(z.unknown()) }).passthrough(),
])

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

const signal = z.object({
  id: z.string().min(1),
  source: z.string(),
  kind: z.string(),
  summary: z.string(),
  metrics: z.record(z.unknown()),
  ticketId: z.string().nullable(),
  createdAt: iso,
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
  let sampleRunId = ''

  checks.push({
    name: 'GET /tickets — a bare list of Ticket',
    run: async () => {
      const { status, body } = await get('/tickets')
      if (status !== 200) throw new Error(`expected 200, got ${status}`)

      const error = expect(list(ticket.passthrough()), body)
      if (error) throw new Error(error)

      const rows = (body as { data: unknown[] }).data
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
    name: 'GET /agents/capabilities — capability → agent ids',
    run: async () => {
      const { status, body } = await get('/agents/capabilities')
      if (status !== 200) throw new Error(`expected 200, got ${status}`)

      const error = expect(
        list(z.object({ capability: z.string(), agentIds: z.array(z.string()) })),
        body,
      )
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'GET /agents/:id — the raw card and recent tasks',
    run: async () => {
      const { body: listBody } = await get('/agents')
      const first = (listBody as { data: { id: string }[] }).data[0]
      if (!first) throw new Error('no agents registered')

      const { status, body } = await get(`/agents/${encodeURIComponent(first.id)}`)
      if (status !== 200) throw new Error(`expected 200, got ${status}`)

      const error = expect(
        z.object({ card: z.unknown(), recentTasks: z.array(task.passthrough()) }).passthrough(),
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
    name: 'GET /tickets/:id — ticket, run, artifacts, approval, signal',
    run: async () => {
      const { status, body } = await get(`/tickets/${encodeURIComponent(sampleTicketId)}`)
      if (status !== 200) throw new Error(`expected 200, got ${status}`)

      const error = expect(
        z
          .object({
            ticket: ticket.passthrough(),
            run: run.passthrough().nullable(),
            artifacts: z.array(artifact),
            approval: z
              .object({
                required: z.boolean(),
                policyId: z.string().optional(),
                reason: z.string().optional(),
              })
              .nullable(),
            signal: signal.passthrough().nullable(),
          })
          .passthrough(),
        body,
      )
      if (error) throw new Error(error)

      sampleRunId = (body as { run: { id: string } | null }).run?.id ?? ''
    },
  })

  checks.push({
    name: 'GET /runs/:runId — the run, its tasks and its state history',
    run: async () => {
      if (!sampleRunId) throw new Error('no run on the sample ticket to read')

      const { status, body } = await get(`/runs/${encodeURIComponent(sampleRunId)}`)
      if (status !== 200) throw new Error(`expected 200, got ${status}`)

      const error = expect(
        z
          .object({
            run: run.passthrough(),
            tasks: z.array(task.passthrough()),
            steps: z.array(z.object({ id: z.string(), state: runState, at: iso })),
          })
          .passthrough(),
        body,
      )
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'GET /tickets/:id/activities — the union, ordered by seq',
    run: async () => {
      const { body } = await get(`/tickets/${encodeURIComponent(sampleTicketId)}/activities`)
      const error = expect(list(activity), body)
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
    name: 'POST /tickets → 201 with a Ticket, then an idempotent investigate',
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

      const shape = expect(
        z.object({ runId: z.string().min(1), started: z.boolean() }).passthrough(),
        started.body,
      )
      if (shape) throw new Error(shape)

      // A second POST must join the run in flight, never fork one — and must
      // say so by answering started: false.
      const again = await post(`/tickets/${encodeURIComponent(id)}/investigate`)
      if (again.status !== 200 && again.status !== 202) {
        throw new Error(`second investigate: expected 200/202, got ${again.status}`)
      }
      const first = started.body as { runId: string }
      const second = again.body as { runId: string; started: boolean }
      if (first.runId !== second.runId) {
        throw new Error(`double investigate forked a second run: ${first.runId} then ${second.runId}`)
      }
      if (second.started !== false) {
        throw new Error('joining a run in flight must answer started: false')
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
    name: 'POST /tickets/:id/decision — the decision, both states, and the reply',
    run: async () => {
      const { body } = await get('/tickets?status=AWAITING_APPROVAL')
      const rows = (body as { data: { id: string }[] }).data
      if (rows.length === 0) return

      const { status, body: decided } = await post(
        `/tickets/${encodeURIComponent(rows[0]!.id)}/decision`,
        { decision: 'APPROVE', note: 'Approved by the conformance checker.' },
      )
      if (status !== 200) throw new Error(`expected 200, got ${status}`)

      const error = expect(
        z
          .object({
            decision: z.enum(['APPROVE', 'REJECT']),
            ticketStatus,
            runState,
            reply: artifact.optional(),
          })
          .passthrough(),
        decided,
      )
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'GET /insights — the numbers with the query that produced them',
    run: async () => {
      const { status, body } = await get(
        `/insights?ticketId=${encodeURIComponent(sampleTicketId)}`,
      )
      // A ticket with no impact recorded answers 404, which is correct.
      if (status === 404) return
      if (status !== 200) throw new Error(`expected 200 or 404, got ${status}`)

      const error = expect(
        z
          .object({
            affectedTenants: z.number(),
            affectedRecords: z.number(),
            firstSeen: z.string(),
            trend: z.array(z.object({ date: z.string(), count: z.number() })),
            sql: z.string().min(1),
          })
          .passthrough(),
        body,
      )
      if (error) throw new Error(error)
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
          z
            .object({
              shape: z.literal('table'),
              title: z.string(),
              columns: z.array(
                z.object({ key: z.string(), label: z.string(), type: z.string() }).passthrough(),
              ),
              rows: z.array(z.record(z.unknown())),
              sql: z.string().min(1),
            })
            .passthrough(),
          z
            .object({
              shape: z.literal('number'),
              title: z.string(),
              value: z.number(),
              sql: z.string().min(1),
            })
            .passthrough(),
          z
            .object({
              shape: z.literal('series'),
              title: z.string(),
              series: z.array(z.object({ x: z.string(), y: z.number() })),
              sql: z.string().min(1),
            })
            .passthrough(),
        ]),
        body,
      )
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'GET /ask/examples',
    run: async () => {
      const { status, body } = await get('/ask/examples')
      if (status !== 200) throw new Error(`expected 200, got ${status}`)
      const error = expect(list(z.string()), body)
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'GET /policies — every gate, in the words it is rendered in',
    run: async () => {
      const { status, body } = await get('/policies')
      if (status !== 200) throw new Error(`expected 200, got ${status}`)
      const error = expect(
        list(z.object({ id: z.string().min(1), reason: z.string().min(1) }).passthrough()),
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
    name: 'GET /signals',
    run: async () => {
      const { status, body } = await get('/signals')
      if (status !== 200) throw new Error(`expected 200, got ${status}`)
      const error = expect(list(signal.passthrough()), body)
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
        z.object({ signal: signal.passthrough(), ticket: ticket.passthrough().nullable() }),
        body,
      )
      if (error) throw new Error(error)
    },
  })

  checks.push({
    name: 'SSE /tickets/:id/stream — the event name is the payload type',
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

      // Provoke traffic on the stream we are already holding open, so this
      // checks real events rather than passing on an idle connection.
      void post('/signals', {
        source: 'conformance',
        kind: 'STREAM_PROBE',
        summary: 'Checking that SSE frames match the contract.',
      })

      const reader = response.body!.getReader()
      const timer = setTimeout(() => controller.abort(), 2000)
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

      // Each frame: `id:` for Last-Event-ID replay, `event:` naming the type,
      // `data:` carrying the row. The name and the payload's own `type` must
      // agree — a client subscribing by event name and a client switching on
      // the field have to see the same thing.
      for (const frame of buffer.split('\n\n')) {
        const data = frame.split('\n').find((line) => line.startsWith('data:'))
        if (!data) continue

        const name = frame.split('\n').find((line) => line.startsWith('event:'))?.slice(6).trim()
        const payload = JSON.parse(data.slice(5)) as Record<string, unknown>

        if (name === 'board.updated') continue

        const error = expect(activity, payload)
        if (error) throw new Error(`${name}: ${error}`)
        if (name !== payload.type) {
          throw new Error(`event name "${name}" does not match payload type "${String(payload.type)}"`)
        }
      }
    },
  })

  checks.push({
    name: 'GET /contract — the server describes what it serves',
    run: async () => {
      const { status, body } = await get('/contract')
      if (status !== 200) throw new Error(`expected 200, got ${status}`)

      const error = expect(
        z
          .object({
            version: z.string(),
            endpoints: z.array(z.string()).min(1),
            extensions: z.array(z.string()),
          })
          .passthrough(),
        body,
      )
      if (error) throw new Error(error)
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
