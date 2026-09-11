# API contract

The shared boundary between backend and frontend. Both read this file.

**Frozen.** If you change anything here, say so out loud in the room — this is
the one document where a silent change costs two people an hour each.

The TypeScript source of truth is [`contracts/api.ts`](../contracts/api.ts).
It is copied into both packages by `npm run contract:sync`, and
`npm run contract:check` fails if a copy has drifted. Edit that file, never a
copy. The JSON below is those types rendered.

To check a service against it: `cd backend && npm run conform -- <base-url>`.

## 0. Conventions

| Rule | Detail |
| --- | --- |
| Base | `/api` — relative in both dev and production, never an absolute host |
| Lists | always wrapped: `{ "data": [...] }` |
| Single objects | returned bare, not wrapped |
| Errors | `{ "error": { "code": "NOT_FOUND", "message": "Ticket PRO-9999 does not exist" } }` — never a stack trace |
| Status codes | 200 read, 201 create, 202 accepted (async run started), 400 bad input, 404 missing, 409 conflict, 500 unexpected |
| Timestamps | ISO 8601 with timezone |
| Ordering | `activities` order by `seq` ascending. Never by timestamp |
| IDs | tickets are human-readable (`PRO-1245`); everything else is a cuid |
| Unknown fields | the frontend ignores them. The backend may add, never rename |

## 1. Shared types

See [`contracts/api.ts`](../contracts/api.ts). In summary:

- `Priority` LOW · MEDIUM · HIGH · CRITICAL
- `Channel` email · portal · slack · signal · event
- `Category` BUG · CONFIG · QUESTION · PROCESS
- `TicketStatus` NEW · RUNNING · AWAITING_APPROVAL · RESOLVED · NEEDS_HUMAN · REJECTED
- `RunState` RECEIVED · CLASSIFYING · GATHERING_CONTEXT · DECIDING · INVESTIGATING · VERIFYING · DRAFTING_REMEDIATION · DRAFTING_REPLY · EXECUTING_PROCESS · AWAITING_APPROVAL · RESOLVED · NEEDS_HUMAN
- `RunPath` CODE_FIX · CONFIG_FIX · ANSWER_ONLY · PROCESS
- `ArtifactKind` ROOT_CAUSE · PR · TEST_RESULT · CONFIG_FIX · CUSTOMER_REPLY · IMPACT · PROCESS_RESULT
- `ActivityType` ticket.created · run.started · run.state · brain.thought · a2a.request · a2a.response · agent.log · artifact.created · run.awaiting_approval · run.completed · agent.status · signal.raised

The parsing rule: `Task.input`, `Task.output` and `Artifact.data` are sent as
parsed objects — the frontend never calls `JSON.parse` on a response.
`Activity.body` is the exception and stays a string, because it is either
prose or a payload blob the UI shows verbatim.

## 2. Endpoints

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/tickets?status=` | `{ data: (Ticket & { run, stage })[] }` |
| POST | `/tickets` | 201 `Ticket` |
| GET | `/tickets/:id` | `{ ticket, run, artifacts, insight }` |
| GET | `/tickets/:id/activities` | `{ data: Activity[] }` ordered by `seq` |
| GET | `/tickets/:id/tasks` | `{ data: Task[] }` |
| POST | `/tickets/:id/investigate` | 202 `{ runId, state }` — 200 with the same run if one is active |
| POST | `/tickets/:id/decision` | `{ ticket, run, artifacts }` — 409 if not AWAITING_APPROVAL |
| GET | `/agents` | `{ data: Agent[] }` |
| GET | `/agents/:id` | `{ agent, card, recentTasks }` — `card` verbatim, unnormalised |
| GET | `/connectors` | `{ data: Connector[] }` |
| GET | `/stats` | `{ active, aiWorking, needsApproval, resolvedToday, avgResolutionMins }` |
| GET | `/insights?ticketId=` | `{ affectedTenants, affectedRecords, firstSeen, trend }` |
| POST | `/ask` | discriminated on `shape`: number · table · series, `sql` always present |
| POST | `/signals` | `{ signal, ticket \| null }` — `escalate: true` creates the ticket and starts the run |
| GET | `/processes` | `{ data: ProcessDefinition[] }` |
| POST | `/processes/:key/run` | 202 `{ ticketId, runId }` |
| GET | `/stream` | SSE, everything |
| GET | `/tickets/:id/stream` | SSE, one ticket |

`stage` drives the four-dot rail: each key is `null` (not reached) or the id
of the agent that completed it, which is how the dot picks its colour. A stage
the chosen path never had is also `null` — read `run.path` to tell the two
apart, because a CONFIG_FIX never had an investigate stage to reach.

`investigate` must return immediately; the UI follows over SSE. A frontend
blocked on a 40-second request is how demos die.

## 3. Artifact payloads

`Artifact.data`, discriminated by `kind`. The approval panel depends on these
exact shapes — see `contracts/api.ts` for the full definitions.

```ts
ROOT_CAUSE     { summary, detail, confidence }              // confidence 0–1
PR             { number, url, state, branch, files,
                 additions, deletions, patch }              // patch is a unified diff
