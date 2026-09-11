import {
  Calendar,
  CheckCircle,
  ChevronDown,
  Code,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Play,
  Share2,
  Tag,
  User,
  Zap,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Ticket } from '../types'
import AgentAvatar from './AgentAvatar'
import Card from './Card'
import StatusPill from './StatusPill'

interface TicketInfoPanelProps {
  ticket: Ticket
}

// Substitution note: no dedicated "network"/"timeline" icon was on the
// approved list, so Brain Activity and Agent Communication headers reuse
// Share2 and MessageSquare respectively — the closest available glyphs.
export default function TicketInfoPanel({ ticket }: TicketInfoPanelProps) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-500">{ticket.number}</span>
          <StatusPill label={`${ticket.priority} Priority`} tone="danger" />
        </div>
        <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900">{ticket.title}</h2>
        <p className="mt-1.5 text-sm text-gray-500">{ticket.description}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(`/tickets/${ticket.id}/resolution`)}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            <Play className="h-4 w-4" />
            Simulate Progression
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <MoreHorizontal className="h-4 w-4" />
            More
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
          <MetaItem label="Customer" icon={User} value={ticket.customer} />
          <MetaItem label="Status" icon={Zap} value={<StatusPill label={ticket.status} tone="info" />} />
          <MetaItem label="Created" icon={Calendar} value={ticket.createdAt} />
          <MetaItem label="Priority" icon={Zap} value={ticket.priority} valueColor="text-red-500" />
          <MetaItem label="Category" icon={Tag} value={ticket.category} />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <User className="h-4 w-4 text-blue-500" />
          Customer Issue
        </h3>

        <blockquote className="mt-3 rounded-lg bg-gray-50 p-3.5 text-sm leading-relaxed text-gray-700">
          {ticket.issueQuote.map((line) => (
            <p key={line} className="mb-2 last:mb-0">
              {line}
            </p>
          ))}
        </blockquote>

        <dl className="mt-3 space-y-2.5 text-sm">
          <MetaRow label="Customer" value={ticket.customer} />
          <MetaRow label="Reported by" value={ticket.reportedBy} />
          <MetaRow label="Impact" value={ticket.impact} />
          <MetaRow
            label="Attachments"
            value={
              <span className="flex items-center gap-1.5 text-blue-600 hover:underline">
                <Paperclip className="h-3.5 w-3.5" />
                {ticket.attachment}
              </span>
            }
          />
        </dl>
      </Card>

      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Share2 className="h-4 w-4 text-violet-500" />
          Brain Activity
        </h3>

        <ol className="mt-3">
          {ticket.brainActivity.map((step, index) => (
            <li key={step.label} className="relative flex gap-3 pb-5 last:pb-0">
              {index < ticket.brainActivity.length - 1 && (
                <span className="absolute left-[9px] top-5 h-full w-px bg-gray-200" />
              )}
              <span className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                {step.state === 'done' && <CheckCircle className="h-5 w-5 text-green-600" />}
                {step.state === 'active' && (
                  <span className="pulse-live block h-2.5 w-2.5 rounded-full bg-blue-500" />
                )}
                {step.state === 'pending' && <span className="block h-2.5 w-2.5 rounded-full bg-gray-300" />}
              </span>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p
                    className={`text-sm font-semibold ${
                      step.state === 'pending' ? 'text-gray-400' : 'text-gray-900'
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.time && <span className="shrink-0 text-xs text-gray-400">{step.time}</span>}
                </div>
                <p className="text-xs text-gray-500">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <MessageSquare className="h-4 w-4 text-violet-500" />
            Agent Communication
          </h3>
          <StatusPill label="Live" tone="success" withDot />
        </div>

        <div className="mt-4 space-y-4">
          {ticket.messages.map((message, index) => (
            <div key={`${message.from}-${index}`} className={message.loading ? 'animate-pulse' : ''}>
              <div className="flex items-center gap-2">
                <AgentAvatar agentId={message.fromId} size="sm" />
                <p className="text-sm font-semibold text-gray-800">
                  {message.from} → {message.to}
                </p>
                {message.time && <span className="ml-auto shrink-0 text-xs text-gray-400">{message.time}</span>}
              </div>
              <div className={`mt-1.5 ml-9 rounded-xl border p-3 text-sm ${bubbleClasses(message.fromId)}`}>
                {message.text.map((line) => (
                  <p key={line} className="text-gray-600">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function bubbleClasses(fromId: string) {
  if (fromId === 'dev') return 'bg-green-50 border-green-100'
  if (fromId === 'clara') return 'bg-violet-50 border-violet-100'
  return 'bg-indigo-50 border-indigo-100'
}

interface MetaItemProps {
  label: string
  icon: typeof Code
  value: ReactNode
  valueColor?: string
}

function MetaItem({ label, icon: Icon, value, valueColor = 'text-gray-900' }: MetaItemProps) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <div className={`mt-1 flex items-center gap-1.5 text-sm font-medium ${valueColor}`}>
        <Icon className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="truncate">{value}</span>
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-50 pb-2.5 last:border-0 last:pb-0">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-800">{value}</dd>
    </div>
  )
}
