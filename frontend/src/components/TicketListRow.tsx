import { CornerDownRight } from 'lucide-react'
import AgentAvatar from './AgentAvatar'
import type { Ticket } from '../types'

// Row styling follows the reference inbox-list pattern: leading avatar,
// name + timestamp, a "to: <agent>" line, a bold subject line, and a
// compound tag row (outline category tag + two-tone status/progress tag).
const AGENT_LABEL: Record<Ticket['currentAgentId'], string> = {
  brain: 'Brain',
  clara: 'Clara',
  dev: 'Dev Agent',
  qa: 'QA Agent',
  manager: 'Manager Agent',
}

const STATUS_STYLE: Record<Ticket['tableStatus'], { bg: string; chipBg: string; text: string }> = {
  'In Progress': { bg: 'bg-blue-100', chipBg: 'bg-blue-200', text: 'text-blue-700' },
  Pending: { bg: 'bg-amber-100', chipBg: 'bg-amber-200', text: 'text-amber-700' },
  Resolved: { bg: 'bg-green-100', chipBg: 'bg-green-200', text: 'text-green-700' },
}

interface TicketListRowProps {
  ticket: Ticket
  selected: boolean
  onSelect: () => void
}

export default function TicketListRow({ ticket, selected, onSelect }: TicketListRowProps) {
  const status = STATUS_STYLE[ticket.tableStatus]
  const initial = ticket.customer.charAt(0).toUpperCase()

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3.5 text-left last:border-0 ${
        selected ? 'bg-blue-50' : 'bg-white hover:bg-gray-50'
      }`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-semibold text-gray-600">
        {initial}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-gray-900">{ticket.customer}</p>
          <span className="shrink-0 text-xs text-gray-400">{ticket.updated}</span>
        </div>

        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">
          <span>to:</span>
          <AgentAvatar agentId={ticket.currentAgentId} size="xs" />
          <span className="truncate">{AGENT_LABEL[ticket.currentAgentId]}</span>
        </div>

        <p className="mt-2 line-clamp-2 text-sm font-semibold text-gray-900">
          {ticket.number} | {ticket.title}
        </p>

        <div className="mt-2 flex items-center gap-1.5">
          <CornerDownRight className="h-4 w-4 shrink-0 text-gray-300" />
          <span className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600">
            {ticket.category}
          </span>
          <span className="inline-flex overflow-hidden rounded-md">
            <span className={`px-2 py-1 text-xs font-medium ${status.bg} ${status.text}`}>
              {ticket.tableStatus}
            </span>
            <span className={`px-2 py-1 text-xs font-semibold ${status.chipBg} ${status.text}`}>
              {ticket.progress}%
            </span>
          </span>
        </div>
      </div>
    </button>
  )
}
