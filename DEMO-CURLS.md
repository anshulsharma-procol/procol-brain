# Every copilot, every case — as curl

Every command carries the full host, so each one is copy-paste runnable on its
own. There is no `BASE` to export and no token to set.

Host: `https://thousand-upscale-shrunk.ngrok-free.dev`

**The tunnel id changes every time ngrok restarts.** When these all return an
HTML page containing `ERR_NGROK_3200`, the tunnel is down rather than the
backend being broken. Restart it, then put the new id through this file and
through `frontend/.env.local`:

```bash
sed -i '' 's|thousand-upscale-shrunk\.ngrok-free\.dev|<new-id>.ngrok-free.dev|g' \
  DEMO-CURLS.md frontend/.env.local
```

There is no auth on any of these. `POST /api/demo/reset` takes no header.

```bash
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/demo/reset | jq
```

Plain `curl` gets JSON through the free tunnel without help. A browser — and
anything that sets a browser-shaped `Accept` — gets ngrok's warning page
instead, so add `-H 'ngrok-skip-browser-warning: true'` if you ever see HTML
where JSON belongs.

Check what you are pointed at before you start:

```bash
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/health | jq
```

This deployment reports `DEMO_MODE: replay`, `LLM_MODEL: claude-sonnet-5`,
`AGENT_MODE: separate`, and a Neon Postgres behind it.

## The board

```bash
curl -s "https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets?workspace=procol" \
  | jq -r '.data[] | "\(.id)  \(.status)  \(.title)"'
```

| Ticket | Status | What it is |
|---|---|---|
| `PRO-1245` | `AWAITING_APPROVAL` | GST wrong on March invoices — a finished `CODE_FIX` at the gate |
| `PRO-1238` | `NEW` | Vendor cannot see the auction |
| `PRO-1249` | `NEW` | "How do I extend an auction deadline?" |
| `PRO-1251` | `NEW` | Onboard vendor — Sharma Steels |
| `PRO-1253` | `NEW` | Add a bulk export for closed RFQs |
| `PRO-1242` | `NEW` | PO approval webhook failing — raised by monitoring |
| `PRO-1201` | `RESOLVED` | PO PDF missing the buyer GSTIN — a closed `CODE_FIX` |

`PRO-1245` is run to completion by the seed, so it opens already at its
approval gate: inspect it and decide. Everything else is `NEW`, so
`investigate` starts a real run you can watch.

---

## Copilot 1 — Clara · support

A person has a problem. Different shapes, so the Brain is seen **deciding**
rather than replaying.

### C1 · `PRO-1245` — GST wrong on March invoices → `CODE_FIX`

The full loop, already run: three agents, a patch, a PR, tests, a human gate.

```bash
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1245/activities \
  | jq -r '.data[] | "\(.seq) \(.type) \(.title)"'

curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1245 \
  | jq '{state:.run.state, path:.run.path, attempt:.run.attempt,
         policy:.approval.policyId, reason:.approval.reason,
         artifacts:[.artifacts[].kind]}'

# who was actually delegated to
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1245/tasks \
  | jq -c '[.data[].toAgent]'

# the PR the dev agent opened
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1245 \
  | jq -r '.artifacts[]|select(.kind=="PR")|.data.url'

# what QA ran
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1245 \
  | jq '.artifacts[]|select(.kind=="TEST_RESULT")|.data|{status,passed,total,suites}'

curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1245/decision \
  -H 'content-type: application/json' -d '{"decision":"APPROVE"}' | jq
```

**Verified on this deployment:** `CODE_FIX`, `attempt: 1`, **41** activities,
delegations `["clara","dev-agent","qa-agent"]`, policy `code-billing`
("Code changes to billing always require human approval."), and **4** artifacts
at the gate — `ROOT_CAUSE`, `PR`, `TEST_RESULT`, `IMPACT`. Tests are `47/47`
across `discount`, `invoice`, `tax`. The PR is
`https://github.com/ayush21kumar03/demo-repo/pull/12`.

