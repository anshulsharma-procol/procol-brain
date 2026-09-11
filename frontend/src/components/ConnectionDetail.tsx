import { ExternalLink, Trash2, X } from 'lucide-react'
import ConnectionLogo from './ConnectionLogo'
import { StatusPill } from './ConnectionCard'
import type { Connection } from '../platform/types'

/**
 * One connection, in full.
 *
 * Everything it can do, rather than the first three — because the capability
 * list is the contract between a connection and the agents, and a person
 * deciding whether to grant or revoke access needs to see all of it.
 */
const DATA_MODE: Record<string, string> = {
  'query-in-place': 'A query goes out, an answer comes back. No rows are copied.',
  pushdown: 'A query goes out, aggregates come back.',
  replicated: 'Rows are replicated into a per-tenant store.',
  'metadata-only': 'Structure and titles only — never the contents.',
}

interface Props {
  connection: Connection
  busy?: boolean
  onClose: () => void
  onConnect: () => void
  onRemove: () => void
}

export default function ConnectionDetail({ connection, busy, onClose, onConnect, onRemove }: Props) {
  const name = connection.name ?? connection.id
  const status = connection.status ?? (connection.health.ok ? 'connected' : 'not_connected')

  return (
    <aside
      className="flex h-full w-[380px] shrink-0 flex-col border-l border-gray-200 bg-white"
      aria-label={`${name} connection`}
    >
      <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div className="flex min-w-0 items-start gap-3">
          <ConnectionLogo
            logo={connection.logo ?? connection.id}
            name={name}
            category={connection.category}
            size={40}
          />
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold tracking-tight text-gray-900">{name}</h2>
            <p className="mt-0.5 text-sm text-gray-500">{connection.typeLabel ?? connection.kind}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={status} />
          {status === 'connected' && connection.health.latencyMs > 0 && (
            <span className="font-mono text-[11px] text-gray-400">
              {connection.health.latencyMs}ms
            </span>
          )}
        </div>

        {connection.statusDetail && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">
            {connection.statusDetail}
          </p>
        )}

        <p className="text-sm leading-relaxed text-gray-600">{connection.description}</p>

        {connection.endpoint && (
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Endpoint</p>
            <p className="mt-1 break-all font-mono text-xs text-gray-700">{connection.endpoint}</p>
          </div>
        )}

        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">
            Capabilities ({connection.capabilities.length})
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-500">
            Discovered by Brain. Any agent that declares a need for one of these can be routed
            here.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {connection.capabilities.map((capability) => (
              <li
                key={capability}
                className="rounded-md bg-gray-100 px-2 py-1 font-mono text-[11px] text-gray-600"
              >
                {capability}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-gray-400">Used by</p>
          {connection.usedBy && connection.usedBy.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {connection.usedBy.map((agent) => (
                <li key={agent} className="text-sm text-gray-700">
                  {agent}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-gray-400">
              No agent is using it yet. It becomes available the moment one needs a capability it
              declares.
            </p>
          )}
        </div>

        {connection.dataMode && (
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">What crosses the boundary</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              {DATA_MODE[connection.dataMode] ?? connection.dataMode}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-gray-100 p-6">
        {status !== 'connected' ? (
          <button
            type="button"
            onClick={onConnect}
            disabled={busy}
            className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-60"
          >
            {busy ? 'Connecting…' : status === 'action_required' ? 'Reconnect' : 'Connect'}
          </button>
        ) : (
          connection.endpoint && (
            <a
              href={connection.endpoint.startsWith('http') ? connection.endpoint : undefined}
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Open
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )
        )}

        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="rounded-lg border border-gray-200 p-2.5 text-gray-500 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </aside>
  )
}
