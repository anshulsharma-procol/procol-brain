import { BookOpen, Brain, FileText, Home, Settings, Sparkles, Users } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { isDemoData } from '../platform/api'
import SidebarTickets from './SidebarTickets'
import WorkspaceSwitcher from './WorkspaceSwitcher'

/** Tickets sit between these two groups — see the nav below. */
const PRIMARY_NAV = [{ label: 'Board', to: '/', icon: Home }]

const SECONDARY_NAV = [
  { label: 'Agents', to: '/agents', icon: Users },
  { label: 'Memory', to: '/memory', icon: Sparkles },
  { label: 'Knowledge', to: '/knowledge', icon: BookOpen },
  { label: 'Settings', to: '/settings', icon: Settings },
]

const DEFAULT_TIP = 'One orchestrator, one audit trail, whatever the company.'

export default function Sidebar({ tip = DEFAULT_TIP }: { tip?: string }) {
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-gray-200 bg-white px-4 py-5">
      <div className="flex items-center gap-2.5 px-2">
        <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white">
          <Brain className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-gray-900">PROCOL BRAIN</p>
          <p className="text-xs text-gray-500">AI for real work</p>
        </div>
      </div>

      {/* Which company's control tower this is. Same build, different tenant. */}
      <div className="mt-5">
        <WorkspaceSwitcher />
      </div>

      <nav className="mt-6 flex flex-col gap-1">
        {PRIMARY_NAV.map((item) => (
          <NavItem key={item.label} {...item} />
        ))}

        {/* Jump straight to a run from anywhere, without going via the board. */}
        <SidebarTickets />

        {SECONDARY_NAV.map((item) => (
          <NavItem key={item.label} {...item} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4 pt-6">
        <div className="rounded-xl bg-violet-50 px-4 py-3.5 text-sm leading-snug text-violet-900">
          {tip}
        </div>

        {isDemoData && (
          <p className="flex items-center gap-1.5 px-2 text-[11px] text-gray-400">
            <FileText className="h-3 w-3" />
            Scripted data — set VITE_BRAIN_API_URL for live
          </p>
        )}

        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
            AS
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">Anshul Sharma</p>
            <p className="truncate text-xs text-gray-500">Product team</p>
          </div>
        </button>
      </div>
    </aside>
  )
}

function NavItem({ label, to, icon: Icon }: { label: string; to: string; icon: typeof Home }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive ? 'bg-violet-50 text-violet-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`
      }
    >
      <Icon className="h-4 w-4" strokeWidth={2} />
      {label}
    </NavLink>
  )
}
