# API contract

The shared boundary between backend and frontend. Both read this file.

Transcribed from the backend's own `FRONTEND.md`, which is generated from the
code the server runs. **Where this document and a live server disagree, the
server is right** — `GET /api/contract` on any deployment says what it
actually serves, and this file is what needs correcting.

**Frozen.** If you change anything here, say so out loud in the room — this is
the one document where a silent change costs two people an hour each.

The TypeScript source of truth is [`contracts/api.ts`](../contracts/api.ts).
It is copied into both packages by `npm run contract:sync`, and
`npm run contract:check` fails if a copy has drifted. Edit that file, never a
copy. The JSON below is those types rendered.

To check a service against it: `cd backend && npm run conform -- <base-url>`.
Twenty-four checks, every endpoint and every artifact payload. Run it against
a new host before anyone opens a browser: what it reports is exactly what
would have broken on screen.

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
- `ResolutionPath` CODE_FIX · CONFIG_FIX · ANSWER_ONLY · PROCESS
- `ArtifactKind` ROOT_CAUSE · PR · TEST_RESULT · CONFIG_FIX · CUSTOMER_REPLY · IMPACT · PROCESS_RESULT
- `ActivityType` ticket.created · run.started · run.state · brain.thought · a2a.request · a2a.response · agent.log · artifact.created · run.awaiting_approval · run.completed · agent.status · signal.raised

The parsing rule: everything is sent parsed. `Task.input`, `Task.output` and
`Artifact.data` are objects, never JSON strings — the frontend never calls
`JSON.parse` on a response field.

## 2. Endpoints

| Method | Path | Returns |
| --- | --- | --- |
| GET | `/tickets?status=` | `{ data: Ticket[] }` |
| POST | `/tickets` | 201 `Ticket` |
| GET | `/tickets/:id` | `{ ticket, run, artifacts, approval, signal }` |
| GET | `/tickets/:id/activities` | `{ data: Activity[] }` ordered by `seq` |
| GET | `/tickets/:id/tasks` | `{ data: Task[] }` |
| POST | `/tickets/:id/investigate` | 202 `{ runId, started }` — 200 with `started: false` if one is active |
| POST | `/tickets/:id/decision` | `{ decision, ticketStatus, runState, reply? }` — 409 if not AWAITING_APPROVAL |
| GET | `/runs/:runId` | `{ run, tasks, steps }` |
| GET | `/agents` | `{ data: Agent[] }` |
| GET | `/agents/capabilities` | `{ data: { capability, agentIds }[] }` |
| GET | `/agents/:id` | `{ card, recentTasks }` — `card` verbatim, unnormalised |
| GET | `/connectors` | `{ data: Connector[] }` |
| GET | `/stats` | `{ active, aiWorking, needsApproval, resolvedToday, avgResolutionMins }` |
| GET | `/insights?ticketId=` | `{ affectedTenants, affectedRecords, firstSeen, trend, sql }` |
| POST | `/ask` | discriminated on `shape`: number · table · series, `sql` always present |
| GET | `/ask/examples` | `{ data: string[] }` |
| GET | `/signals` | `{ data: Signal[] }` |
| POST | `/signals` | `{ signal, ticket \| null }` — `escalate: true` creates the ticket and starts the run |
| GET | `/policies` | `{ data: { id, reason }[] }` |
| GET | `/processes` | `{ data: ProcessDefinition[] }` |
| POST | `/processes/:key/run` | 202 `{ ticketId, runId, started, processKey }` |
| GET | `/contract` | what this deployment serves, and what it adds |
| GET | `/stream` | SSE, everything |
| GET | `/tickets/:id/stream` | SSE, one ticket |

`approval` is `null` until a policy applies, then `{ required, policyId,
reason }`. Render `reason` above the buttons — a rule nobody can read is not
governance. `required` goes false once the decision is in and the policy
stays, because the page still has to say which rule stopped the run.

`investigate` must return immediately; the UI follows over SSE. A frontend
blocked on a 40-second request is how demos die. `started` distinguishes a new
run from joining one in flight, so a double click is safe and says so.

## 3. Artifact payloads

`Artifact.data`, discriminated by `kind`. The approval panel depends on these
exact shapes — see `contracts/api.ts` for the full definitions.

```ts
ROOT_CAUSE     { rootCause, file, confidence, attempt }     // confidence 0–1
PR             { number, url, state, real, note?, branch,
                 title, body, filesChanged, diff }          // diff is unified
TEST_RESULT    { status, total, passed, failed, durationMs,
                 suites, failures, message, branch, attempt }
CONFIG_FIX     { title, steps, rationale,
                 requiresCodeChange, citations, customer }
CUSTOMER_REPLY { subject, body, citations?, sentAt?, approvedBy? }
IMPACT         { affectedTenants, affectedRecords, firstSeen,
                 trend, sql, source }
PROCESS_RESULT { key, name, completed, pending, input }
```

`PR.real` is the field that matters. False means the pull request was never
opened — the patch exists on `branch` and `note` says why. **Do not render the
url as a live link in that case.** An unclickable link that looks clickable is
worse than saying plainly that it is a patch on a branch, and it is the one
detail on this screen a judge can check.

