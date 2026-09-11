import { useMemo } from 'react'
import { ProcolBrain } from '../../src'
import type { ProcolBrainTheme } from '../../src'
import { createShowcaseApi, type ShowcaseStage } from './showcaseApi'

/**
 * A gallery of the widget's states, rendered inline so every screen is visible
 * at once. Development only.
 */

const DEMO_MESSAGE =
  'My ABC Corp invoice is showing incorrect GST. It should be 18%, but the system is calculating 12%.'

const ACME_THEME: ProcolBrainTheme = {
  primaryColor: '#0f766e',
  aiColor: '#0f766e',
  borderRadius: 10,
}

interface Panel {
  stage: ShowcaseStage
  title: string
  caption: string
  seed?: boolean
  assistantName?: string
  theme?: ProcolBrainTheme
  launcherLabel?: string
}

const PANELS: Panel[] = [
  {
    stage: 'greeting',
    title: '1. Initial state',
    caption: 'Greeting plus the three entry points. WorkflowState: INITIAL.',
  },
  {
    stage: 'searching',
    title: '2. Searching previous solutions',
    caption: 'Live status line while the knowledge base is queried. SEARCHING_SIMILAR_ISSUES.',
    seed: true,
  },
  {
    stage: 'similar',
    title: '3. Similar issue found',
    caption:
      'Resolved ticket #892 with the previous fix, then the confirmation prompt. Click Yes or No to continue the flow. WAITING_FOR_CONFIRMATION.',
    seed: true,
  },
  {
    stage: 'investigating',
    title: '4. Agents collaborating (A2A + MCP)',
    caption:
      'Brain delegates to Clara and the Dev Agent over A2A; the Dev Agent reaches GitHub over MCP. Scroll the card to see the whole exchange. AGENTS_WORKING.',
    seed: true,
  },
  {
    stage: 'resolution',
    title: '5. Resolution ready',
    caption:
      'Root cause, PR #452 with the files it touched, QA 47/47, and the manager approval gate. RESOLUTION_READY.',
    seed: true,
  },
  {
    stage: 'greeting',
    title: '6. White-labelled',
    caption:
      'Same component: assistantName="Acme Support AI" with a teal theme and a 10px radius.',
    assistantName: 'Acme Support AI',
    theme: ACME_THEME,
  },
]

export function ShowcasePage() {
  return (
    <div className="showcase">
      <header className="showcase__intro">
        <h1 className="console__title">Procol Brain - UI states</h1>
        <p className="console__breadcrumb">
          Each card is a real <code>&lt;ProcolBrain display="inline" /&gt;</code> instance backed by
          a scripted mock API. They are interactive - type in them, click the buttons.
        </p>
      </header>

      <div className="showcase__grid">
        {PANELS.map((panel) => (
          <ShowcaseCard key={panel.title} panel={panel} />
        ))}
      </div>
    </div>
  )
}

function ShowcaseCard({ panel }: { panel: Panel }) {
  const api = useMemo(() => createShowcaseApi(panel.stage), [panel.stage])

  return (
    <figure className="showcase__card">
      <figcaption className="showcase__caption">
        <strong>{panel.title}</strong>
        <span>{panel.caption}</span>
      </figcaption>
      <div className="showcase__frame">
        <ProcolBrain
          display="inline"
          companyId="procol"
          userId="user-123"
          api={api}
          assistantName={panel.assistantName}
          theme={panel.theme}
          initialMessage={panel.seed ? DEMO_MESSAGE : undefined}
          context={{ currentPage: 'invoices', currentModule: 'Invoices', recordId: 'INV/2026/1183' }}
        />
      </div>
    </figure>
  )
}
