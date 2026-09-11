# Procol Brain — API

The orchestrator. One service, three surfaces, one store.

```
/api/*        the internal console          docs/CONSOLE_API_CONTRACT.md
/api/chat/*   the customer's chat widget    docs/BACKEND_API_CONTRACT.md
/agents/*     the A2A agents, each with its own agent card
```

```bash
npm install
cp .env.example .env      # optional; the defaults work
npm run dev               # http://localhost:4000
```

## What is real and what is scripted

Being precise about this matters, because someone will ask.

**Real:** the HTTP API, the SSE streams, the state machine, capability-based
routing through the agent registry, the A2A envelopes going over the network to
separate agent endpoints, the measured latency of every hop, the approval gate,
the audit trail, the institutional memory, and the store every surface shares.

**Scripted:** what the agents *answer*. A playbook in
`src/domain/playbooks.ts` holds the product context, the root cause, the diff
and the test results for each case the deployment knows. The knowledge agent is
not searching a real index; the dev agent is not really reading a repository.

That trade is deliberate. The orchestration is the product and it is genuine;
the answers are fixed so a rehearsal cannot be broken by a model having an off
day or by conference wifi. Every agent can be replaced with one that does the
work for real — same envelope in, same envelope out — and the orchestrator will
not notice.

The one thing it will never do is invent an answer. A ticket the classifier
does not recognise is taken as far as the knowledge agent, told there is
nothing on file, and handed to a person with no artifacts attached. Borrowing
another case's root cause would be the most damaging thing this service could
do.

## The cases it can handle

`GET /api/demo/playbooks` lists them with the words that route to each.

| Workspace | Case | Path | What it demonstrates |
| --- | --- | --- | --- |
| Procol | Invoice GST wrong | `CODE_FIX` | The full loop: context → root cause → PR → 47 tests → blast radius → gate |
| Procol | Vendor cannot see an auction | `CONFIG_FIX` | Brain decides: engineering and QA are never woken |
| Procol | How do I extend an auction deadline? | `ANSWER_ONLY` | Restraint: answered and closed, no approval gate |
| AcmeCloud | Tenant-wide 401s after a deployment | `CODE_FIX` | The same run with the customer's own knowledge agent |
| AcmeCloud | Webhook deliveries stopped | `CONFIG_FIX` | A config fix in a second company's tower |
| — | Anything else | — | Handed to a person rather than guessed |

## Prompts to type into the chat widget

Paste any of these into the customer chat (the launcher in the bottom right of
the console). Each creates a real ticket through the API, which appears on the
internal board immediately.

**Procol · the full loop**
> Our March invoices are showing GST of 12% instead of 18%. The discount looks right but the tax is wrong on every PO raised this month.

**Procol · Brain decides it is configuration, not code**
> We invited Sharma Steels to the MS Plate auction but they say nothing shows in their dashboard. The auction closes Friday.

**Procol · a question, answered without waking anyone**
> How do I extend an auction deadline once it is already live?

**AcmeCloud · a different company, the same Brain** (switch the workspace first)
> Since yesterday's deployment, all our users are getting 401 Unauthorized when trying to log in.

**AcmeCloud · their own configuration fix**
> Our webhook endpoint stopped receiving events for tenant northwind. We get no error, the deliveries just stop.

**Anything · watch it refuse to guess**
> The mobile app crashes when I rotate the screen on the approvals page.

## Integrating from another repo

The chat SDK lives in `frontend/src/brain-chat` and is published as
`@procol/brain-chat`. In a host application — the real client dashboard, or
anything else — point it at this service:

```tsx
import { ProcolBrain } from '@procol/brain-chat'
import '@procol/brain-chat/styles.css'   // required: the SDK ships its CSS separately

<ProcolBrain
  companyId="procol"                         // the tenant; decides which control tower
  userId={currentUser.email}
  apiBaseUrl="http://localhost:4000/api/chat"
  context={{ currentPage: 'grn-flexi', currentModule: 'GRN', recordId: grn.number }}
/>
```

