# 5-minute demo script

Run `npm run dev` (http://localhost:5180) and stay on the **Embedded in host
app** tab. Everything below runs on `src/data/demoScenario.ts` — no backend.

| Time | You do | They see | You say |
| --- | --- | --- | --- |
| 0:00 | Show the Procol Console with the widget closed | An ordinary enterprise app | "A single support ticket sets off a chain of coordination: support, product, engineering, QA, a manager." |
| 0:30 | Click **Help & Support** | Panel opens, header shows the page it was opened from | "Brain lives inside the product the customer is already using, and it knows where they were." |
| 0:45 | Paste the GST line, press Enter | "Searching previous solutions…" → resolved ticket **#892** | "First it checks whether we have solved this before. Institutional memory, before any agent spends a cycle." |
| 1:10 | Click **No, investigate further** | Investigation pipeline appears | "This one is new. So Brain assembles a team." |
| 1:25 | Let it run | **Brain → Clara** "What should GST be for ABC Corp?" then **Clara → Brain** "Expected GST = 18%" | "Clara is the product intelligence Procol already has. Brain doesn't replace it — it delegates to it." |
| 2:00 | Point at the purple row | **Dev Agent → github** `read_file + create_branch`, tagged **MCP** | "Two different protocols on one timeline. Blue is agent-to-agent. Purple is an agent reaching a tool over MCP." |
| 2:30 | | **Dev Agent → Brain** "Root cause found… PR #452 created." | "It found the root cause and opened a pull request." |
| 3:00 | | **QA Agent → test-runner**, then "47 / 47 tests passed" | "QA validated the fix against the regression suite." |
| 3:30 | Scroll to the resolution card | Root cause, PR #452 + `invoiceCalculator.ts`, 47/47, **Waiting for manager approval** | "Nothing ships without a human. The customer sees the gate; the manager approves in our internal console." |
| 4:00 | Click **Great, mark as resolved** | ✓ Issue resolved, ticket #1245, activity logged | "Ticket closed, customer notified, everything logged." |
| 4:20 | Switch to the **UI states** tab | All six states at once | "Every state is one component with a swappable backend." |
| 4:40 | Switch **Branding** to *Acme Support AI* | The same widget, teal, renamed | "And it isn't Procol-only. Another company embeds it with their name and their theme." |

## The closing line

> "Today Clara answers questions. Brain turns one assistant into a workforce:
> Clara for knowledge, a Dev Agent for engineering, a QA Agent for validation —
> and Brain only needs to know what capabilities they expose, not how any of
> them work. That is the path from an AI assistant to an interoperable AI
> workforce."

## If a judge asks "is the A2A real, or just UI?"

```ts
import { A2ABrainApi } from '@procol/brain-chat'

const brain = new A2ABrainApi()
// ...after an investigation:
brain.getTasks(ticketId)
// [{ task: { taskId, from: 'procol-brain', to: 'clara',
//            type: 'GET_PRODUCT_CONTEXT', context: {...} },
//    response: { taskId, status: 'completed', result: { expected: '18%', ... } } }, ...]
```

Every hop in the feed is backed by a real task/response envelope typed in
[`src/types/a2a.ts`](../src/types/a2a.ts). The mock and the live backend
produce the same envelopes — see
[BACKEND_API_CONTRACT.md](./BACKEND_API_CONTRACT.md).

## Backup plan

If anything misbehaves live, the **UI states** tab renders every screen from
static data with no timers — you can narrate the whole flow from it.
