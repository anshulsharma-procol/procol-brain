import { BookOpen, Brain, ChevronRight, FileText, Home, Settings, Users } from 'lucide-react'
import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Home', to: '/', icon: Home },
  { label: 'Tickets', to: '/tickets', icon: FileText },
  { label: 'Agents', to: '/agents', icon: Users },
  { label: 'Knowledge', to: '/knowledge', icon: BookOpen },
  { label: 'Settings', to: '/settings', icon: Settings },
]

interface SidebarProps {
  tip?: string
}

const DEFAULT_TIP = 'Let AI agents solve real problems together.'

export default function Sidebar({ tip = DEFAULT_TIP }: SidebarProps) {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-gray-200 bg-white px-4 py-5">
      <div className="flex items-center gap-2.5 px-2">
        <div className="brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white">
          <Brain className="h-5 w-5" strokeWidth={2.25} />
        </div>
        <div>
          <p className="text-sm font-bold tracking-tight text-gray-900">PROCOL BRAIN</p>
          <p className="text-xs text-gray-500">AI for Real Work</p>
        </div>
      </div>

      <nav className="mt-8 flex flex-col gap-1">
        {NAV_ITEMS.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={label}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-violet-50 text-violet-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Icon className="h-4.5 w-4.5" strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-4">
        <div className="rounded-xl bg-violet-50 px-4 py-3.5 text-sm leading-snug text-violet-900">
          {tip}
        </div>

        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-700">
            AS
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">Anshul Sharma</p>
            <p className="truncate text-xs text-gray-500">Product Team</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
        </button>
      </div>
    </aside>
  )
}
