import { Brain, Clock, FileText, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import AgentInitials from '../components/AgentInitials'
import Card from '../components/Card'
import HeaderActions from '../components/HeaderActions'
import PageShell from '../components/PageShell'
import StageRail from '../components/StageRail'
import StatusPill from '../components/StatusPill'
import { agentVisual, useStats, useTickets, useWorkspace } from '../platform/react'
import type { Stage, Ticket } from '../platform/types'
import type { Tone } from '../types'
import { humaniseConstant, relativeTime } from '../utils/format'

const STATUS_TONE: Record<Ticket['status'], Tone> = {
  NEW: 'neutral',
  RUNNING: 'info',
  AWAITING_APPROVAL: 'warning',
  RESOLVED: 'success',
  NEEDS_HUMAN: 'danger',
  REJECTED: 'danger',
}

/**
 * The board. Not a stat-card grid with a table underneath it — the tickets are
 * the hero, and everything waiting on a person sorts to the top.
 */
export default function Home() {
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const { data: tickets = [], loading: ticketsLoading, error } = useTickets()
  const { data: stats } = useStats()

  const now = new Date()

  return (
    <PageShell tip="One orchestrator, one audit trail, whatever the company.">
      <div className="flex items-center justify-end px-8 pt-5">
        <HeaderActions />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-6 px-8 pb-2 pt-2">
        <div>
          <p className="text-sm text-gray-500">{workspace.product}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
            {workspace.name} control tower
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Every open issue, which agent holds it, and what is waiting on you.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill label="Brain active" tone="success" withDot />
          <p className="text-sm text-gray-500">
            {now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 py-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active tickets"
          value={stats?.activeTickets}
          caption="Open across this control tower"
          icon={FileText}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Agents working"
          value={stats?.aiWorking}
          caption="Runs in flight right now"
          icon={Zap}
          iconBg="bg-violet-100"
          iconColor="text-violet-600"
        />
        <StatCard
          label="Waiting on you"
          value={stats?.awaitingApproval}
          caption="Stopped at the approval gate"
          icon={Clock}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
        />
        <StatCard
          label="Hours saved"
          value={stats?.hoursSavedThisMonth}
          caption="From answers this tower already knew"
          icon={Brain}
          iconBg="bg-green-100"
          iconColor="text-green-600"
        />
      </div>

      <div className="px-8">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Active operations</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Live status of every ticket Brain is working, ordered by what needs a human first.
              </p>
            </div>
            <StatusPill label={`${tickets.length} tickets`} tone="neutral" />
          </div>

          <div className="mt-4 overflow-x-auto">
            {error ? (
              <p className="px-6 py-10 text-center text-sm text-gray-500">
                Lost connection to Brain. Reconnecting.
              </p>
            ) : ticketsLoading && tickets.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-gray-400">Loading tickets…</p>
            ) : tickets.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-gray-500">
                No tickets yet. Raise one to watch Brain work.
              </p>
            ) : (
              <table className="w-full min-w-[840px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    <th className="px-6 py-3 font-medium">Ticket</th>
                    <th className="px-3 py-3 font-medium">Customer</th>
                    <th className="px-3 py-3 font-medium">Stage</th>
                    <th className="px-3 py-3 font-medium">Holding</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <TicketRow
                      key={ticket.reference}
                      ticket={ticket}
                      now={now}
                      onOpen={() => navigate(`/tickets/${ticket.reference}`)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 py-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-gray-900">Tickets by stage</h2>
          <p className="mt-0.5 text-sm text-gray-500">Where the work currently sits.</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats?.ticketsByStatus ?? []}
                margin={{ top: 16, right: 8, left: -24, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {(stats?.ticketsByStatus ?? []).map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <AgentActivityCard />
      </div>
    </PageShell>
  )
}

function TicketRow({ ticket, now, onOpen }: { ticket: Ticket; now: Date; onOpen: () => void }) {
  const { workspace } = useWorkspace()
  const holder = agentVisual(workspace, ticket.currentAgentId)
  const awaiting = ticket.status === 'AWAITING_APPROVAL'

  return (
    <tr
      onClick={onOpen}
      className={`cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50 ${
        awaiting ? 'border-l-[3px] border-l-violet-600' : ''
      }`}
    >
      <td className="px-6 py-4 align-top">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpen()
          }}
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <span className="block font-mono text-xs text-gray-500">{ticket.reference}</span>
          <span className="mt-0.5 block font-semibold text-gray-900">{ticket.title}</span>
          {ticket.channel === 'signal' && (
            <span className="mt-0.5 block text-xs text-gray-400">
              detected by monitoring — no customer report
            </span>
          )}
        </button>
      </td>
      <td className="px-3 py-4 align-top text-gray-600">{ticket.customer}</td>
      <td className="px-3 py-4 align-top">
        <StageRail stages={ticket.stages ?? stagesFromProgress(ticket)} size="sm" />
      </td>
      <td className="px-3 py-4 align-top">
        {ticket.currentAgentId || ticket.currentAgentAction ? (
          <div className="flex items-center gap-2.5">
            {ticket.currentAgentId && <AgentInitials agentId={ticket.currentAgentId} />}
            <div className="min-w-0">
              {ticket.currentAgentId && (
                <p className="truncate text-sm font-medium text-gray-900">{holder.name}</p>
              )}
              <p className="truncate text-xs text-gray-500">{ticket.currentAgentAction}</p>
            </div>
          </div>
        ) : (
          <span className="text-xs text-gray-400">Not started</span>
        )}
      </td>
      <td className="px-3 py-4 align-top">
        <StatusPill label={humaniseConstant(ticket.status)} tone={STATUS_TONE[ticket.status]} />
      </td>
      <td className="px-3 py-4 align-top text-gray-500">{relativeTime(ticket.updatedAt, now)}</td>
    </tr>
  )
}

/**
 * Fallback for tickets with no run behind them, where all we have is a
 * progress number. Anything Brain has actually worked carries its real
 * stages, so a configuration fix shows its two skipped dots here too.
 */
function stagesFromProgress(ticket: Ticket): Stage[] {
  const labels: { id: Stage['id']; label: string }[] = [
    { id: 'context', label: 'Context' },
    { id: 'investigate', label: 'Investigate' },
    { id: 'verify', label: 'Verify' },
    { id: 'approve', label: 'Approve' },
  ]
  const completed = Math.round((ticket.progress / 100) * labels.length)

  return labels.map((stage, index) => ({
    ...stage,
    status:
      index < completed
        ? 'complete'
        : index === completed && ticket.status !== 'NEW' && ticket.status !== 'RESOLVED'
          ? 'active'
          : 'pending',
    agentId: index < completed ? ticket.currentAgentId : undefined,
  }))
}

function AgentActivityCard() {
  const { workspace } = useWorkspace()
  const { data: stats } = useStats()

  const rows = (stats?.agentActivity ?? []).map((row) => ({
    ...row,
    color: colorHexFor(agentVisual(workspace, row.agentId).color),
  }))
  const total = rows.reduce((sum, row) => sum + row.value, 0)

  return (
    <Card className="p-6">
      <h2 className="text-base font-semibold text-gray-900">Agent activity</h2>
      <p className="mt-0.5 text-sm text-gray-500">
        Tasks handled by each agent in {workspace.name}&apos;s registry.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={rows} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                {rows.map((row) => (
                  <Cell key={row.agentId} fill={row.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">{total}</span>
            <span className="text-xs text-gray-500">tasks</span>
          </div>
        </div>

        <ul className="min-w-[180px] flex-1 space-y-3">
          {rows.map((row) => (
            <li key={row.agentId} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-gray-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                {row.name}
              </span>
              <span className="font-semibold text-gray-900">{row.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

/** Recharts needs a hex, not a Tailwind class. */
function colorHexFor(token: string): string {
  const hex: Record<string, string> = {
    violet: '#7c3aed',
    blue: '#3b82f6',
    green: '#16a34a',
    amber: '#f59e0b',
    red: '#ef4444',
    gray: '#9ca3af',
  }
  return hex[token] ?? hex.gray
}

interface StatCardProps {
  label: string
  value: number | undefined
  caption: string
  icon: typeof FileText
  iconBg: string
  iconColor: string
}

function StatCard({ label, value, caption, icon: Icon, iconBg, iconColor }: StatCardProps) {
  return (
    <Card className="p-5">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={2} />
      </div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value ?? '—'}</p>
      <p className="mt-1 text-xs text-gray-400">{caption}</p>
    </Card>
  )
}
