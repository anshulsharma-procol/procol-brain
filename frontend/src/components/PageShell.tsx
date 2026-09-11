import type { ReactNode } from 'react'
import Sidebar from './Sidebar'

interface PageShellProps {
  tip?: string
  children: ReactNode
}

/** Shared sidebar + scrollable content shell used by every screen. */
export default function PageShell({ tip, children }: PageShellProps) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar tip={tip} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  )
}
