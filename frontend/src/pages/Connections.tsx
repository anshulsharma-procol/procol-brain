import { Plus } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import AddConnectionDrawer from '../components/AddConnectionDrawer'
import ConnectionCard from '../components/ConnectionCard'
import ConnectionDetail from '../components/ConnectionDetail'
import PageShell from '../components/PageShell'
import TopBar from '../components/TopBar'
import { consoleApi } from '../platform/api'
import { useWorkspace } from '../platform/react'
import type { Connection, ConnectionCategory, ConnectionType } from '../platform/types'

/**
 * Connections — what a company plugs into Brain.
 *
 * The argument the screen has to make in one glance: Brain is not a closed
 * system you migrate onto. Your agents, your tools, your databases and your
 * APIs stay where they are, and what they can do becomes available to every
 * agent that needs it. That is why each card leads with capabilities and with
 * who is already relying on them, rather than with connection settings.
 */
const FILTERS: { id: 'all' | ConnectionCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'agent', label: 'Agents' },
  { id: 'mcp', label: 'MCP Servers' },
  { id: 'database', label: 'Databases' },
  { id: 'saas', label: 'APIs / SaaS' },
  { id: 'knowledge', label: 'Knowledge' },
]

const EMPTY: Connection[] = []

export default function Connections() {
  const { workspace } = useWorkspace()
  /** Keyed by workspace, so a tower switch never shows the previous one's rows. */
  const [loaded, setLoaded] = useState<{ id: string; connections: Connection[] } | null>(null)
  const [types, setTypes] = useState<ConnectionType[]>([])
  const [filter, setFilter] = useState<'all' | ConnectionCategory>('all')
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>()

  const load = useCallback(async () => {
    const [rows, available] = await Promise.all([
      consoleApi.listConnections(workspace.id),
      consoleApi.listConnectionTypes(),
    ])
    setLoaded({ id: workspace.id, connections: rows })
    setTypes(available)
  }, [workspace.id])

  useEffect(() => {
    let live = true

    void consoleApi
      .listConnections(workspace.id)
      .then(async (rows) => {
        const available = await consoleApi.listConnectionTypes()
        if (!live) return
        setLoaded({ id: workspace.id, connections: rows })
        setTypes(available)
      })
      .catch(() => {
        if (live) setLoaded({ id: workspace.id, connections: [] })
      })

    return () => {
      live = false
    }
  }, [workspace.id])

  // Anything belonging to another workspace is stale, not content. Memoised
  // so the empty fallback is not a fresh array on every render.
  const connections = useMemo(
    () => (loaded?.id === workspace.id ? loaded.connections : EMPTY),
    [loaded, workspace.id],
  )
  const loading = loaded?.id !== workspace.id

  const counts = useMemo(() => {
    const byCategory = new Map<string, number>()
    for (const connection of connections) {
      const key = connection.category ?? 'saas'
      byCategory.set(key, (byCategory.get(key) ?? 0) + 1)
    }
    return byCategory
  }, [connections])

  const visible = useMemo(
    () =>
      filter === 'all'
        ? connections
        : connections.filter((connection) => (connection.category ?? 'saas') === filter),
    [connections, filter],
  )

  const openConnection = connections.find((connection) => connection.id === selected)

  const connect = async (connection: Connection) => {
    setBusyId(connection.id)
    try {
      await consoleApi.reconnect(workspace.id, connection.id)
      await load()
    } catch {
      // A connection that will not come up is not an error worth a dialog;
      // the card keeps its state and the person can try again.
    } finally {
      setBusyId(null)
    }
  }

  const add = async (input: { category: ConnectionCategory; name: string; endpoint?: string }) => {
    setSaving(true)
    setError(undefined)
    try {
      const created = await consoleApi.addConnection({ workspaceId: workspace.id, ...input })
      await load()
      setAdding(false)
      setSelected(created.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the connection.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (connection: Connection) => {
    await consoleApi.removeConnection(workspace.id, connection.id).catch(() => {})
    setSelected(null)
    await load()
  }

  return (
    <PageShell tip="Connect your tools. Unleash your agents. Make real work happen.">
      <div className="flex min-h-screen">
        <div className="min-w-0 flex-1">
          <TopBar />

          <div className="flex flex-wrap items-start justify-between gap-4 px-8 pt-6">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">Connections</h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-500">
                Connect your company&apos;s tools, agents, data and APIs to Procol Brain.
                <br />
                Brain discovers their capabilities and makes them available to your agents.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setAdding(true)
                setSelected(null)
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add connection
            </button>
          </div>

          <div className="flex flex-wrap gap-2 px-8 pt-6">
            {FILTERS.map((entry) => {
              const count =
                entry.id === 'all' ? connections.length : (counts.get(entry.id) ?? 0)
              const active = filter === entry.id

              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setFilter(entry.id)}
                  aria-pressed={active}
                  className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                    active
                      ? 'bg-violet-50 text-violet-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {entry.label} ({count})
                </button>
              )
            })}
          </div>

          <div className="px-8 py-6">
            {loading ? (
              <p className="py-10 text-center text-sm text-gray-400">Loading connections…</p>
            ) : visible.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-14 text-center">
                <p className="text-sm text-gray-500">
                  Nothing connected here yet. Add one and Brain will work out what it can do.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {visible.map((connection) => (
                  <ConnectionCard
                    key={connection.id}
                    connection={connection}
                    busy={busyId === connection.id}
                    onOpen={() => {
                      setSelected(connection.id)
                      setAdding(false)
                    }}
                    onConnect={() => void connect(connection)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {adding && (
          <AddConnectionDrawer
            types={types}
            busy={saving}
            error={error}
            onClose={() => setAdding(false)}
            onSubmit={add}
          />
        )}

        {!adding && openConnection && (
          <ConnectionDetail
            connection={openConnection}
            busy={busyId === openConnection.id}
            onClose={() => setSelected(null)}
            onConnect={() => void connect(openConnection)}
            onRemove={() => void remove(openConnection)}
          />
        )}
      </div>
    </PageShell>
  )
}