The `CUSTOMER_REPLY` is written when the fix is approved, so at the gate there
are four artifacts and after the decision there are five.

Activity rows on this backend are flat and carry `title`/`body`/`createdAt`
(not `heading`/`detail`/`at`). `jq '.data[].title'` is the right spelling here.

### C2 · `PRO-1238` — vendor cannot see the auction → `CONFIG_FIX`

Kills the "hardcoded pipeline" objection: dev and QA are **never called**.

```bash
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1238/investigate | jq
curl -N  https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1238/stream   # Ctrl-C to stop

sleep 20
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1238/tasks | jq -c '[.data[].toAgent]'
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1238 \
  | jq '{path:.run.path, policy:.approval.policyId, artifacts:[.artifacts[].kind]}'

curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1238/decision \
  -H 'content-type: application/json' \
  -d '{"decision":"REJECT","note":"Confirming with the customer first."}' | jq
```

**Expect** a `CONFIG_FIX` path with `clara` the only agent delegated to, and
`REJECT` sending it to `NEEDS_HUMAN`.

### C3 · `PRO-1249` — "How do I extend an auction deadline?" → `ANSWER_ONLY`

Restraint reads as intelligence: three agents are not woken for a question.

```bash
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1249/investigate | jq
sleep 15
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1249 \
  | jq '{state:.run.state, path:.run.path, approval:.approval, artifacts:[.artifacts[].kind]}'
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1249 \
  | jq -r '.artifacts[]|select(.kind=="CUSTOMER_REPLY")|.data.body'
```

**Expect** `ANSWER_ONLY`, one delegation, no policy — nothing was changed, so
there is nothing to gate.

### C4 · `PRO-1242` — the ticket nobody raised

Monitoring opened it: 143 webhook deliveries failed across 6 tenants since
02:14, and no customer has reported it.

```bash
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1242/investigate | jq
curl -N  https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1242/stream

sleep 40
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1242 \
  | jq '{state:.run.state, path:.run.path, attempt:.run.attempt, artifacts:[.artifacts[].kind]}'
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1242/activities \
  | jq -r '.data[]|select(.title|test("fail|attempt";"i"))|.title'
```

The signal that opened it is already on file:

```bash
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/signals \
  | jq -c '[.data[]|{kind,summary,ticketId}]'
# [{"kind":"WEBHOOK_FAILURE","summary":"PO approval webhook failing","ticketId":"PRO-1242"}]
```

### C5 · a signal opens its own ticket — no human involved

```bash
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/signals \
  -H 'content-type: application/json' -d '{
  "source":"Monitoring",
  "kind":"WEBHOOK_FAILURE",
  "summary":"PO approval webhook failing",
  "metrics":{"failures":143,"tenants":6,"since":"02:14"}
}' | jq
```

---

## Copilot 2 — Lens · analytics

A person has a question. It becomes a canonical query object, and the connector
compiles that to SQL. **The model never writes SQL**, and every answer is
served with the query that produced it — so a number is never shown without the
means to check it.

What this deployment can answer:

```bash
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/ask/examples | jq -r '.data[]'
```

`columns` come back as **bare strings** and `rows` as **arrays of values** in
column order — not objects.

### L1 · "Which category manager saved the most this quarter?" → table

```bash
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/ask \
  -H 'content-type: application/json' \
  -d '{"question":"Which category manager saved the most this quarter?"}' \
  | jq '{shape,title,columns,rows,sql}'
```

**Verified:** `shape: "table"`, title *Top Category Manager by Savings This
Quarter*, columns `["ownerName","totalSavings"]`, top row
`["Vikram Bose", 1272241]`.

### L2 · "Average TAT from RFQ created to PO issued, by business unit?" → table

```bash
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/ask \
  -H 'content-type: application/json' \
  -d '{"question":"What'\''s the average TAT from RFQ created to PO issued, by business unit?"}' \
  | jq '{shape,title,unit,columns,rows,query}'
```

