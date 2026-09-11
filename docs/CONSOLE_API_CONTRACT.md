# Console API contract

What the **internal console** (the control tower at `frontend/src/pages`) sends
and expects. The customer-facing chat widget has its own, narrower contract in
`BACKEND_API_CONTRACT.md`; this is the other half.

**These endpoints are implemented** — see `backend/`. The console runs against
them as soon as `VITE_BRAIN_API_URL` is set; with the variable unset it falls
back to the scenario files in `frontend/src/platform/scenarios/` and behaves
identically, so the frontend still demos with the backend stopped.

Switching over is one environment variable:

```bash
# frontend/.env.local
VITE_BRAIN_API_URL=https://brain.procol.in/api
VITE_BRAIN_API_TOKEN=...     # optional; sent as Authorization: Bearer
```

The TypeScript source of truth is `frontend/src/platform/api/types.ts`
(`ConsoleApi`) and `frontend/src/platform/types.ts` (the domain model). The
HTTP adapter that consumes these endpoints is `platform/api/httpApi.ts` — about
100 lines, and the only file that has to change if a shape moves.

## Conventions

- Lists return `{ "data": [...] }`.
- Errors return `{ "error": { "code": "...", "message": "..." } }` — one shape,
  always, and never a stack trace.
- Everything is scoped to a **workspace**: one company's control tower. The
  workspace id is the tenant key (`procol`, `acmecloud`).
- Ticket references (`PRO-1245`) are the public id and are used in URLs.

