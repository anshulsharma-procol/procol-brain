# @procol/brain-chat

An embeddable AI support assistant for React applications. It ships as a
floating **Help & Support** launcher plus a compact chat panel — the host
application stays visible and interactive behind it.

Internally it is **Procol Brain**; externally it can be white-labelled as
*"Acme Support AI"* with a logo and a theme.

```tsx
import { ProcolBrain } from '@procol/brain-chat'

function App() {
  return (
    <>
      <ExistingApplication />
      <ProcolBrain companyId="abc-corp" userId="user-123" />
    </>
  )
}
```

## What it does

```
Customer reports issue
        -> Brain searches previously resolved issues
        -> similar issue found?
             yes -> show solution -> "Did this help?" -> resolve ticket
             no  -> create ticket -> agent investigation (Clara, Dev, QA, Manager)
                                  -> resolution ready for approval
```

## Architecture

```
UI components (components/ProcolBrain/*)
        |
React hook (hooks/useProcolBrain.ts)
        |
State machine (hooks/brainMachine.ts)   <- pure, no React
        |
BrainApi interface (services/brainApi.ts)
        |
MockBrainApi  |  createBrainClient (HTTP)  |  your own adapter
```

No business logic lives in components, and no API call is hardcoded in them.
The SDK knows nothing about A2A, MCP or agent orchestration — those belong to
the Brain backend.

### Conversation state

One `WorkflowState` drives the whole widget (no `isLoading` / `isSearching` /
`hasSolution` boolean soup):

```
INITIAL -> USER_MESSAGE -> SEARCHING_SIMILAR_ISSUES -> SIMILAR_ISSUE_FOUND
        -> WAITING_FOR_CONFIRMATION -> RESOLVED
                                    \-> INVESTIGATING -> AGENTS_WORKING
                                       -> RESOLUTION_READY -> RESOLVED
```

## Install

```bash
npm install @procol/brain-chat
```

React 18 or 19 is a peer dependency. Styles are bundled and imported by the
package itself; bundlers that do not process CSS imports can instead load
`@procol/brain-chat/styles.css`.

## Props

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `companyId` | `string` | — | Required tenant id |
| `userId` | `string` | — | End user reporting the issue |
| `apiBaseUrl` | `string` | — | Real Brain API. Omitted → bundled mock |
| `api` | `BrainApi` | — | Custom adapter; wins over `apiBaseUrl` |
| `theme` | `ProcolBrainTheme` | Procol theme | Merged over the defaults |
| `position` | `'bottom-right' \| 'bottom-left'` | `'bottom-right'` | |
| `defaultOpen` | `boolean` | `false` | |
| `display` | `'floating' \| 'inline'` | `'floating'` | `inline` docks the panel in its container |
| `initialMessage` | `string` | — | Reported automatically on open |
| `assistantName` | `string` | `'Procol Brain'` | Header + greeting |
| `logo` | `string` | — | Image URL for the header mark |
| `launcherIcon` | `ReactNode` | chat icon | |
| `launcherLabel` | `string` | `'Help & Support'` | |
| `greeting` | `string` | generated | First assistant message |
| `footer` | `string \| false` | `Powered by <assistantName>` | |
| `context` | `BrainContext` | — | Where the widget was opened from |
| `onTicketCreated` | `(ticket) => void` | — | |
| `onTicketResolved` | `(ticket) => void` | — | |
| `onResolutionReady` | `(resolution) => void` | — | |
| `onOpenChange` | `(open) => void` | — | |
| `className` | `string` | — | Host-side positioning tweaks |

## Host context

Tell Brain where the user was when they asked for help. The widget displays it
and forwards it with every API call, so a ticket lands with full context.

```tsx
<ProcolBrain
  companyId="abc-corp"
  userId="user-123"
  context={{ currentPage: 'grn', currentModule: 'GRN', recordId: 'GRN/2627/5' }}
/>
```

`BrainContext` is an open record — no Procol-specific page is hardcoded in the
widget.

## Branding and theming

```tsx
<ProcolBrain
  companyId="acme"
  assistantName="Acme Support AI"
  logo="/acme-logo.svg"
  launcherLabel="Need help?"
  footer={false}
  theme={{
    primaryColor: '#0f766e',
    backgroundColor: '#ffffff',
    textColor: '#0f172a',
    borderColor: '#e2e8f0',
    borderRadius: 10,
    fontFamily: 'Söhne, system-ui, sans-serif',
  }}
/>
```

