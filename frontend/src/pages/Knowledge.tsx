import { BookOpen, Copy, FileText, MoreHorizontal, Pencil, Plus, Search, X } from 'lucide-react'
import { useState } from 'react'
import AgentAvatar from '../components/AgentAvatar'
import Card from '../components/Card'
import PageShell from '../components/PageShell'
import StatusPill from '../components/StatusPill'
import TopBar from '../components/TopBar'
import { knowledgeEntries } from '../data/mockData'
import FileExplorer from '../knowledge-files/FileExplorer'
import type { KnowledgeEntry, Tone } from '../types'

const TABS = ['All', 'Product Docs', 'Customer Configs', 'Business Rules', 'FAQs', 'Files'] as const
type Tab = (typeof TABS)[number]

const TAB_TO_TYPE: Record<Tab, KnowledgeEntry['type'] | null> = {
  All: null,
  'Product Docs': 'Product Doc',
  'Customer Configs': 'Customer Config',
  'Business Rules': 'Business Rule',
  FAQs: 'FAQ',
  Files: null,
}

const TYPE_STYLE: Record<KnowledgeEntry['type'], { tone: Tone; iconBg: string; iconText: string }> = {
  'Product Doc': { tone: 'neutral', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
  'Customer Config': { tone: 'info', iconBg: 'bg-green-100', iconText: 'text-green-600' },
  'Business Rule': { tone: 'warning', iconBg: 'bg-amber-100', iconText: 'text-amber-600' },
  FAQ: { tone: 'neutral', iconBg: 'bg-violet-100', iconText: 'text-violet-600' },
}

const TICKET_STATUS_TONE: Record<string, Tone> = {
  Resolved: 'success',
  'In Progress': 'info',
}

export default function Knowledge() {
  const [showCallout, setShowCallout] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('All')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState('gst-configuration')
  const isFilesTab = activeTab === 'Files'

  const activeType = TAB_TO_TYPE[activeTab]
  const filteredEntries = knowledgeEntries.filter((entry) => {
    const matchesTab = activeType === null || entry.type === activeType
    const matchesQuery =
      query.trim() === '' ||
      entry.title.toLowerCase().includes(query.toLowerCase()) ||
      entry.description.toLowerCase().includes(query.toLowerCase())
    return matchesTab && matchesQuery
  })

  const selected = knowledgeEntries.find((entry) => entry.id === selectedId) ?? knowledgeEntries[0]

  return (
    <PageShell tip="Good knowledge in means good decisions out.">
      <TopBar
        trailing={
          isFilesTab ? undefined : (
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Knowledge
            </button>
          )
        }
      />

      <div className="px-8 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Knowledge</h1>
        <p className="mt-1 text-sm text-gray-500">
          Product information, configurations and documents used by AI agents.
        </p>
      </div>

      {showCallout && !isFilesTab && (
        <div className="mx-8 mt-5 flex items-start gap-3 rounded-xl bg-blue-50 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
            <BookOpen className="h-4.5 w-4.5 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-900">Why this matters?</p>
            <p className="mt-0.5 text-sm text-blue-800/80">
              Our AI agents (like Clara) use this knowledge to understand your product, customers, configurations
              and business rules. This helps them provide accurate context and make the right decisions.
            </p>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setShowCallout(false)}
            className="text-blue-400 hover:text-blue-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="px-8 pt-6">
        <div className="flex flex-wrap items-center gap-1 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 px-3 py-2.5 text-sm font-medium ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {isFilesTab ? (
        <div className="px-8 py-6">
          <FileExplorer />
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4 px-8 py-6 lg:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search knowledge..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            {filteredEntries.map((entry) => {
              const style = TYPE_STYLE[entry.type]
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedId(entry.id)}
                  className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                    entry.id === selectedId
                      ? 'border-blue-300 bg-blue-50/60'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${style.iconBg}`}>
                    <FileText className={`h-4.5 w-4.5 ${style.iconText}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{entry.title}</p>
                    <p className="text-sm text-gray-500">{entry.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <StatusPill label={entry.type} tone={style.tone} />
                    <span className="text-xs text-gray-400">Updated {entry.updatedAt}</span>
                  </div>
                </button>
              )
            })}
            {filteredEntries.length === 0 && (
              <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
                No knowledge entries match this filter.
              </p>
            )}
          </div>
        </div>

        <Card className="h-fit p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${TYPE_STYLE[selected.type].iconBg}`}
              >
                <FileText className={`h-5 w-5 ${TYPE_STYLE[selected.type].iconText}`} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.title}</h2>
                <p className="text-sm text-gray-500">{selected.description}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                aria-label="More actions"
                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-4 border-y border-gray-100 py-4 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-gray-400">Type</p>
              <div className="mt-1">
                <StatusPill label={selected.type} tone={TYPE_STYLE[selected.type].tone} />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400">Last Updated</p>
              <p className="mt-1.5 font-medium text-gray-900">{selected.updatedAt}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Used By</p>
              <div className="mt-1.5 flex -space-x-1.5">
                {selected.usedBy.map((agentId) => (
                  <AgentAvatar key={agentId} agentId={agentId} size="sm" />
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400">Version</p>
              <p className="mt-1.5 font-medium text-gray-900">{selected.version}</p>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Content</h3>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>
            <div className="mt-3 space-y-4 rounded-lg bg-gray-50 p-4">
              {selected.content.map((section) => (
                <div key={section.heading}>
                  <p className="text-sm font-semibold text-gray-900">{section.heading}</p>
                  <ul className="mt-1.5 space-y-1 text-sm text-gray-600">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2">
                        <span className="text-gray-400">•</span>
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-gray-900">Related Tickets</h3>
            {selected.relatedTickets.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">No related tickets yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100">
                {selected.relatedTickets.map((ticket) => (
                  <li key={ticket.number} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="font-semibold text-blue-600">{ticket.number}</span>
                      <span className="truncate text-gray-700">{ticket.title}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <StatusPill label={ticket.status} tone={TICKET_STATUS_TONE[ticket.status] ?? 'neutral'} />
                      <span className="text-gray-400">{ticket.date}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
      )}
    </PageShell>
  )
}
