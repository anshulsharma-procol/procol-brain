import cors from 'cors'
import express from 'express'
import { agentsRouter } from './agents/server.js'
import { setSelfOrigin, startDiscovery } from './brain/registry.js'
import { env } from './env.js'
import { chatRouter } from './routes/chat.js'
import { consoleRouter } from './routes/console.js'
import { demoRouter } from './routes/demo.js'
import { seed } from './seed.js'
import { store } from './store.js'
import { WORKSPACES } from './domain/workspaces.js'

/**
 * ============================================================================
 *  PROCOL BRAIN — API
 * ============================================================================
 *
 * One service, three surfaces, one store:
 *
 *   /api/*          the internal console          (CONSOLE_API_CONTRACT.md)
 *   /api/chat/*     the customer's chat widget    (BACKEND_API_CONTRACT.md)
 *   /agents/*       the A2A agents, each with its own card
 *
 * The orchestration is real: real HTTP between Brain and the agents, real
 * timing, real state machine, real SSE. The answers the agents give are
 * scripted (see domain/playbooks.ts), which is a deliberate trade — a demo
 * cannot be broken by a model having an off day, and every one of those
 * agents can be replaced with one that does the work for real without the
 * orchestrator noticing.
 */
async function main() {
  const app = express()

  app.use(cors({ origin: env.corsOrigins }))
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', (_request, response) => {
    response.json({
      ok: true,
      agentMode: env.AGENT_MODE,
      runSpeed: env.RUN_SPEED,
      workspaces: WORKSPACES.map((workspace) => workspace.id),
      tickets: store.listTickets().length,
      uptimeSeconds: Math.round(process.uptime()),
    })
  })

  // The agents are mounted before the API so their cards are reachable at a
  // path a judge can curl, and so `AGENT_MODE=separate` changes only where the
  // orchestrator points — not how it talks.
  app.use('/agents', agentsRouter())

  // Order matters: the widget's vocabulary lives under /api/chat, and the
  // console owns everything else under /api.
  app.use('/api/chat', chatRouter())
  app.use('/api/demo', demoRouter())
  app.use('/api', consoleRouter())

  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'not_found', message: 'No such endpoint' } })
  })

  // One error shape, always. Nothing with a stack trace in it reaches a client.
  app.use(
    (
      error: Error,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      console.error('[api]', error)
      response.status(500).json({ error: { code: 'internal', message: 'Something went wrong' } })
    },
  )

  // 0.0.0.0, never localhost: the deployed app and a phone on the same wifi
  // both need to reach it.
  const server = app.listen(env.PORT, '0.0.0.0', async () => {
    setSelfOrigin(`http://127.0.0.1:${env.PORT}`)
    startDiscovery()

    // Seeding happens *after* the socket is open, because seeding runs real
    // A2A calls against this process's own agent endpoints. Doing it before
    // listening leaves every seeded run stalled on a connection refused.
    const restored = store.restore()
    if (restored) {
      console.log(`[store] restored ${store.listTickets().length} tickets from ${env.stateFile}`)
    } else {
      await seed()
    }

    console.log(`\n  Procol Brain API  ·  http://localhost:${env.PORT}`)
    console.log(`  console   /api`)
    console.log(`  chat      /api/chat`)
    console.log(`  agents    /agents/<id>/.well-known/agent-card.json`)
    console.log(`  demo      POST /api/demo/reset · POST /api/demo/simulate\n`)
  })

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      server.close(() => process.exit(0))
    })
  }
}

void main()
