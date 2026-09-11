import { NODE_KIND_META } from '../nodeKinds'
import type { AgentNode } from '../types'

interface NodeCardProps {
  node: AgentNode
  selected: boolean
  onSelect: () => void
}

export default function NodeCard({ node, selected, onSelect }: NodeCardProps) {
  const meta = NODE_KIND_META[node.kind]
  const Icon = meta.icon

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-80 items-center gap-3 rounded-xl border bg-white p-3 text-left shadow-sm transition-shadow ${
        selected ? 'border-blue-400 ring-4 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.tintBg} ${meta.tintText}`}>
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">{node.title}</p>
        <p className="truncate text-xs text-gray-500">{node.subtitle}</p>
      </div>
    </button>
  )
}
