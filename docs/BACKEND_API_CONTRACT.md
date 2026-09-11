# Brain API contract

What the chat widget sends and expects. Until these exist, the widget runs on
`src/data/demoScenario.ts` and behaves identically — so the frontend is never
blocked.

Switching over is one prop:

```tsx
<ProcolBrain companyId="procol" apiBaseUrl="https://brain-api.procol.in" />
```

Every request body carries identity and host context:

```json
{
  "identity": { "companyId": "procol", "userId": "user-123" },
  "context": { "currentPage": "invoices", "currentModule": "Invoices", "recordId": "INV/2026/1183" }
}
```

## Endpoints

### `POST /issues/search`
Similarity search over resolved tickets. Runs before any investigation starts.

```json
// request:  { identity, context, "message": "Invoice GST is 12%, should be 18%" }
// response:
[
  {
    "id": "issue-892",
    "reference": "892",
    "title": "GST calculation incorrect",
    "customer": "XYZ Corp",
    "solution": "Tenant GST configuration was not being passed to the invoice calculator.",
    "confidence": 0.94,
    "url": "https://console.procol.in/tickets/892"
  }
]
```
Return `[]` when nothing matches — the widget then opens a ticket and starts an
investigation. `confidence` and `url` are optional.

### `POST /tickets`
```json
// request:  { identity, context, "message": "..." }
// response:
{
  "id": "PRO-1245",
  "reference": "1245",
  "title": "Invoice GST calculation incorrect",
  "status": "open",
  "createdAt": "2026-09-11T12:04:00Z"
}
```
`status`: `open` | `investigating` | `awaiting_approval` | `resolved`.

### `GET /tickets/:id`
Same shape as above. Used to poll status.

### `POST /tickets/:id/investigate`
Kicks off the Brain orchestration. Returns immediately (`202` or `{ "ok": true }`);
progress is read from the activity endpoint.

### `GET /tickets/:id/activity`
The endpoint that drives the whole demo. Called on an interval until
`resolution` is present.

```json
{
  "ticketId": "PRO-1245",
  "steps": [
    { "id": "understand", "label": "Understanding the issue",   "status": "complete" },
    { "id": "context",    "label": "Fetching product context",  "status": "complete", "agent": "Clara" },
    { "id": "code",       "label": "Investigating code",        "status": "active",   "agent": "Development Agent" },
    { "id": "validate",   "label": "Running validation",        "status": "pending",  "agent": "QA Agent" },
    { "id": "approval",   "label": "Waiting for approval",      "status": "pending",  "agent": "Manager" }
  ],
  "activity": [
    {
      "id": "act-1",
      "from": "procol-brain", "to": "clara",
      "via": "A2A", "kind": "request",
      "text": "What should GST be for ABC Corp?",
      "taskId": "TASK-123",
      "at": "2026-09-11T12:04:02Z"
    },
    {
      "id": "act-2",
      "from": "clara", "to": "procol-brain",
      "via": "A2A", "kind": "response",
      "text": "Expected GST = 18%. ABC Corp: GST 18%, Discount 10%."
    },
    {
      "id": "act-4",
      "from": "dev-agent", "to": "github",
      "via": "MCP", "kind": "tool",
      "text": "Read invoiceCalculator.ts, opened branch fix/gst-tenant-context",
      "tool": { "server": "github", "call": "read_file + create_branch" }
    }
  ],
  "resolution": null
}
```

`status` per step: `pending` | `active` | `complete`.
`via`: `A2A` for agent→agent, `MCP` for agent→tool. `kind`: `request` |
`response` | `tool`. Send the **full** activity array each time — the widget
renders whatever it receives and does not merge deltas.

Once the agents finish, the same payload carries a resolution:

```json
"resolution": {
  "ticketId": "PRO-1245",
  "summary": "Your issue has been fixed and is ready for approval.",
  "rootCause": "Tenant context was not passed to the GST calculator, so the default 12% slab was applied.",
  "checks": [
    { "label": "Root cause identified", "status": "complete" },
    { "label": "Fix implemented",       "status": "complete" },
    { "label": "QA validation",         "status": "complete" }
  ],
  "pr": { "number": 452, "status": "created", "title": "fix: pass tenant GST config to invoice calculator", "url": "https://github.com/procol/erp/pull/452" },
  "filesChanged": ["invoiceCalculator.ts"],
  "tests": { "passed": 47, "total": 47 },
  "approved": false
}
```

SSE or a websocket can replace polling later — the widget's
`startInvestigation` already takes an `onProgress` callback, so only the
adapter changes.

### `POST /tickets/:id/approve`
Manager approval, from the internal console rather than the widget.

```json
// request:  { "approver": "anshul.sharma@procol.in", "note": "ship it" }
// response: { "approved": true, "approver": "anshul.sharma@procol.in" }
```
After this, the ticket's `resolution.approved` becomes `true` and its status
becomes `resolved`.

### `GET /agents`
The A2A registry. Brain routes by capability: *"who can `create_pr`?"*

```json
[
  {
    "id": "dev-agent",
    "name": "Development Agent",
    "role": "Code Investigation + PR",
    "capabilities": ["bug_analysis", "code_fix", "create_pr"],
    "protocol": "A2A",
    "status": "connected",
    "tools": [{ "server": "github", "capabilities": ["read_file", "create_branch", "create_pr"] }]
  }
]
```

### `POST /a2a/tasks`
The uniform envelope every agent accepts. Brain never calls an agent's own API.

```json
// request
{
  "taskId": "TASK-123",
  "from": "procol-brain",
  "to": "dev-agent",
  "type": "INVESTIGATE_BUG",
  "context": { "ticketId": "PRO-1245", "customer": "ABC Corp", "issue": "GST calculation incorrect" }
}

// response
{
  "taskId": "TASK-123",
  "status": "completed",
  "result": {
    "rootCause": "Tenant context was not passed to the GST calculator",
    "filesChanged": ["invoiceCalculator.ts"],
    "pr": { "number": 452, "status": "created" }
  }
}
```

`type`: `GET_PRODUCT_CONTEXT` (Clara) | `INVESTIGATE_BUG` (Dev) | `RUN_TESTS`
(QA) | `REQUEST_APPROVAL` (Manager). `status`: `pending` | `running` |
`completed` | `failed`. Per-agent result shapes are typed in
[`src/types/a2a.ts`](../src/types/a2a.ts) as `ClaraResult`, `DevAgentResult`,
`QaAgentResult` and `ApprovalResult`.

### `GET /tasks/:id`
One task envelope plus its response — for the console's task inspector.

### `POST /messages`
Free-form question, no ticket created.

```json
// request:  { identity, context, "message": "How do I export a GRN report?" }
// response: { "message": "..." }
```

## Notes for the backend

- **A2A is agent↔agent, MCP is agent→tool.** Keep them distinct in the
  activity feed (`via`), because that distinction is the architecture pitch.
- Brain should pick agents by **capability**, not by hardcoded name — that is
  what makes it a registry rather than a switch statement.
- The widget tolerates missing optional fields; it will not crash on a
  half-built response. Steps and activity are the only things it truly needs.
- CORS must allow the host application's origin, since the widget runs inside
  customer apps.
