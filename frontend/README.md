# Procol Brain — console

The internal control tower: the board, the live agent transcript, the approval
gate, the agent registry, institutional memory, and the knowledge base.

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build
npm run lint
npm run build:sdk    # rebuild the embeddable chat widget in src/brain-chat/dist
```

## Two products in here

| Folder | What it is |
| --- | --- |
| `src/pages`, `src/components`, `src/platform` | the console — internal, one screen per job |
| `src/brain-chat` | the embeddable customer chat SDK, published as `@procol/brain-chat` |

They are deliberately separate and share no state. The console mounts the
widget so the customer's side of the same run is visible while demoing.

## Running on dummy data (today)

No backend is required. The console is driven by scenario files under
`src/platform/scenarios/`, replayed through an in-memory implementation of the
`ConsoleApi` interface. Runs stream in over a timer exactly as they will stream
in over SSE, so the screens are exercised against moving state rather than a
pile of constants.

Two control towers ship with it:

- **Procol** — `PRO-1245` invoice GST defect (the full loop), `PRO-1238` vendor
  auction access (a configuration fix that never wakes engineering).
- **AcmeCloud** — `ACME-7821` tenant-wide 401s after a deployment. The same run
  shape as PRO-1245, with the company's own knowledge agent in place of Clara.

Switch between them in the sidebar, or deep-link with `?workspace=acmecloud`.

## Running on the real backend (one variable)

```bash
# frontend/.env.local
VITE_BRAIN_API_URL=https://brain.procol.in/api
VITE_BRAIN_API_TOKEN=...     # optional
```

That is the entire integration. `src/platform/api/index.ts` swaps the mock for
the HTTP adapter; both implement `ConsoleApi`, so no screen, hook or type
changes. The endpoints are documented in `docs/CONSOLE_API_CONTRACT.md`.

## Adding a company or a case

See `src/platform/README.md`. A new customer is one file in
`platform/workspaces/`; a new end-to-end case is one file in
`platform/scenarios/`. Neither touches a component.
