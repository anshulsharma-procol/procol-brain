import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useWorkspace } from '../platform/react'

/**
 * Switches which control tower the console is driving.
 *
 * This is the product argument as a control: the orchestrator, the protocol,
 * the approval gate and every screen stay exactly where they are — only the
 * company, its agents and its data change. Procol's knowledge agent is Clara;
 * AcmeCloud's is their own. Brain routes on capability, so it never noticed.
 */
export default function WorkspaceSwitcher() {
  const { workspace, workspaces, setWorkspaceId } = useWorkspace()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex w-full items-center gap-2.5 rounded-lg border border-gray-200 px-2.5 py-2 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white ${
            workspace.accent === 'violet' ? 'bg-violet-600' : 'bg-blue-600'
          }`}
        >
          {workspace.name.slice(0, 2).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-900">{workspace.name}</span>
          <span className="block truncate text-[11px] text-gray-500">Control tower</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {workspaces.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                role="option"
                aria-selected={candidate.id === workspace.id}
                onClick={() => {
                  setWorkspaceId(candidate.id)
                  setOpen(false)
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus-visible:bg-gray-50"
              >
                <Check
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    candidate.id === workspace.id ? 'text-violet-600' : 'text-transparent'
                  }`}
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">{candidate.name}</span>
                  <span className="block text-xs text-gray-500">{candidate.tagline}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
