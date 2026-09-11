import { Plus } from 'lucide-react'
import { ADD_NODE_GROUPS, NODE_KIND_META } from '../nodeKinds'
import type { NodeKind } from '../types'

interface AddNodePopoverProps {
  open: boolean
  onToggle: () => void
  onAdd: (kind: NodeKind) => void
}

export default function AddNodePopover({ open, onToggle, onAdd }: AddNodePopoverProps) {
  return (
    <div className="relative flex justify-center">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Add block"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm hover:border-blue-300 hover:text-blue-600"
      >
        <Plus className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute top-10 z-20 w-72 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          {ADD_NODE_GROUPS.map((group) => (
            <div key={group.label} className="mb-1 last:mb-0">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {group.label}
              </p>
              {group.kinds.map((kind) => {
                const meta = NODE_KIND_META[kind]
                const Icon = meta.icon
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => onAdd(kind)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-gray-50"
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.tintBg} ${meta.tintText}`}>
                      <Icon className="h-4 w-4" strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900">{meta.label}</span>
                      <span className="block truncate text-xs text-gray-500">{meta.hint}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
