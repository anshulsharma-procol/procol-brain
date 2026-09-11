import { CheckCircle, ChevronRight, GitPullRequest, Play, Plus, Settings, Share2 } from 'lucide-react'
import { useState } from 'react'
import AgentAvatar from '../components/AgentAvatar'
import Card from '../components/Card'
import PageShell from '../components/PageShell'
import StatusPill from '../components/StatusPill'
import TopBar from '../components/TopBar'
import { agents } from '../data/mockData'
// Substitution note: lucide-react has no "Github" brand icon, so the
// "GitHub via MCP" tool row uses GitPullRequest as the closest reasonable glyph.

export default function AgentRegistry() {
  const [selectedId, setSelectedId] = useState('dev')
  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[0]

  return (
    <PageShell tip="Every agent has a job. Together they get real work done.">
      <TopBar
        trailing={
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Add Agent
          </button>
        }
      />

      <div className="px-8 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Agent Registry</h1>
        <p className="mt-1 text-sm text-gray-500">Manage AI agents, their capabilities, tools and connections.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 py-6 lg:grid-cols-[380px_1fr]">
        <div className="flex flex-col gap-3">
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => setSelectedId(agent.id)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                agent.id === selectedId
                  ? 'border-blue-300 bg-blue-50/60'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <AgentAvatar agentId={agent.id} variant="light" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900">{agent.name}</p>
                  <StatusPill
                    label={agent.connected ? 'Connected' : 'Not Connected'}
                    tone={agent.connected ? 'success' : 'neutral'}
                    withDot
                  />
                </div>
                <p className="text-sm text-gray-500">{agent.role}</p>
                <p className="mt-1 text-sm text-gray-600">{agent.description}</p>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-400" />
            </button>
          ))}
        </div>

        <Card className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AgentAvatar agentId={selected.id} variant="light" size="lg" />
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selected.name}</h2>
                <p className="text-sm text-gray-500">{selected.role}</p>
                <p className="mt-1 max-w-lg text-sm text-gray-600">{selected.description}</p>
              </div>
            </div>
            <StatusPill
              label={selected.connected ? 'Connected' : 'Not Connected'}
              tone={selected.connected ? 'success' : 'neutral'}
              withDot
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-8 border-t border-gray-100 pt-6 sm:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Settings className="h-4 w-4 text-gray-500" />
                Capabilities
              </h3>
              <ul className="mt-3 space-y-2.5">
                {selected.capabilities.map((capability) => (
                  <li key={capability} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    {capability}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-6">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <Share2 className="h-4 w-4 text-gray-500" />
                  Protocol
                </h3>
                <span className="mt-2 inline-block rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  {selected.protocol.name}
                </span>
                <p className="mt-2 text-sm text-gray-600">{selected.protocol.description}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900">Tools</h3>
                <ul className="mt-2 space-y-2">
                  {selected.tools.map((tool) => (
                    <li key={tool.name} className="flex items-start gap-2 text-sm">
                      <GitPullRequest className="mt-0.5 h-4 w-4 shrink-0 text-gray-700" />
                      <div>
                        <p className="font-medium text-gray-900">{tool.name}</p>
                        <p className="text-gray-500">{tool.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-6">
            <h3 className="text-sm font-semibold text-gray-900">Sample Interaction</h3>
            <div className="mt-3 space-y-2 rounded-lg bg-gray-50 p-4 font-mono text-sm text-gray-700">
              {selected.sampleInteraction.map((line) => (
                <p key={`${line.from}-${line.text}`}>
                  <span className="font-semibold text-gray-900">{line.from}</span>
                  <br />
                  {line.text}
                </p>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100"
          >
            <Play className="h-4 w-4" />
            View Full Interaction Flow
          </button>
        </Card>
      </div>
    </PageShell>
  )
}
