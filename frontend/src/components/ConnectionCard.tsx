import { ChevronRight } from 'lucide-react'
import ConnectionLogo from './ConnectionLogo'
import type { Connection } from '../platform/types'

/**
 * One connected system.
 *
 * The card answers the three questions someone actually has about an
 * integration: is it working, what can it do, and who is relying on it. The
 * capability chips are the important half — they are what the agents route
 * against, so they are the closest thing to a reason this connection exists.
 */
interface Props {
  connection: Connection
  onOpen: () => void
  onConnect: () => void
  busy?: boolean
}

/** Chips shown before the overflow count. */
const VISIBLE_CAPABILITIES = 3

export default function ConnectionCard({ connection, onOpen, onConnect, busy }: Props) {
  const name = connection.name ?? connection.id
  const status = connection.status ?? (connection.health.ok ? 'connected' : 'not_connected')
  const shown = connection.capabilities.slice(0, VISIBLE_CAPABILITIES)
  const overflow = connection.capabilities.length - shown.length

  return (
    <div
      className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-5 transition-colors hover:border-gray-300"
    >
      <div className="flex items-start gap-3.5">
        <ConnectionLogo logo={connection.logo ?? connection.id} name={name} category={connection.category} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <button
                type="button"
                onClick={onOpen}
                className="text-left text-[15px] font-semibold text-gray-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                {name}
              </button>
              <p className="mt-0.5 text-sm text-gray-500">
                {connection.typeLabel ?? connection.kind}
              </p>
            </div>

            {status === 'not_connected' ? (
              /*
               * The pill states the fact; the button offers the fix, and only
               * when you have reached for it. Both occupy the same cell so
               * the card does not reflow under the cursor — and the swap is
               * opacity rather than display, so the button stays reachable by
               * keyboard.
               */
              <span className="relative grid shrink-0 place-items-center">
                <span className="col-start-1 row-start-1 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
                  <StatusPill status={status} />
                </span>
                <button
                  type="button"
                  onClick={onConnect}
                  disabled={busy}
                  className="col-start-1 row-start-1 rounded-lg border border-violet-300 px-3 py-1.5 text-sm font-medium text-violet-700 opacity-0 transition-opacity hover:bg-violet-50 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-60 group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  {busy ? 'Connecting…' : '+ Connect'}
                </button>
              </span>
            ) : (
              <StatusPill status={status} />
            )}
          </div>

          <p className="mt-2.5 text-sm leading-relaxed text-gray-600">{connection.description}</p>

          {connection.capabilities.length > 0 && (
            <ul className="mt-3 flex flex-wrap items-center gap-1.5">
              {shown.map((capability) => (
                <li
                  key={capability}
                  className="rounded-md bg-gray-100 px-2 py-1 font-mono text-[11px] text-gray-600"
                >
                  {capability}
                </li>
              ))}
              {overflow > 0 && (
                <li className="px-1 font-mono text-[11px] text-gray-500">
                  <span aria-hidden="true">+{overflow}</span>
                  <span className="sr-only">and {overflow} more</span>
                </li>
              )}
            </ul>
          )}

          <p className="mt-3 border-t border-gray-100 pt-3 text-xs text-gray-500">
            <span className="font-medium text-gray-600">Used by:</span>{' '}
            {connection.usedBy && connection.usedBy.length > 0 ? connection.usedBy.join(', ') : '—'}
          </p>
        </div>
      </div>

      {/* Decoration, not a control: the name above is already the way in, and
          a second stop that does the identical thing means a screen-reader
          user hears every connection offered twice and a keyboard user
          crosses the grid in sixteen stops instead of eight. */}
      <ChevronRight
        aria-hidden="true"
        className="pointer-events-none absolute right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300 transition-colors group-hover:text-gray-500"
      />
    </div>
  )
}

export function StatusPill({ status }: { status: NonNullable<Connection['status']> }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
        Connected
      </span>
    )
  }

  if (status === 'action_required') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        Action required
      </span>
    )
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
      Not connected
    </span>
  )
}
