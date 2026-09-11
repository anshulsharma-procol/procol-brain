import { ChevronRight } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import AgentAvatar from '../components/AgentAvatar'
import Card from '../components/Card'
import PageShell from '../components/PageShell'
import StatusPill from '../components/StatusPill'
import TopBar from '../components/TopBar'
import { colorClasses } from '../components/colorClasses'
import { useWorkspace, visualForAgent } from '../platform/react'
import type { AgentDef, ConnectorDef } from '../platform/types'
import type { Tone } from '../types'

const STATUS_TONE: Record<AgentDef['status'], Tone> = {
  connected: 'success',
  degraded: 'warning',
  offline: 'neutral',
}

const OWNERSHIP_LABEL: Record<AgentDef['ownership'], string> = {
  procol: 'Procol',
  customer: 'Customer-owned',
  'third-party': 'Third party',
}

/**
 * The registry. A table rather than cards, because the point of this screen
 * is a machine-readable capability declaration a person can actually read.
 *
 * The "who can…?" filter is ten lines and demonstrates the architecture better
 * than a paragraph of narration: Brain routes to whoever declares the
 * capability, so you can watch the set of eligible agents change as you type.
 */
export default function AgentRegistry() {
  const { workspace } = useWorkspace()
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  const agents = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return workspace.agents
    return workspace.agents.filter(
      (agent) =>
        agent.capabilities.some((capability) => capability.includes(needle)) ||
        agent.name.toLowerCase().includes(needle) ||
        agent.role.includes(needle),
    )
  }, [workspace.agents, query])

  return (
    <PageShell tip="Brain routes work by capability, not by name.">
      <TopBar />

      <div className="px-8 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Agent registry</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Brain routes work by capability, not by name. Any agent that declares{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs text-gray-700">create_pr</code>{' '}
          can receive this work — which is why {workspace.name}&apos;s own{' '}
          {workspace.agents.find((agent) => agent.role === 'knowledge')?.name ?? 'knowledge agent'} slots
          in without a line of company-specific code.
        </p>

        <label htmlFor="capability-filter" className="sr-only">
          Filter by capability
        </label>
        <input
          id="capability-filter"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="who can…?  try create_pr, run_tests, product_knowledge"
          className="mt-4 w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-sm text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:outline-none"
        />
      </div>

      <div className="px-8 py-6">
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                  <th className="px-6 py-3 font-medium">Agent</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">Capabilities</th>
                  <th className="px-3 py-3 font-medium">Tools</th>
                  <th className="px-3 py-3 font-medium">Runs on</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {agents.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500">
                      No agent in this control tower declares “{query}”.
                    </td>
                  </tr>
                )}

                {agents.map((agent) => {
                  const visual = visualForAgent(agent)
                  const isOpen = expanded === agent.id

                  return (
                    <Fragment key={agent.id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : agent.id)}
                        className="cursor-pointer border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="px-6 py-4 align-top">
                          <div className="flex items-center gap-3">
                            <span
                              className={`h-8 w-1 shrink-0 rounded-full ${colorClasses[visual.color].rule}`}
                            />
                            <AgentAvatar agentId={agent.id} size="sm" />
                            <div>
                              <p className="font-semibold text-gray-900">{agent.name}</p>
                              <p className="font-mono text-[11px] text-gray-400">{agent.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 align-top text-gray-600">{agent.role}</td>
                        <td className="px-3 py-4 align-top">
                          <p className="max-w-xs font-mono text-[11px] leading-relaxed text-gray-500">
                            {agent.capabilities.join(', ') || '—'}
                          </p>
                        </td>
                        <td className="px-3 py-4 align-top">
                          {agent.tools.length === 0 ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            <ul className="space-y-1">
                              {agent.tools.map((tool) => (
                                <li key={tool.name} className="text-xs text-gray-600">
                                  {tool.name}
                                  <span className="ml-1.5 rounded bg-gray-100 px-1 py-0.5 font-mono text-[10px] text-gray-500">
                                    {tool.via}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="px-3 py-4 align-top text-xs text-gray-600">
                          {OWNERSHIP_LABEL[agent.ownership]}
                        </td>
                        <td className="px-3 py-4 align-top">
                          <StatusPill label={agent.status} tone={STATUS_TONE[agent.status]} withDot />
                        </td>
                        <td className="px-3 py-4 align-top text-right">
                          <ChevronRight
                            className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                          />
                        </td>
                      </tr>

                      {isOpen && (
                        <tr className="border-b border-gray-50 bg-gray-50/60">
                          <td colSpan={7} className="px-6 py-4">
                            <p className="max-w-3xl text-sm text-gray-600">{agent.description}</p>
                            <p className="mt-1 max-w-3xl text-sm text-gray-500">{agent.protocolNote}</p>
                            <p className="mt-3 text-xs uppercase tracking-wide text-gray-400">
                              Agent card
                            </p>
                            <pre className="mt-1 max-w-3xl overflow-x-auto rounded-lg bg-gray-900 p-3 font-mono text-[11px] leading-relaxed text-gray-100">
                              {JSON.stringify(agentCard(agent), null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="px-8 pb-8">
        <Card>
          <div className="px-6 pt-5">
            <h2 className="text-base font-semibold text-gray-900">Connectors</h2>
            <p className="mt-0.5 max-w-3xl text-sm text-gray-500">
              Data sources are discovered the same way agents are. We send the question, not take the
              rows — what actually crosses the boundary is in the last column.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                  <th className="px-6 py-3 font-medium">Connector</th>
                  <th className="px-3 py-3 font-medium">Kind</th>
                  <th className="px-3 py-3 font-medium">Capabilities</th>
                  <th className="px-3 py-3 font-medium">Health</th>
                  <th className="px-3 py-3 font-medium">Data movement</th>
                </tr>
              </thead>
              <tbody>
                {workspace.connectors.map((connector) => (
                  <ConnectorRow key={connector.id} connector={connector} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PageShell>
  )
}

function ConnectorRow({ connector }: { connector: ConnectorDef }) {
  const DATA_MODE: Record<ConnectorDef['dataMode'], string> = {
    'query-in-place': 'A query out, an answer back. No rows leave.',
    pushdown: 'A query out, aggregates back.',
    replicated: 'Rows replicated into a per-tenant store.',
    'metadata-only': 'Schema and embeddings only — never rows.',
  }

  return (
    <tr className="border-b border-gray-50 last:border-0">
      <td className="px-6 py-4 align-top">
        <p className="font-semibold text-gray-900">{connector.name}</p>
        <p className="font-mono text-[11px] text-gray-400">{connector.id}</p>
      </td>
      <td className="px-3 py-4 align-top text-gray-600">{connector.kind}</td>
      <td className="px-3 py-4 align-top">
        <p className="max-w-xs font-mono text-[11px] text-gray-500">
          {connector.capabilities.join(', ')}
        </p>
      </td>
      <td className="px-3 py-4 align-top">
        <StatusPill
          label={connector.latencyMs ? `${connector.latencyMs}ms` : connector.status}
          tone={connector.status === 'connected' ? 'success' : 'warning'}
          withDot
        />
      </td>
      <td className="px-3 py-4 align-top text-xs text-gray-600">{DATA_MODE[connector.dataMode]}</td>
    </tr>
  )
}

/** The A2A agent card as a judge would `curl` it. */
function agentCard(agent: AgentDef) {
  return {
    protocolVersion: '0.3',
    id: agent.id,
    name: agent.name,
    description: agent.description,
    capabilities: { streaming: false },
    skills: agent.capabilities.map((capability) => ({ id: capability })),
    tools: agent.tools.map((tool) => ({ name: tool.name, server: tool.server, via: tool.via })),
  }
}
