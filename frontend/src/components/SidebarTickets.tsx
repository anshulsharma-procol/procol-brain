import { ChevronDown, FileText } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTickets } from '../platform/react'
import type { Ticket } from '../platform/types'

/**
 * The open tickets of the active control tower, in the sidebar.
 *
 * The board is the place to read a ticket's state; this is the place to jump
 * straight to one from wherever you are, which is what you actually want mid-
 * demo and mid-shift. It is the same list the board renders — sorted so that
 * anything waiting on a person is at the top — and it updates over the same
 * stream, so a run that reaches the approval gate surfaces here without a
 * refresh.
 */
const STATUS_DOT: Record<Ticket['status'], string> = {
  AWAITING_APPROVAL: 'bg-amber-500',
  INVESTIGATING: 'bg-blue-500',
  NEW: 'bg-gray-300',
  NEEDS_HUMAN: 'bg-red-500',
  REJECTED: 'bg-red-500',
  RESOLVED: 'bg-green-600',
}

export default function SidebarTickets() {
  const { data: tickets = [], loading } = useTickets()
  const [open, setOpen] = useState(true)

  // Closed tickets stay on the board; the sidebar is for live work.
  const live = tickets.filter((ticket) => ticket.status !== 'RESOLVED')
  const waiting = live.filter((ticket) => ticket.status === 'AWAITING_APPROVAL').length

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        <FileText className="h-4 w-4 shrink-0" strokeWidth={2} />
        Tickets
        {waiting > 0 && (
          <span
            className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
            title={`${waiting} waiting for your approval`}
          >
            {waiting}
          </span>
        )}
        <ChevronDown
          className={`ml-auto h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>

      {open && (
        <div className="mt-0.5 max-h-72 overflow-y-auto pl-3">
          {loading && live.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">Loading…</p>
          ) : live.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400">Nothing open right now.</p>
          ) : (
            <ul className="border-l border-gray-100">
              {live.map((ticket) => (
                <li key={ticket.reference}>
                  <NavLink
                    to={`/tickets/${ticket.reference}`}
                    title={`${ticket.reference} — ${ticket.title}`}
                    className={({ isActive }) =>
                      `flex items-start gap-2 rounded-r-lg py-1.5 pl-3 pr-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                        isActive ? 'bg-violet-50' : 'hover:bg-gray-50'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[ticket.status]}`}
                        />
                        <span className="min-w-0">
                          <span
                            className={`block font-mono text-[10px] ${
                              isActive ? 'text-violet-700' : 'text-gray-400'
                            }`}
                          >
                            {ticket.reference}
                          </span>
                          <span
                            className={`block truncate text-xs ${
                              isActive ? 'font-medium text-violet-700' : 'text-gray-600'
                            }`}
                          >
                            {ticket.title}
                          </span>
                        </span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
