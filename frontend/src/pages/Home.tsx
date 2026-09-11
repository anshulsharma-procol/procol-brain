import { CheckCircle, Clock, FileText, MoreHorizontal, Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import AgentInitials from '../components/AgentInitials'
import Card from '../components/Card'
import HeaderActions from '../components/HeaderActions'
import PageShell from '../components/PageShell'
import StatusPill from '../components/StatusPill'
import { agentActivityChart, allTickets, homeStats, ticketStatusChart } from '../data/mockData'
import type { Tone } from '../types'

const STAT_CARDS = [
  {
    label: 'Total Tickets',
    value: homeStats.totalTickets.value,
    change: homeStats.totalTickets.change,
    caption: homeStats.totalTickets.caption,
    icon: FileText,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    changeColor: 'text-green-600',
  },
  {
    label: 'AI Working',
    value: homeStats.aiWorking.value,
    change: homeStats.aiWorking.change,
    caption: homeStats.aiWorking.caption,
    icon: Zap,
    iconBg: 'bg-violet-100',
    iconColor: 'text-violet-600',
    changeColor: 'text-green-600',
  },
  {
    label: 'Need Approval',
    value: homeStats.needApproval.value,
    change: homeStats.needApproval.change,
    caption: homeStats.needApproval.caption,
    icon: Clock,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    changeColor: 'text-red-500',
  },
  {
    label: 'Resolved',
    value: homeStats.resolved.value,
    change: homeStats.resolved.change,
    caption: homeStats.resolved.caption,
    icon: CheckCircle,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    changeColor: 'text-green-600',
  },
]

const TABLE_STATUS_TONE: Record<string, Tone> = {
  'In Progress': 'info',
  Pending: 'warning',
  Resolved: 'success',
}

// The Home table uses a shorter caption than the full ticket title for #1245
// to match the reference screen; every other ticket's title is short enough
// to use as-is.
const SHORT_TITLE: Record<string, string> = {
  '1245': 'Invoice GST issue',
}

const operationsRows = allTickets.map((ticket) => ({
  id: ticket.id,
  number: ticket.number.replace('#', ''),
  title: SHORT_TITLE[ticket.id] ?? ticket.title,
  progress: ticket.progress,
  currentAgentId: ticket.currentAgentId,
  currentAgentAction: ticket.currentAgentAction,
  tableStatus: ticket.tableStatus,
  updated: ticket.updated,
}))

const AGENT_LABEL: Record<string, string> = {
  brain: 'Brain',
  clara: 'Clara',
  dev: 'Dev Agent',
  qa: 'QA Agent',
  manager: 'Waiting approval',
}

export default function Home() {
  const navigate = useNavigate()
  const now = new Date()
  const dateLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <PageShell tip="Let AI agents solve real problems together.">
      <div className="flex items-center justify-end px-8 pt-5">
        <HeaderActions />
      </div>

      <div className="flex flex-wrap items-start justify-between gap-6 px-8 pb-2 pt-2">
        <div>
          <p className="text-sm text-gray-500">Good morning, Anshul 👋</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">Brain Command Center</h1>
          <p className="mt-1 text-sm text-gray-500">Monitor AI agents, track progress, and get real work done.</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
            AI Active
          </span>
          <p className="text-sm text-gray-500">{dateLabel}</p>
          <p className="text-sm font-semibold text-gray-900">
            {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 py-6 sm:grid-cols-2 xl:grid-cols-4">
        {STAT_CARDS.map((stat) => (
          <Card key={stat.label} className="p-5">
            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconBg}`}>
              <stat.icon className={`h-5 w-5 ${stat.iconColor}`} strokeWidth={2} />
            </div>
            <p className="text-sm text-gray-500">{stat.label}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{stat.value}</span>
              <span className={`text-xs font-semibold ${stat.changeColor}`}>↑ {stat.change}</span>
            </div>
            <p className="mt-1 text-xs text-gray-400">{stat.caption}</p>
          </Card>
        ))}
      </div>

      <div className="px-8">
        <Card>
          <div className="flex items-center justify-between px-6 pt-5">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Active AI Operations</h2>
              <p className="mt-0.5 text-sm text-gray-500">Live status of tickets being processed by AI agents.</p>
            </div>
            <button type="button" className="text-sm font-medium text-blue-600 hover:underline">
              View all →
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                  <th className="px-6 py-3 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">Ticket</th>
                  <th className="px-3 py-3 font-medium">Progress</th>
                  <th className="px-3 py-3 font-medium">Current Agent</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Updated</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {operationsRows.map((row, index) => (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/tickets/${row.id}`)}
                    className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 align-top text-gray-500">{index + 1}</td>
                    <td className="px-3 py-4 align-top">
                      <p className="font-semibold text-gray-900">{row.number}</p>
                      <p className="text-xs text-gray-500">{row.title}</p>
                    </td>
                    <td className="px-3 py-4 align-top">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${row.progress}%` }} />
                        </div>
                        <span className="text-xs text-gray-500">{row.progress}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-4 align-top">
                      <div className="flex items-center gap-2.5">
                        <AgentInitials agentId={row.currentAgentId} />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{AGENT_LABEL[row.currentAgentId]}</p>
                          <p className="text-xs text-gray-500">{row.currentAgentAction}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-4 align-top">
                      <StatusPill label={row.tableStatus} tone={TABLE_STATUS_TONE[row.tableStatus]} />
                    </td>
                    <td className="px-3 py-4 align-top text-gray-500">{row.updated}</td>
                    <td className="px-3 py-4 align-top text-right">
                      <button
                        type="button"
                        aria-label="More actions"
                        onClick={(event) => event.stopPropagation()}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 py-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-base font-semibold text-gray-900">Ticket Status Overview</h2>
          <p className="mt-0.5 text-sm text-gray-500">Distribution of tickets across different stages.</p>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ticketStatusChart} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f3f4f6" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {ticketStatusChart.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-base font-semibold text-gray-900">AI Agent Activity</h2>
          <p className="mt-0.5 text-sm text-gray-500">Tasks handled by each agent.</p>
          <div className="mt-4 flex items-center gap-6">
            <div className="relative h-52 w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={agentActivityChart}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={92}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {agentActivityChart.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">
                  {agentActivityChart.reduce((sum, item) => sum + item.value, 0)}
                </span>
                <span className="text-xs text-gray-500">Active Tasks</span>
              </div>
            </div>

            <ul className="flex-1 space-y-3">
              {agentActivityChart.map((entry) => (
                <li key={entry.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-gray-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    {entry.name}
                  </span>
                  <span className="font-semibold text-gray-900">{entry.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </PageShell>
  )
}