## Endpoints

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/workspaces` | `Workspace[]` |
| GET | `/workspaces/:id` | `Workspace` |
| GET | `/workspaces/:id/stats` | `WorkspaceStats` |
| GET | `/workspaces/:id/tickets?status=A,B` | `Ticket[]` |
| GET | `/workspaces/:id/memory` | `MemoryEntry[]` |
| POST | `/workspaces/:id/memory/search` | `MemoryMatch[]` — body `{ query }` |
| GET | `/workspaces/:id/knowledge` | `KnowledgeEntry[]` |
| GET | `/tickets/:ref` | `TicketDetail` |
| POST | `/tickets` | `Ticket` |
| POST | `/tickets/:ref/investigate` | `202 { runId }`, immediately |
| POST | `/tickets/:ref/decision` | `TicketDetail` — body `{ outcome, by, note? }` |
| GET | `/tickets/:ref/stream` | SSE |
| GET | `/workspaces/:id/stream` | SSE |

`investigate` **must** return immediately and let the UI follow over SSE. A
console blocked on a 40-second request is how a demo dies.

## The three shapes that matter

### `Workspace` — one company's control tower

The console renders agents by their **role**, never by their id, which is why
Procol's `clara` and AcmeCloud's `acme-knowledge` need no client-side
special-casing. Roles: `orchestrator`, `knowledge`, `engineering`,
`validation`, `approval`, `analytics`, `process`.

```json
{
  "id": "acmecloud",
  "name": "AcmeCloud",
  "product": "AcmeCloud Platform",
  "ticketPrefix": "ACME",
  "agents": [
    {
      "id": "acme-knowledge",
      "name": "Company Knowledge Agent",
      "shortLabel": "CK",
      "role": "knowledge",
      "protocol": "A2A",
      "capabilities": ["product_knowledge", "customer_context", "document_search"],
      "tools": [{ "name": "Internal documentation", "server": "confluence", "via": "MCP" }],
      "status": "connected",
      "ownership": "customer"
    }
  ],
  "connectors": [ ... ],
  "approvalPolicies": [
    { "id": "production-auth", "appliesTo": ["PR"], "risk": "high",
      "reason": "Changes to authentication in production always require human approval." }
  ]
}
```

### `ActivityEvent` — the audit trail

One row per transition, written for **every** step including the boring ones. A
run with 14 entries feels alive; one with 4 feels fake.

```json
{
  "id": "ACME-7821-act-5",
  "ticketId": "ACME-7821",
  "seq": 5,
  "type": "a2a.response",
  "fromAgent": "acme-knowledge",
  "toAgent": "brain",
  "taskType": "GET_PRODUCT_CONTEXT",
  "title": "Authentication uses JWT; yesterday's release changed the issuer configuration",
  "body": ["..."],
  "logs": ["searched internal documentation — 3 matches", "read release notes 2026.09.10"],
  "level": "success",
  "durationMs": 940,
  "payload": { "taskId": "TASK-11c2", "status": "completed", "agent": "acme-knowledge", "result": {} },
  "timestamp": "2026-09-11T21:24:14.000Z"
}
```

`type` is one of `ticket.created`, `run.started`, `brain.thought`,
`a2a.request`, `a2a.response`, `agent.log`, `artifact.created`,
`run.awaiting_approval`, `human.decision`, `customer.notified`,
`run.completed`.

Two things the console depends on:

- **`seq` is monotonic per ticket and allocated server-side**, in the same
  transaction as the insert. The console orders by it, never by timestamp —
  timestamps collide at millisecond resolution and the timeline renders out of
  order without it.
- **`payload` is the raw A2A envelope.** It is what the "show payload"
  disclosure reveals when someone asks how the agents actually talk to each
  other, so send it whenever there is one.

### `TicketDetail` — everything one ticket page needs, in one fetch

```json
{
  "ticket": { "reference": "ACME-7821", "workspaceId": "acmecloud", "status": "AWAITING_APPROVAL",
              "path": "CODE_FIX", "progress": 88, "stages": [ ... ], "...": "" },
  "stages": [
    { "id": "context", "label": "Context", "status": "complete", "agentId": "acme-knowledge" },
    { "id": "investigate", "label": "Investigate", "status": "complete", "agentId": "dev-agent" },
    { "id": "verify", "label": "Verify", "status": "complete", "agentId": "qa-agent" },
    { "id": "approve", "label": "Approve", "status": "active", "agentId": "human-approver" }
  ],
  "activity": [ ... ],
  "artifacts": [ ... ],
  "memoryMatches": [ { "entry": { }, "confidence": 0.83, "reason": "Matched on 401, auth, deployment" } ],
  "approvalPolicy": { "id": "production-auth", "reason": "...", "risk": "high" },
  "decision": { "outcome": "APPROVED", "by": "Anshul Sharma", "at": "..." }
}
```

A stage may be `skipped`. A configuration fix returns `context: complete`,
`investigate: skipped`, `verify: skipped` — which is how the board shows Brain
taking a visibly shorter path without any client-side logic that names a case.

Artifact kinds: `ROOT_CAUSE`, `PR`, `TEST_RESULT`, `CONFIG_FIX`,
`CUSTOMER_REPLY`, `IMPACT`, `PROCESS_RESULT`. Shapes are in `platform/types.ts`.

## SSE

`event:` is set to the message type, one JSON object per `data:` line.

| Event | Payload |
| --- | --- |
| `ticket.updated` | the full `TicketDetail` |
| `board.updated` | `{ workspaceId }` |

Sending the whole `TicketDetail` on every update means a consumer never has to
re-fetch to stay consistent, and a browser refresh mid-run rebuilds an
identical timeline. Headers that matter behind a proxy: `Cache-Control:
no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`, and call
`res.flushHeaders()`. If events arrive in a burst at the end, buffering is the
cause.

## Institutional memory

`POST /workspaces/:id/memory/search` is what makes the product compound. The
console calls it with the ticket's symptoms and shows the hits on the ticket
page before anyone is asked to look at it.

```json
{ "entry": { "id": "mem-acme-inc-382", "sourceTicketRef": "INC-382",
             "title": "Tenant-wide 401s traced to an environment variable drift",
             "symptom": "All users rejected at login shortly after a release",
             "rootCause": "...", "resolution": "...", "path": "CODE_FIX",
             "tags": ["401", "auth", "jwt", "deployment"],
             "reuseCount": 1, "minutesSavedPerReuse": 240, "learnedAt": "2026-01-19" },
  "confidence": 0.83,
  "reason": "Matched on 401, auth, deployment" }
```

The console does not care how `confidence` is produced — tag overlap today,
embeddings on the backend — as long as it is `0..1`. An entry is written when a
run is approved; `reuseCount` and `minutesSavedPerReuse` drive the "hours
saved" figure on the board, so they should be measured, not estimated.
