import { Plus } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import AgentInitials from '../components/AgentInitials'
import PageShell from '../components/PageShell'
import StatusPill from '../components/StatusPill'
import TicketInfoPanel from '../components/TicketInfoPanel'
import TopBar from '../components/TopBar'
import { allTickets } from '../data/mockData'
import type { Tone } from '../types'

const TABLE_STATUS_TONE: Record<string, Tone> = {
  'In Progress': 'info',
  Pending: 'warning',
  Resolved: 'success',
}

const PRIORITY_TONE: Record<string, Tone> = {
  High: 'danger',
  Medium: 'warning',
  Low: 'neutral',
}

export default function Tickets() {
  const { id } = useParams()
  const navigate = useNavigate()

  const selected = allTickets.find((ticket) => ticket.id === id) ?? allTickets[0]

  return (
    <PageShell tip="Turn customer issues into resolved tasks with AI agents.">
      <TopBar
        trailing={
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Ticket
          </button>
        }
      />

      <div className="px-8 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tickets</h1>
        <p className="mt-1 text-sm text-gray-500">
          Every customer issue AI agents are working, waiting on, or have resolved.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 py-6 xl:grid-cols-[1fr_440px]">
        <div className="grid grid-cols-1 gap-3 self-start sm:grid-cols-2">
          {allTickets.map((ticket) => {
            const isSelected = ticket.id === selected.id
            return (
              <button
                key={ticket.id}
                type="button"
                onClick={() => navigate(`/tickets/${ticket.id}`)}
                className={`flex flex-col gap-3 rounded-xl border p-4 text-left transition-colors ${
                  isSelected ? 'border-blue-300 bg-blue-50/60' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{ticket.number}</p>
                    <p className="mt-0.5 truncate text-sm font-medium text-gray-700">{ticket.title}</p>
                  </div>
                  <StatusPill label={ticket.tableStatus} tone={TABLE_STATUS_TONE[ticket.tableStatus]} />
                </div>

                <p className="line-clamp-2 text-xs text-gray-500">{ticket.description}</p>

                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${ticket.progress}%` }} />
                  </div>
                  <span className="text-xs text-gray-500">{ticket.progress}%</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AgentInitials agentId={ticket.currentAgentId} />
                    <div>
                      <p className="text-xs font-medium text-gray-800">{ticket.currentAgentAction}</p>
                      <p className="text-[11px] text-gray-400">{ticket.customer}</p>
                    </div>
                  </div>
                  <StatusPill label={ticket.priority} tone={PRIORITY_TONE[ticket.priority]} />
                </div>
              </button>
            )
          })}
        </div>

        <div className="xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
          <TicketInfoPanel ticket={selected} />
        </div>
      </div>
    </PageShell>
  )
}
