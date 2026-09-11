# The Brain console platform

This folder is the product. Everything above it (`components/`, `pages/`) is a
view onto it, and nothing above it knows the name of a company, an agent or a
ticket.

```
platform/
  types.ts        the domain model — no company appears in it
  workspaces/     one file per customer control tower
  scenarios/      one file per end-to-end case, written as data
  seed/           knowledge base and institutional memory
  api/            ConsoleApi + the mock and the HTTP implementation
  react/          provider, data hooks, role-based visuals
```

## The one rule that makes it resell

**The UI keys off an agent's `role`, never its `id`.**

Procol's knowledge agent is called Clara. AcmeCloud's is called the Company
Knowledge Agent. Both are `role: 'knowledge'`, so both get the same colour, the
same glyph, the same position in the transcript, and the same routing — without
a single conditional in a component. That is the whole reason one build serves
both, and the reason a third company is a data file rather than a sprint.

## Switching from dummy data to the real backend

There is exactly one seam. Set an environment variable:

```bash
# frontend/.env.local
VITE_BRAIN_API_URL=https://brain.procol.in/api
VITE_BRAIN_API_TOKEN=...     # optional
```

`platform/api/index.ts` then constructs `createHttpConsoleApi(...)` instead of
`new MockConsoleApi()`. Both implement `ConsoleApi`, so no screen, hook or type
changes. The endpoints the HTTP adapter expects are listed at the top of
`api/httpApi.ts` and match `docs/BACKEND_API_CONTRACT.md`.

Nothing else in the application reads `import.meta.env`.

The mock does not disappear when the backend lands — it stays as the offline
demo (a full run completes with the wifi off) and as the test double.

## Adding a customer

1. Copy `workspaces/procol.ts`, change the company, its agents, its connectors
   and its approval policies.
2. Add it to `WORKSPACES` in `workspaces/index.ts`.

It now appears in the workspace switcher with its own board, registry,
knowledge base and memory. `?workspace=<id>` deep-links straight to it.

## Adding a case

A scenario is a run written as data: a ticket, an ordered list of events, the
artifacts they produce, and the memory entry the run leaves behind.

1. Copy `scenarios/procol-gst.ts` (a code fix) or
   `scenarios/procol-vendor-access.ts` (a configuration fix that skips
   engineering entirely).
2. Add it to `SCENARIOS` in `scenarios/index.ts`.

Authors write the story; `scenarios/compile.ts` derives sequence numbers, ids,
timestamps, stages and progress, so a data file never contains a `seq: 7`.

Useful fields:

| Field | Why it matters |
| --- | --- |
| `path` | `CODE_FIX` / `CONFIG_FIX` / `ANSWER_ONLY` / `PROCESS` |
| `stages` | Omit for all four. `['context','approve']` visibly skips two dots |
| `events[].logs` | 3–5 sub-lines per agent is what makes a run feel like real work |
| `events[].payload` | Revealed by "show payload" — the raw A2A envelope |
| `events[].durationMs` | Real latency on screen reads as authentic; progress bars do not |
| `memory` | What the control tower keeps when the run is approved |
| `replayScale` | ms per scripted second when replaying live; `0` renders instantly |

## Institutional memory

Approving a resolution writes a `MemoryEntry`. New tickets are matched against
it before anyone is asked to look at them, and the match is shown on the ticket
page with its confidence and the reason it matched.

The mock matches on tag overlap; the backend will match on embeddings. Both
return a `0..1` confidence, so the UI does not change when that happens.

This is the part of the product that compounds: the first GST ticket costs
three hours across five people, and every one after it costs minutes — measured
on the `Memory` screen as hours saved, not claimed in a slide.
