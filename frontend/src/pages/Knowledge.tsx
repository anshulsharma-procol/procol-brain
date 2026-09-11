import { BookOpen, FileText } from 'lucide-react'
import { useState } from 'react'
import AgentAvatar from '../components/AgentAvatar'
import Card from '../components/Card'
import PageShell from '../components/PageShell'
import StatusPill from '../components/StatusPill'
import TopBar from '../components/TopBar'
import { Link } from 'react-router-dom'
import { useKnowledge, useWorkspace } from '../platform/react'
import type { KnowledgeEntry } from '../platform/types'
import type { Tone } from '../types'

const TYPE_TONE: Record<KnowledgeEntry['type'], Tone> = {
  'Product Doc': 'info',
  'Customer Config': 'neutral',
  'Business Rule': 'warning',
  FAQ: 'neutral',
  Runbook: 'info',
  Incident: 'danger',
}

/**
 * What the knowledge agent reads. Procol's documents are served by Clara;
 * AcmeCloud's by their own agent — this screen renders either without knowing
 * which, because a document is a document.
 */
export default function Knowledge() {
  const { workspace } = useWorkspace()
  const { data: entries = [], loading } = useKnowledge()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = entries.find((entry) => entry.id === selectedId) ?? entries[0]
  const knowledgeAgent = workspace.agents.find((agent) => agent.role === 'knowledge')

  return (
    <PageShell tip="Keep the AI you already have — we make it useful to everyone else.">
      <TopBar />

      <div className="px-8 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Knowledge</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          The documents {knowledgeAgent?.name ?? 'the knowledge agent'} reads when Brain asks it a
          question. They stay where they are — only the answer to a specific, logged question
          crosses the boundary.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 py-6 lg:grid-cols-[22rem_1fr]">
        <Card className="p-2">
          {loading && entries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">Loading documents…</p>
          ) : entries.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-500">
              No documents indexed for this control tower yet.
            </p>
          ) : (
            <ul>
              {entries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(entry.id)}
                    className={`w-full rounded-lg px-3 py-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                      selected?.id === entry.id ? 'bg-violet-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-start gap-2.5">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900">
                          {entry.title}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          {entry.description}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {selected && (
          <Card className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                  <BookOpen className="h-4 w-4 text-violet-500" />
                  {selected.title}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{selected.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusPill label={selected.type} tone={TYPE_TONE[selected.type]} />
                <span className="font-mono text-[11px] text-gray-400">{selected.version}</span>
              </div>
            </div>

            <div className="mt-5 space-y-5">
              {selected.content.map((section) => (
                <div key={section.heading}>
                  <h3 className="text-sm font-semibold text-gray-900">{section.heading}</h3>
                  <ul className="mt-2 space-y-1.5">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2 text-sm text-gray-600">
                        <span className="text-gray-300">•</span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Read by</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {selected.usedBy.map((agentId) => (
                    <span key={agentId} className="flex items-center gap-1.5">
                      <AgentAvatar agentId={agentId} size="sm" />
                      <span className="font-mono text-[11px] text-gray-500">{agentId}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">Cited on</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.relatedTicketRefs.length === 0 ? (
                    <span className="text-sm text-gray-400">No tickets yet</span>
                  ) : (
                    selected.relatedTicketRefs.map((reference) => (
                      <Link
                        key={reference}
                        to={`/tickets/${reference}`}
                        className="rounded bg-gray-100 px-2 py-1 font-mono text-[11px] text-blue-600 hover:underline"
                      >
                        {reference}
                      </Link>
                    ))
                  )}
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-400">Updated {selected.updatedAt}</p>
          </Card>
        )}
      </div>
    </PageShell>
  )
}
