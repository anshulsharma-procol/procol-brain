import { Search } from 'lucide-react'
import type { ReactNode } from 'react'
import HeaderActions from './HeaderActions'

interface TopBarProps {
  /** Optional right-aligned slot rendered before the bell/avatar, e.g. a page action button. */
  trailing?: ReactNode
}

export default function TopBar({ trailing }: TopBarProps) {
  return (
    <div className="flex items-center gap-4 border-b border-gray-200 bg-white px-8 py-4">
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search tickets, agents, or anything..."
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-14 text-sm text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:bg-white focus:outline-none"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] text-gray-400">
          ⌘ K
        </span>
      </div>

      <div className="ml-auto flex items-center gap-4">
        {trailing}
        <HeaderActions />
      </div>
    </div>
  )
}