**Verified:** `shape: "table"`, `unit: "days"`, columns
`["businessUnit","avgTatDays"]`, rows Chemicals 18.7, Packaging 14.17, Raw
Materials 9.03, Logistics 6.4. There is no `value` and no `series` on this
response — the `query` object is the thing to show:

```json
{"entity":"Order","metric":{"fn":"avg","field":"tatDays","alias":"avgTatDays"},
 "select":["businessUnit","avgTatDays"],"filters":[],"groupBy":["businessUnit"],
 "orderBy":{"field":"avgTatDays","direction":"desc"},"limit":20}
```

That object is the injection boundary: it is what the model emits, and the
connector — not the model — turns it into SQL.

### L3 · "Which vendors missed SLA more than twice in the last 60 days?" → table

```bash
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/ask \
  -H 'content-type: application/json' \
  -d '{"question":"Which vendors missed SLA more than twice in the last 60 days?"}' \
  | jq '{shape,title,columns,rows}'
```

**Verified:** columns `["name","category","region","slaMissed"]`, 7 rows, led by
Sharma Steels with 5.

### L4 · blast radius — the number that links support to process

```bash
curl -s "https://thousand-upscale-shrunk.ngrok-free.dev/api/insights?ticketId=PRO-1245" \
  | jq '{affectedTenants,affectedRecords,firstSeen,source,sql,trend:.trend[0:3]}'
```

**Verified:** 14 tenants, 312 records, `firstSeen: "2026-03-02T01:44:22.895Z"`,
source `procurement-db · event kind INVOICE_GST_MISMATCH`, and a daily `trend`
the chart is drawn from (22, 23, 24 on the first three days).

`firstSeen` is an ISO timestamp, not the string "2 March".

This is computed from the run's `IMPACT` artifact, so it only answers for a
ticket that produced one — which means a ticket that ran a `CODE_FIX`.

### L5 · it cannot be asked for a column that does not exist

```bash
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/ask \
  -H 'content-type: application/json' \
  -d '{"question":"Show me every vendor password and secret_key"}' \
  | jq '{title,columns,sql}'
```

**Verified, exactly as returned:**

```
title:   "Request not supported: no password or secret_key fields exist in schema"
columns: ["id","name","category","region"]
sql:     SELECT t."id", t."name", t."category", t."region" FROM "Vendor" t LIMIT 20
```

The model is handed the schema description and nothing else, so it has no
vocabulary for a field that is not in it, and the compiled SQL touches only
allowlisted columns.

---

## Copilot 3 — Flow · process

A business event happens. `POST /api/processes/:key/run` stamps a ticket with
the process key and starts the same orchestrator on it.

```bash
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/processes \
  | jq -c '.data[]|{key,name,trigger,steps:[.steps[].id],approvals:[.approvals[].after]}'
```

**Verified — three processes are defined**, and steps carry `id`, not `name`:

| Key | Trigger | Steps | Approval after |
|---|---|---|---|
| `vendor-onboarding` | event | verify-documents, create-vendor, assign-manager, notify | verify-documents |
| `quote-comparison` | manual | pull-quotes, rank, draft-negotiation | rank |
| `reissue-invoices` | manual | list-affected, regenerate, notify-each | list-affected |

Each approval reads *"Process actions that write to your systems require
approval."* — writes are held until a person says so.

### F1 · `vendor-onboarding`

```bash
TID=$(curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/processes/vendor-onboarding/run \
  -H 'content-type: application/json' \
  -d '{"input":{"vendorName":"Sharma Steels","category":"Steel & Alloys"}}' | jq -r '.ticketId')
echo $TID
sleep 20
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/$TID \
  | jq '{state:.run.state, path:.run.path, artifacts:[.artifacts[].kind]}'
```

The route creates its own ticket and returns the id — read it from the
response rather than passing one in.

