import { Bot, Plus, Search, Settings as SettingsIcon, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import TopBar from '../components/TopBar'
import AgentDetailPanel from './AgentDetailPanel'
import { formatAgentRelativeTime, loadAgentsFromStorage, saveAgentsToStorage } from './storage'
import type { AgentRecord } from './types'

export default function AgentBuilderList() {
  const navigate = useNavigate()
  const [agents, setAgents] = useState<AgentRecord[]>(() => loadAgentsFromStorage())
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filtered = agents.filter(
    (agent) =>
      query.trim() === '' ||
      agent.name.toLowerCase().includes(query.toLowerCase()) ||
      agent.description.toLowerCase().includes(query.toLowerCase()),
  )
  const selected = agents.find((agent) => agent.id === selectedId) ?? null

  function persist(next: AgentRecord[]) {
    setAgents(next)
    saveAgentsToStorage(next)
  }

  function handleDelete(agentId: string) {
    if (!window.confirm('Delete this agent? This cannot be undone.')) return
    persist(agents.filter((agent) => agent.id !== agentId))
    if (selectedId === agentId) setSelectedId(null)
  }

  function handleSaveDetail(agentId: string, patch: Pick<AgentRecord, 'name' | 'description'>) {
    persist(
      agents.map((agent) =>
        agent.id === agentId ? { ...agent, ...patch, updatedAt: new Date().toISOString() } : agent,
      ),
    )
    setSelectedId(null)
  }

  return (
    <PageShell tip="Agents chain together to get real work done.">
      <TopBar
        trailing={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/agent-builder/settings')}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <SettingsIcon className="h-4 w-4" />
              Settings
            </button>
            <button
              type="button"
              onClick={() => navigate('/agent-builder/new')}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create Agent
            </button>
          </div>
        }
      />

      <div className="px-8 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Agent Builder</h1>
        <p className="mt-1 text-sm text-gray-500">Build, configure, and publish your own agents and workflows.</p>
      </div>

      <div className="flex items-center gap-2 px-8 pt-5">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agents"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-300 focus:outline-none"
          />
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filter
        </button>
      </div>

      <div className="px-8 py-6">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-gray-300 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
              <Bot className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900">No agents yet</p>
            <p className="max-w-xs text-sm text-gray-500">
              Create your first agent to start automating procurement work.
            </p>
            <button
              type="button"
              onClick={() => navigate('/agent-builder/new')}
              className="mt-1 flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Create Agent
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No agents match your search.</p>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {filtered.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => setSelectedId(agent.id)}
                className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm hover:border-gray-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      agent.status === 'Live' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {agent.status}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation()
                      handleDelete(agent.id)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.stopPropagation()
                        handleDelete(agent.id)
                      }
                    }}
                    aria-label="Delete agent"
                    className="rounded p-1 text-gray-300 opacity-0 hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </span>
                </div>

                <p className="mt-2 truncate text-sm font-semibold text-gray-900">{agent.name || 'Untitled agent'}</p>
                <p className="text-xs text-gray-400">
                  {agent.owner} · updated {formatAgentRelativeTime(agent.updatedAt)}
                </p>
                <p className="mt-2 line-clamp-2 flex-1 text-sm text-gray-600">
                  {agent.description || 'No description yet.'}
                </p>

                <p className="mt-3 text-xs text-gray-500">
                  {agent.agentCount} agents · {agent.sources.length} sources · {agent.workflowKind}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {formatAgentRelativeTime(agent.lastRunAt)} · {agent.runCount} runs
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <AgentDetailPanel
          agent={selected}
          onClose={() => setSelectedId(null)}
          onSave={(patch) => handleSaveDetail(selected.id, patch)}
          onDelete={() => handleDelete(selected.id)}
          onOpenBuilder={() => navigate(`/agent-builder/${selected.id}/edit`)}
        />
      )}
    </PageShell>
  )
}