TEST_RESULT    { status, total, passed, failed,
                 durationMs, suites, failures }
CONFIG_FIX     { summary, steps, system }
CUSTOMER_REPLY { subject, body, sentTo }
IMPACT         { affectedTenants, affectedRecords, firstSeen }
PROCESS_RESULT { processKey, stepsCompleted, records }
```

`PR.state` is `created`, `merged` or `mock`. A deployment running a mock code
host sends `mock` and means it — claiming `merged` for a pull request nobody
opened is the kind of detail that loses a room.

## 4. SSE

The event name is on the `event:` line; the payload on `data:`.

```
event: a2a.response
data: {"ticketId":"PRO-1245","seq":11,"activityId":"act_...","taskId":"TASK-8f21",
       "from":"clara","to":"brain","status":"completed","summary":"Expected GST 18%…","durationMs":820}

: ping
```

Every payload carries `activityId` and `seq`. That is what makes the
history-plus-stream join safe: fetch `/activities`, open the stream, drop any
event whose `activityId` you already hold. Without those two fields the entry
at the boundary renders twice, which is the commonest bug in this kind of UI
and the hardest to spot in a demo.

Server headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
`Connection: keep-alive`, `X-Accel-Buffering: no`, then `res.flushHeaders()`.
Ping every 20s.

| Event | Payload beyond `ticketId`, `seq`, `activityId` |
| --- | --- |
| `ticket.created` | `ticket` |
| `run.started` | `runId` |
| `run.state` | `runId`, `state`, `path`, `attempt` |
| `brain.thought` | `text` |
| `a2a.request` | `taskId`, `from`, `to`, `type`, `summary` |
| `a2a.response` | `taskId`, `from`, `to`, `status`, `summary`, `durationMs` |
| `agent.log` | `taskId`, `agent`, `line` |
| `artifact.created` | `artifact` |
| `run.awaiting_approval` | `runId`, `policyReason` |
| `run.completed` | `runId`, `outcome` |
| `agent.status` | `agentId`, `status` (no `ticketId`) |
| `signal.raised` | `signal`, `ticketId` or null |

How the frontend renders each activity type:

| type | Rendering |
| --- | --- |
| `brain.thought` | prose entry, left rule in the orchestrator's colour |
| `a2a.request` | exchange header `from → to` with the task type in mono; `body` behind "show payload" |
| `a2a.response` | the same entry as its request (matched on `taskId`), `durationMs` replacing the live counter |
| `agent.log` | indented `›` sub-line under the entry with the same `taskId` |
| `artifact.created` | no timeline entry — the artifact column handles it |
| `run.state` | skipped when the stage rail already shows it; a person's decision is kept |
| `run.awaiting_approval` | triggers the approval panel |

## 5. Working offline

`frontend/src/platform/api/fixtures.json` is a capture of real responses keyed
by `"METHOD /path"`, refreshed with `npm run fixtures:capture`. With
`VITE_BRAIN_API_URL` unset the console serves those through the same client
that talks to the network, so the fixtures are parsed by exactly the code the
live path uses. Nothing streams in that mode.

## 6. This deployment's additions

Everything here is **additive** and optional. A contract-compliant backend
that implements none of it serves a console that shows slightly less, which is
the property that makes pointing at another backend a URL change.

**Extra fields on contract objects** — ignored by anything that does not know
them:

| Object | Field | Why |
| --- | --- | --- |
| `Ticket` | `categoryLabel` | the enum has four values; people say "Billing & invoicing" |
| `Ticket` | `workspaceId` | which control tower owns it |
| `Ticket` | `reportedBy`, `impact`, `issueQuote`, `attachment` | what the issue panel shows |
| `Ticket` | `currentAgentId`, `currentAgentAction` | who holds it now; otherwise inferred from `run.state` |
| `Agent` | `role`, `ownership` | the UI paints colour by role; `kind` is coarser |
| `Connector` | `name`, `dataMode` | a display name, and what crosses the boundary |
| `ROOT_CAUSE` | `evidence` | the lines behind the conclusion |
| `TEST_RESULT` | `cases` | the named assertions, for the approval panel |
| `CONFIG_FIX` | `change` | the exact setting, next to the human steps |

**Extra endpoints:**

| Path | Why |
| --- | --- |
| `GET /workspaces` | the contract is single-tenant; this serves several |
| `GET /memory`, `POST /memory/search` | institutional memory — what the tower has already solved |
| `GET /knowledge` | what the knowledge agent reads |
| `POST /demo/reset`, `POST /demo/simulate`, `GET /demo/playbooks` | rehearsal controls |
| `/api/chat/*` | the customer chat widget — see [BACKEND_API_CONTRACT.md](BACKEND_API_CONTRACT.md) |

Every one of these is probed once by the console and disabled quietly on a
404.

## 7. Changing this contract

1. Say it out loud in the room before you change it.
2. Update `contracts/api.ts` first, then `npm run contract:sync`; both sides
   compile against it.
3. Additive changes are free. Renames and removals are not — after hour 6, add
   a new field rather than renaming an old one, even if the old name is wrong.
   You can rename it next week.
