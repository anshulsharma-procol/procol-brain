# @procol/brain-chat

Embeddable Procol Brain support chat widget. Ships as an ES module with React as
a peer dependency and zero runtime dependencies of its own — it drops into any
React app without imposing Tailwind or a build config on the host.

## Building

The package is built from the `frontend` workspace (which owns the toolchain):

```bash
cd frontend
npm run build:sdk
```

Output lands in `src/brain-chat/dist/` (gitignored):

| File                  | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `index.js`            | ES module bundle, React left external     |
| `styles.css`          | Single stylesheet, all classes `pb-`-prefixed |
| `types/index.d.ts`    | Public type declarations                  |

Rebuild after any change to the widget source — consumers read `dist/`, not the TSX.

## Consuming from another repo

Install by path (npm symlinks it, so a rebuild here is picked up immediately):

```bash
npm install file:../procol-brain/frontend/src/brain-chat
```

Or with `npm link`:

```bash
cd frontend/src/brain-chat && npm link
cd ../../../../my-other-repo && npm link @procol/brain-chat
```

Then:

```tsx
import { ProcolBrain } from '@procol/brain-chat'
import '@procol/brain-chat/styles.css'

export function App() {
  return (
    <>
      <YourApp />
      <ProcolBrain
        companyId="acme-corp"
        userId="user-123"
        apiBaseUrl="https://brain.example.com"
        context={{ currentPage: 'orders', currentModule: 'Procurement' }}
        onTicketCreated={(ticket) => console.info(ticket.reference)}
      />
    </>
  )
}
```

The stylesheet import is required — the widget renders unstyled without it.
TypeScript consumers who import the CSS from a `.ts`/`.tsx` file need
`"allowArbitraryExtensions": true` in their tsconfig, or they can load
`styles.css` from their bundler/HTML instead.

Omit `apiBaseUrl` and the widget runs the scripted A2A demo orchestrator, so it
is fully demoable with no backend.

## Public API

`index.ts` is the contract; anything not exported there is internal and can
change without notice. Beyond `<ProcolBrain />` it exposes `useProcolBrain` for
headless use, the `BrainApi` service interface and its REST / A2A / mock
implementations, `defaultTheme`, and the A2A task types.