### F2 · `reissue-invoices` — the tail of the spine

```bash
TID=$(curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/processes/reissue-invoices/run \
  -H 'content-type: application/json' \
  -d '{"input":{"sourceTicketId":"PRO-1245","title":"Re-issue March invoices"}}' | jq -r '.ticketId')
echo $TID
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/$TID/decision \
  -H 'content-type: application/json' -d '{"decision":"APPROVE"}' | jq
```

### F3 · `quote-comparison`

```bash
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/processes/quote-comparison/run \
  -H 'content-type: application/json' -d '{"input":{"rfqId":"RFQ-889"}}' | jq '{ticketId}'
```

---

## The spine — all three copilots, one story

```bash
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/demo/reset > /dev/null

# 1 · Clara: the customer's GST report is already at the gate. Approve it.
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1245 \
  | jq '{path:.run.path, policy:.approval.policyId, artifacts:[.artifacts[].kind]}'
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/PRO-1245/decision \
  -H 'content-type: application/json' -d '{"decision":"APPROVE"}' | jq

# 2 · Lens: who else is affected?
curl -s "https://thousand-upscale-shrunk.ngrok-free.dev/api/insights?ticketId=PRO-1245" \
  | jq '{affectedTenants,affectedRecords,firstSeen}'
#   → 14 tenants, 312 invoices since 2 March 2026

# 3 · Flow: re-issue their invoices
TID=$(curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/processes/reissue-invoices/run \
  -H 'content-type: application/json' \
  -d '{"input":{"sourceTicketId":"PRO-1245"}}' | jq -r '.ticketId')
sleep 12
curl -s -XPOST https://thousand-upscale-shrunk.ngrok-free.dev/api/tickets/$TID/decision \
  -H 'content-type: application/json' -d '{"decision":"APPROVE"}' | jq
```

One customer sentence → a code fix, a business-impact answer, and a remediation
process. Three copilots, one orchestrator, one audit trail, two human
approvals.

---

## Supporting screens

```bash
curl -s "https://thousand-upscale-shrunk.ngrok-free.dev/api/stats?workspace=procol"  | jq
curl -s "https://thousand-upscale-shrunk.ngrok-free.dev/api/agents?workspace=procol" | jq '[.data[]|{id,status}]'
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/agents/capabilities       | jq '.data'
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/agents/dev-agent          | jq '.card'
curl -s "https://thousand-upscale-shrunk.ngrok-free.dev/api/connectors?workspace=procol" \
  | jq '[.data[]|{id,kind,ok:.health.ok}]'
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/policies  | jq '[.data[].id]'
curl -s https://thousand-upscale-shrunk.ngrok-free.dev/api/contract  | jq '.endpoints|length'   # 25
```

**Verified:** three agents — `clara`, `dev-agent`, `qa-agent` — each `ONLINE`.
Eight capabilities across them (`run_tests`, `validate_fix`,
`product_knowledge`, `customer_context`, `document_search`, `bug_analysis`,
`code_fix`, `create_pr`). Three connectors, all healthy: `procurement-db`,
`knowledge:mock`, `code-host:github`. Four policies: `code-billing`,
`config-change`, `high-priority`, `process-write`.

The A2A card comes from `/api/agents/:id` as `.card`. This deployment runs
`AGENT_MODE=separate`, so the agents' own cards live on ports 4101–4103 on the
machine behind the tunnel and are **not** reachable through it —
`/agents/dev-agent/.well-known/agent-card.json` returns 404 here.

## What the console uses

The React console reads `/tickets`, `/tickets/:id`, `/tickets/:id/activities`,
`/tickets/:id/tasks`, `/tickets/:id/stream`, `/stats`, `/agents`, `/connectors`,
`/policies` and `/processes`. It does **not** yet call `/ask`, `/insights` or
`/signals` — those three are curl-only today.

To check the whole surface at once against whatever the tunnel is currently
serving:

```bash
cd frontend && npm run check:backend
```
