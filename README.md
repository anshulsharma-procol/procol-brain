# Procol Brain

An orchestration layer. A request arrives — a customer's sentence, a monitoring
signal, a business event — and Brain decides what it needs, delegates to
specialist agents over an open protocol, collects their work, stops at the
human gates you define, and records every step on one timeline.

The claim is not "a better support AI". It is: **your company already has AI —
this makes it work together.** Procol's knowledge agent is Clara. Another
company's is their own. Brain routes on declared capability, so it never needed
to know the difference.

## Repository

| Folder | What it is |
| --- | --- |
| [backend/](backend/) | the orchestrator, the agents and the API |
| [frontend/](frontend/) | the internal console, plus the embeddable chat SDK in `src/brain-chat` |
| [docs/](docs/) | contracts, architecture and the demo script |

## Running the whole thing

```bash
# terminal 1 — the API, on :4000
cd backend && npm install && npm run dev

# terminal 2 — the console, on :5173
cd frontend && npm install && cp .env.example .env.local && npm run dev
```

Open the console, and the chat launcher in its bottom-right corner is the
customer's side of the same product. Type an issue there and it appears on the
internal board immediately — same ticket, same timeline, same store.

Delete `frontend/.env.local` and the console falls back to the scenario files
it ships with, so the frontend still demos with the backend stopped.

## The two demo situations

Both run through the same orchestrator, the same protocol and the same approval
gate. Switch control towers in the sidebar.

**1 · Procol.** "Our March invoices show GST of 12% instead of 18%." Clara
supplies the tenant's tax configuration, the dev agent finds that tenant
context never reaches the calculator and opens PR #452, the QA agent runs 47
tests, Lens reports 14 other tenants are affected, and the run stops for a
human because code changes to billing always do.

**2 · AcmeCloud.** "All our users are getting 401 Unauthorized since your
deployment." A generic SaaS company with no Clara: their own Company Knowledge
Agent answers instead, recalls incident INC-382, and the identical pipeline
produces PR #892 and 32 passing tests.

The line to say over the second one: *the workflow did not change. We replaced
Procol's Clara with the customer's own knowledge agent, because Brain routes on
capability rather than on the name of an agent.*

More prompts, including a configuration fix, a question that resolves without
an approval gate, and a ticket Brain refuses to guess at, are in
[backend/README.md](backend/README.md).

## What is real, and what is not

Real: the API, the SSE streams, the state machine, capability routing, the A2A
envelopes travelling over HTTP between separate agent endpoints, the measured
latency of every hop, the human gate, the audit trail, and the institutional
memory that makes the second identical ticket cheap.

Scripted: what the agents answer. The knowledge agent is not searching a real
index and the dev agent is not really reading a repository — those answers live
in `backend/src/domain/playbooks.ts`.

Never: inventing an answer. An unrecognised ticket is handed to a person with
nothing attached.

## Documents

| Doc | Use it for |
| --- | --- |
| [docs/CONSOLE_API_CONTRACT.md](docs/CONSOLE_API_CONTRACT.md) | the internal console's API |
| [docs/BACKEND_API_CONTRACT.md](docs/BACKEND_API_CONTRACT.md) | the customer chat widget's API |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | A2A between agents, MCP to tools, connectors to systems |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | the five minutes, minute by minute |
| [frontend/src/platform/README.md](frontend/src/platform/README.md) | adding a customer or a case to the console |
| [backend/README.md](backend/README.md) | the orchestrator, the playbooks and the demo prompts |

## Team

Anshul — frontend · Ayush — backend · Shrawan — product, design, presentation