`CONFIG_FIX.requiresCodeChange: false` is the point of that whole path: Brain
decided engineering was not needed. `IMPACT.sql` and every `/ask` answer carry
the query behind the number — a figure with its SQL attached is evidence, and
the same figure alone is something a reader assumes was invented.

## 4. SSE — an activity row *is* an SSE payload

The same object, down to the field. One consequence is worth stating plainly:
there is nothing to reassemble on the client. Fetch `/activities`, open the
stream, append what arrives.

```
id: act_mtxeh4c40010883c564c
event: a2a.response
data: {"id":"act_mtxeh4c40010883c564c","seq":11,"type":"a2a.response","ticketId":"PRO-1245",
       "at":"2026-09-12T01:59:04.112Z","taskId":"TASK-8f21","from":"clara","to":"brain",
       "status":"completed","summary":"Expected GST 18%…","durationMs":820}

: ping
```

Five fields on every row: `id`, `seq`, `type`, `ticketId`, `at`. The event
name on the `event:` line is always the payload's own `type`, so subscribing
by name and switching on the field see the same thing.

**Dedupe on `id`. Order on `seq`. Never order on `at`** — millisecond
collisions are guaranteed and events can land out of order. Without the id and
the seq the entry at the history/stream boundary renders twice, which is the
commonest bug in this kind of UI and the hardest to spot in a demo.

The `id:` line is there so a dropped connection replays what it missed via
`Last-Event-ID` — the difference between a reconnect that heals and one that
leaves a hole in the timeline.

Server headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`,
`Connection: keep-alive`, `X-Accel-Buffering: no`, then `res.flushHeaders()`.
Ping every 20s.

| `type` | Payload beyond the five envelope fields |
| --- | --- |
| `ticket.created` | `ticket` |
| `run.started` | `runId` |
| `run.state` | `runId`, `state`, `path`, `attempt` |
| `brain.thought` | `text` |
| `a2a.request` | `taskId`, `from`, `to`, `taskType`, `summary` |
| `a2a.response` | `taskId`, `from`, `to`, `status`, `summary`, `durationMs` |
| `agent.log` | `taskId`, `agent`, `line` |
| `artifact.created` | `artifact` — the whole thing, no refetch |
| `run.awaiting_approval` | `runId`, `policyId`, `policyReason` |
| `run.completed` | `runId`, `outcome` |
| `agent.status` | `agentId`, `status` — `seq` is `-1` and it is not ticket-scoped. Keep it out of a timeline |
| `signal.raised` | `signal` |

How the frontend renders each activity type:

| type | Rendering |
| --- | --- |
| `brain.thought` | prose entry, left rule in the orchestrator's colour |
| `a2a.request` | exchange header `from → to` with the summary in mono; the envelope behind "show payload" |
| `a2a.response` | the same entry as its request (matched on `taskId`), `durationMs` replacing the live counter. The direction stays `brain → agent`: a hop is one act with two ends |
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
| `CONFIG_FIX` | `system`, `change` | the exact setting, next to the human steps |
| `CUSTOMER_REPLY` | `sentTo` | the address it went to |
| `PR` | `additions`, `deletions` | the diff stat on the card header |

**Extra endpoints:**

| Path | Why |
| --- | --- |
| `GET /tickets` → `run`, `stage` | the contract's list is bare tickets, so a board reading a compliant backend has only the status. These let it draw the four-dot rail without a request per row |
| `GET /tickets/:id` → `stage`, `decision` | the rail and who decided, without reconstructing both from the timeline |
| `GET /workspaces` | the contract is single-tenant; this serves several |
| `GET /memory`, `POST /memory/search` | institutional memory — what the tower has already solved |
| `GET /knowledge` | what the knowledge agent reads |
| `GET /connection-types`, `POST`/`DELETE` `/connectors` | the Connections screen |
| `POST /demo/reset`, `POST /demo/simulate`, `GET /demo/playbooks` | rehearsal controls |
| `/api/chat/*` | the customer chat widget — see [BACKEND_API_CONTRACT.md](BACKEND_API_CONTRACT.md) |

Every one of these is probed once by the console and disabled quietly on a
404. `GET /api/contract` lists them under `extensions`, separately from the
contract's own endpoints — which is the honest way to publish them: a client
that depends on one has quietly stopped being portable, and should be able to
find that out.

**Additive fields on activity rows.** Each has a fallback, so a compliant
backend that omits them renders a transcript that reads correctly and is only
less detailed:

| `type` | Field | Fallback when absent |
| --- | --- | --- |
| `brain.thought` | `heading`, `detail` | `text` carries the whole thought and renders as one paragraph |
| `a2a.request` | `payload` | no "show payload" disclosure |
| `a2a.response` | `detail` | the summary stands alone |
| `run.state` | `action` | the state name |
| `run.completed` | `summary` | the outcome alone |
| `ticket.created` | `via` | "raised", without the channel |

## 7. Changing this contract

1. Say it out loud in the room before you change it.
2. Update `contracts/api.ts` first, then `npm run contract:sync`; both sides
   compile against it.
3. Additive changes are free. Renames and removals are not — after hour 6, add
   a new field rather than renaming an old one, even if the old name is wrong.
   You can rename it next week.