`apiBaseUrl="http://localhost:4000"` works too — the widget API is served at
both the root and `/api/chat`. Anything else 404s, and the 404 body tells you
the base paths.

Three things that catch people out:

- **The stylesheet is a separate entry point.** Without the `styles.css`
  import the widget renders as unstyled text in the page flow. If it looks
  broken rather than absent, this is why.
- **`companyId` must match a workspace** (`procol`, `acmecloud`). An unknown
  value falls back to the default tower rather than erroring, so a typo shows
  up as tickets landing in the wrong place.
- **CORS is open by default** (`CORS_ORIGIN=*`). Set it to your host's origin
  before this is reachable by anything you do not control.

Confirm the wiring in one command before touching the UI:

```bash
curl -s -X POST http://localhost:4000/issues/search \
  -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
  -d '{"identity":{"companyId":"procol"},"message":"Our invoices show GST of 12% instead of 18%"}'
```

A match with a confidence comes back if the service, the workspace and the
memory index are all healthy.

## Driving it without a browser

```bash
# raise a ticket exactly as a client dashboard's chat would
curl -s -X POST localhost:4000/api/demo/simulate -H 'content-type: application/json' \
  -d '{"workspaceId":"acmecloud","message":"All our users get 401 Unauthorized after your deployment"}'

# watch the run stream
curl -N localhost:4000/api/tickets/ACME-7791/stream

# approve at the gate
curl -s -X POST localhost:4000/api/tickets/ACME-7791/decision -H 'content-type: application/json' \
  -d '{"outcome":"APPROVED","by":"Anshul Sharma"}'

# an agent card, as a judge would read it
curl -s localhost:4000/agents/acme-knowledge/.well-known/agent-card.json

# the exact A2A envelope and reply for one hop
curl -s localhost:4000/api/tickets/ACME-7791/tasks

# back to the opening board between rehearsals
curl -s -X POST localhost:4000/api/demo/reset
```

## Layout

```
src/
  index.ts              express bootstrap; seeds after the socket opens
  env.ts                zod-validated environment, fails loudly at boot
  store.ts              the one in-memory store every surface shares
  events.ts             event bus; the SSE hub is just a subscriber
  domain/
    types.ts            the domain model — no company appears in it
    playbooks.ts        the cases, written as data
    workspace.*.ts      one file per control tower
    knowledge.ts        what the knowledge agents read
    memory.ts           institutional memory learned before today
  brain/
    classify.ts         a sentence -> a workspace and a playbook
    orchestrator.ts     the state machine
    registry.ts         agent discovery and the capability index
    a2aClient.ts        real HTTP hops, timed and recorded
    policy.ts           what needs a human, and why
    project.ts          the store -> the chat widget's vocabulary
  agents/
    server.ts           each agent as its own HTTP service + card
    handlers.ts         what each agent does with a task
  routes/               console, chat, demo, stream, errors
  seed.ts               the opening board, produced by the real orchestrator
```

## Notes for when this grows up

- **State** is in memory with a JSON snapshot (`STATE_FILE`), so a restart
  mid-rehearsal keeps the board. Replacing it with Prisma is a change to
  `store.ts`; nothing above it holds state.
- **Agents** are mounted in this process behind `/agents/<id>`. Set
  `AGENT_MODE=separate` and they are read from `AGENT_URLS` instead — the
  orchestrator calls them over the same client either way, so the protocol does
  not change. Say that plainly if asked: in development they are four
  processes, co-deployed for the demo, identical protocol.
- **Classification** is a scored keyword matcher in `classify.ts`. That is the
  first place an LLM belongs, and swapping it changes nothing else.
- **Run speed** is `RUN_SPEED`. 1 is the scripted agent latency; 0.4 fits a
  full run in a demo slot; the seeder uses 0 to play runs out instantly.
