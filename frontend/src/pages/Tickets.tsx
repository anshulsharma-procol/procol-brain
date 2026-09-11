import { ListFilter, Plus, Search } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import Card from '../components/Card'
import PageShell from '../components/PageShell'
import TicketInfoPanel from '../components/TicketInfoPanel'
import TicketListRow from '../components/TicketListRow'
import TopBar from '../components/TopBar'
import { allTickets } from '../data/mockData'

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

      <div className="grid grid-cols-1 gap-4 px-8 py-6 xl:grid-cols-[380px_1fr] xl:items-start">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-sm font-semibold text-gray-500">{allTickets.length} tickets</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Search tickets"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Filter tickets"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <ListFilter className="h-4 w-4" />
              </button>
            </div>
          </div>

          <Card className="overflow-hidden p-0">
            {allTickets.map((ticket) => (
              <TicketListRow
                key={ticket.id}
                ticket={ticket}
                selected={ticket.id === selected.id}
                onSelect={() => navigate(`/tickets/${ticket.id}`)}
              />
            ))}
          </Card>
        </div>

        <div className="xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
          <TicketInfoPanel ticket={selected} />
        </div>
      </div>
    </PageShell>
  )
}
