import {
  ArrowLeft,
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
import { Link, useNavigate, useParams } from 'react-router-dom'
import AgentAvatar from '../components/AgentAvatar'
import Card from '../components/Card'
import PageShell from '../components/PageShell'
import StatusPill from '../components/StatusPill'
import TopBar from '../components/TopBar'
import { primaryTicket } from '../data/mockData'

// Substitution note: no dedicated "network"/"timeline" icon was on the
// approved list, so Brain Activity and Agent Communication headers reuse
// Share2 and MessageSquare respectively — the closest available glyphs.
export default function TicketDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const ticket = primaryTicket
  const notFound = id !== undefined && id !== ticket.id

  if (notFound) {
    return (
      <PageShell tip="Turn customer issues into resolved tasks with AI agents.">
        <TopBar />
        <div className="px-8 py-16 text-center text-gray-500">Ticket #{id} not found in this demo.</div>
      </PageShell>
    )
  }

  return (
    <PageShell tip="Turn customer issues into resolved tasks with AI agents.">
      <TopBar />

      <div className="px-8 pt-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Link to="/" className="hover:underline">
            Tickets
          </Link>
          <span>/</span>
          <span className="text-gray-700">{ticket.number}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">{ticket.title}</h1>
              <StatusPill label={`${ticket.priority} Priority`} tone="danger" />
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-gray-500">{ticket.description}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/tickets/${ticket.id}/resolution`)}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Play className="h-4 w-4" />
              Simulate Progression
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <MoreHorizontal className="h-4 w-4" />
              More actions
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <MetaItem label="Customer" icon={User} value={ticket.customer} />
          <MetaItem
            label="Status"
            icon={Zap}
            value={<StatusPill label={ticket.status} tone="info" />}
          />
          <MetaItem label="Created" icon={Calendar} value={ticket.createdAt} />
          <MetaItem label="Priority" icon={Zap} value={ticket.priority} valueColor="text-red-500" />
          <MetaItem label="Category" icon={Tag} value={ticket.category} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 py-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <User className="h-4 w-4 text-blue-500" />
            Customer Issue
          </h2>

          <blockquote className="mt-4 rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-700">
            {ticket.issueQuote.map((line) => (
              <p key={line} className="mb-2 last:mb-0">
                {line}
              </p>
            ))}
          </blockquote>

          <dl className="mt-4 space-y-3 text-sm">
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

        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <Share2 className="h-4 w-4 text-violet-500" />
            Brain Activity
          </h2>

          <ol className="mt-4">
            {ticket.brainActivity.map((step, index) => (
              <li key={step.label} className="relative flex gap-3 pb-6 last:pb-0">
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
                <div className="flex flex-1 items-start justify-between gap-3">
                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        step.state === 'pending' ? 'text-gray-400' : 'text-gray-900'
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-gray-500">{step.detail}</p>
                  </div>
                  {step.time && <span className="shrink-0 text-xs text-gray-400">{step.time}</span>}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <div className="px-8 pb-8">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <MessageSquare className="h-4 w-4 text-violet-500" />
              Agent Communication
            </h2>
            <StatusPill label="Live" tone="success" withDot />
          </div>

          <div className="mt-5 space-y-5">
            {ticket.messages.map((message, index) => (
              <div key={`${message.from}-${index}`} className="flex gap-4">
                <span className="w-14 shrink-0 pt-2 text-right text-xs text-gray-400">{message.time}</span>
                <AgentAvatar agentId={message.fromId} size="sm" />
                <div
                  className={`flex-1 rounded-xl border p-3.5 text-sm ${bubbleClasses(message.fromId)} ${
                    message.loading ? 'animate-pulse' : ''
                  }`}
                >
                  <p className="mb-1 font-semibold text-gray-800">
                    {message.from} → {message.to}
                  </p>
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
    </PageShell>
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
        <Icon className="h-4 w-4 text-gray-400" />
        {value}
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  )
}
