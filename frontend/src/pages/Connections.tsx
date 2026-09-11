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
  /**
   * Keyed by workspace and attempt, so a tower switch never shows the
   * previous one's rows and a retry reads as loading rather than as a result
   * that has not changed.
   */
  const [loaded, setLoaded] = useState<{
    key: string
    connections: Connection[]
    error?: string
  } | null>(null)
  const [types, setTypes] = useState<ConnectionType[]>([])
  const [filter, setFilter] = useState<'all' | ConnectionCategory>('all')
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | undefined>()
  /**
   * Set when the list could not be read at all.
   *
   * Kept separate from "there are none", because collapsing the two is the
   * worst thing this screen can do: a company with eight live connections
   * told they have none may start re-adding things that already exist. An
   * empty state is a statement of fact and has to be earned.
   */
  /** Bumped to retry, which is the only affordance a failed load needs. */
  const [attempt, setAttempt] = useState(0)
  /**
   * What just happened, for a screen reader.
   *
   * Connecting and removing both rewrite the card and unmount the button that
   * was pressed — so without this the only feedback is visual, and a
   * screen-reader user presses Enter, hears nothing, and finds focus gone.
   */
  const [announcement, setAnnouncement] = useState('')

  const key = `${workspace.id}:${attempt}`

  const load = useCallback(async () => {
    const rows = await consoleApi.listConnections(workspace.id)
    // The type list is an extension endpoint; without it the drawer has
    // nothing to offer, but the connections themselves still render.
    const available = await consoleApi.listConnectionTypes().catch(() => [])
    setLoaded({ key: `${workspace.id}:${attempt}`, connections: rows })
    setTypes(available)
  }, [workspace.id, attempt])

  useEffect(() => {
    let live = true

    void consoleApi
      .listConnections(workspace.id)
      .then(async (rows) => {
        const available = await consoleApi.listConnectionTypes().catch(() => [])
        if (!live) return
        setLoaded({ key, connections: rows })
        setTypes(available)
      })
      .catch((cause: unknown) => {
        if (!live) return
        setLoaded({
          key,
          connections: [],
          error: cause instanceof Error ? cause.message : 'Lost connection to Brain.',
        })
      })

    return () => {
      live = false
    }
  }, [workspace.id, key])

  // Anything belonging to another workspace is stale, not content. Memoised
  // so the empty fallback is not a fresh array on every render.
  const connections = useMemo(
    () => (loaded?.key === key ? loaded.connections : EMPTY),
    [loaded, key],
  )
  const loading = loaded?.key !== key
  const loadError = loaded?.key === key ? loaded.error : undefined

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
    setAnnouncement(`Connecting ${connection.name}…`)
    try {
      const next = await consoleApi.reconnect(workspace.id, connection.id)
      await load()
      // The card rewrites itself on success and the button it was pressed
      // with unmounts, so without this a screen-reader user hears nothing
      // and finds focus gone.
      setAnnouncement(
        next.status === 'connected'
          ? `${connection.name} connected.`
          : `${connection.name} is still not connected.`,
      )
    } catch (cause) {
      setAnnouncement(
        `Could not connect ${connection.name}. ${
          cause instanceof Error ? cause.message : 'Try again.'
        }`,
      )
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
      setAnnouncement(`${created.name} added.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the connection.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (connection: Connection) => {
    await consoleApi.removeConnection(workspace.id, connection.id).catch(() => {})
    setSelected(null)
    setAnnouncement(`${connection.name} removed.`)
    await load()
  }

  return (
    <PageShell tip="Connect your tools. Unleash your agents. Make real work happen.">
      {/* Polite, so it waits for the reader to finish rather than cutting in. */}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

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

            {/* Disabled while the list could not be read: the drawer's first
                step is choosing a type, and with no types it opens onto
                nothing. Offering a button that leads nowhere is worse than
                one that says why it is unavailable. */}
            <button
              type="button"
              disabled={Boolean(loadError) || types.length === 0}
              title={
                loadError || types.length === 0
                  ? 'Unavailable while the console cannot reach Brain'
                  : undefined
              }
              onClick={() => {
                setAdding(true)
                setSelected(null)
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:bg-gray-300"
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
              <p className="py-10 text-center text-sm text-gray-500">Loading connections…</p>
            ) : loadError ? (
              <div
                role="alert"
                className="rounded-xl border border-dashed border-amber-300 bg-amber-50 py-14 text-center"
              >
                <p className="text-sm font-medium text-amber-900">
                  Could not read this control tower&apos;s connections.
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm text-amber-800">
                  {loadError} Nothing has been changed — this is what the console can see, not
                  what is connected.
                </p>
                <button
                  type="button"
                  onClick={() => setAttempt((count) => count + 1)}
                  className="mt-4 rounded-lg bg-amber-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  Try again
                </button>
              </div>
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