Every theme token becomes a CSS custom property (`--pb-primary`, `--pb-radius`,
…) on the widget root, so overrides apply without rebuilding the package.
`defaultTheme` is exported if you want to extend rather than replace it.

## Replacing the mock with a real API

`MockBrainApi` runs the full demo with no backend. To go live, point the widget
at a real gateway:

```tsx
<ProcolBrain companyId="abc-corp" apiBaseUrl="https://brain-api.company.com" />
```

`createBrainClient` expects:

| Method | Endpoint |
| --- | --- |
| `searchSimilarIssues` | `POST /issues/search` |
| `createTicket` | `POST /tickets` |
| `startInvestigation` | `POST /tickets/:id/investigate` then polls `GET /tickets/:id/progress` |
| `getTicketStatus` | `GET /tickets/:id` |
| `sendMessage` | `POST /messages` |

If your backend differs, implement `BrainApi` yourself — it is five methods —
and pass it in. Nothing in the UI changes:

```tsx
import { ProcolBrain, createBrainClient } from '@procol/brain-chat'
import type { BrainApi } from '@procol/brain-chat'

const brain: BrainApi = {
  searchSimilarIssues: (req) => myGateway.search(req),
  createTicket: (req) => myGateway.tickets.create(req),
  startInvestigation: (req, opts) => myGateway.investigate(req, opts),
  getTicketStatus: (req) => myGateway.tickets.status(req),
  sendMessage: (req) => myGateway.chat(req),
}

<ProcolBrain companyId="abc-corp" api={brain} />
```

Streaming progress: `startInvestigation` receives an `onProgress` callback and
an `AbortSignal`, so an SSE or websocket transport drops in without touching
the components.

## Docked / inline mode

`display="inline"` drops the launcher and renders the panel inside its own
container — for a dedicated support page, a side drawer, or a design gallery.
Size it from the parent:

```tsx
<div style={{ width: 400, height: 560 }}>
  <ProcolBrain display="inline" companyId="abc-corp" />
</div>
```

Pair it with `initialMessage` to open Brain with a pre-filled report, e.g. from
an error boundary:

```tsx
<ProcolBrain companyId="abc-corp" defaultOpen initialMessage={`Error on ${page}: ${error.message}`} />
```

## Headless use

```tsx
const { messages, suggestedActions, busy, sendMessage, runAction } =
  useProcolBrain({ api, identity: { companyId }, greeting: 'Hi!' })
```

Same conversation engine, your own UI.

## Style isolation

- Every class is a CSS Module compiled to `pb-<name>-<hash>`.
- No global selectors: nothing outside the widget root is ever selected.
- A zero-specificity `:where()` baseline plus explicit class-level rules on all
  controls means host rules like `button { text-transform: uppercase }` cannot
  deform the widget, and the widget cannot leak into the host.
- Verified in the demo, whose stylesheet deliberately contains hostile global
  rules.

## Accessibility

Panel is a labelled `role="dialog"`; the transcript is a polite `role="log"`
live region; Escape minimizes; focus moves to the composer on open and back to
the launcher on close; Enter sends, Shift+Enter adds a newline; all icon
buttons are labelled and every control has a visible focus ring.

## Development

```bash
npm install
npm run dev        # demo host at http://localhost:5180
npm run typecheck
npm run lint
npm run build      # dist/index.js, dist/index.cjs, dist/index.d.ts, dist/index.css
```

The demo has two tabs:

- **Embedded in host app** — a fake Procol Console with the floating widget,
  plus live *Branding* and *Position* switches to demonstrate white-labelling.
- **UI states** — a gallery of six inline panels showing every screen at once
  (initial, searching, similar issue found, agents investigating, resolution
  ready, white-labelled). Each is a real widget backed by a scripted mock API,
  so the cards are interactive.

`examples/procol-console` is development only — it is never part of the
published package.

## Repository layout

```
src/
  components/ProcolBrain/   ProcolBrain, BrainLauncher, BrainHeader, ChatWindow,
                            ChatMessage, ChatInput, SuggestedActions,
                            SimilarIssueCard, InvestigationProgress, ResolutionCard
  hooks/                    useProcolBrain, brainMachine (pure state machine)
  services/                 brainApi (interface + HTTP client), mockBrainApi
  types/                    brain, messages, config
  theme/                    defaultTheme, themeVariables
  index.ts                  the entire public API
examples/
  procol-console/           development demo host (console + UI gallery)
  basic-react/              minimal integration snippet
```

Only what `src/index.ts` exports is public.
