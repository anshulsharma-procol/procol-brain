import { useState } from 'react'
import { Workflow, X } from 'lucide-react'
import { formatAgentRelativeTime } from './storage'
import type { AgentRecord } from './types'

interface AgentDetailPanelProps {
  agent: AgentRecord
  onClose: () => void
  onSave: (patch: Pick<AgentRecord, 'name' | 'description'>) => void
  onDelete: () => void
  onOpenBuilder: () => void
}

export default function AgentDetailPanel({ agent, onClose, onSave, onDelete, onOpenBuilder }: AgentDetailPanelProps) {
  const [name, setName] = useState(agent.name)
  const [description, setDescription] = useState(agent.description)

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/20"
      />
      <div className="relative flex h-full w-[440px] flex-col bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-gray-100 p-5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-gray-900">{agent.name || 'Untitled agent'}</p>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                agent.status === 'Live' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {agent.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenBuilder}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <Workflow className="h-3.5 w-3.5" />
            Open builder
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <section className="rounded-xl border border-gray-200 p-4">
            <p className="mb-1.5 text-xs font-medium text-gray-500">Agent name</p>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
            />
          </section>

          <section className="rounded-xl border border-gray-200 p-4">
            <p className="mb-1.5 text-xs font-medium text-gray-500">System prompt</p>
            <textarea
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe what this agent does, its inputs, and expected output..."
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
            />
          </section>

          <section className="rounded-xl border border-gray-200 p-4">
            <p className="mb-2 text-xs font-medium text-gray-500">Data sources</p>
            {agent.sources.length === 0 ? (
              <p className="text-sm text-gray-400">No data sources connected</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {agent.sources.map((source) => (
                  <span
                    key={source}
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600"
                  >
                    {source}
                  </span>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 p-4">
            <p className="mb-2 text-xs font-medium text-gray-500">Details</p>
            <dl className="space-y-2 text-sm">
              <DetailRow label="Owner" value={agent.owner} />
              <DetailRow label="Updated" value={formatAgentRelativeTime(agent.updatedAt)} />
              <DetailRow label="Last run" value={formatAgentRelativeTime(agent.lastRunAt)} />
              <DetailRow label="Total runs" value={String(agent.runCount)} />
              <DetailRow label="Type" value={agent.workflowKind} />
            </dl>
          </section>
        </div>

        <div className="flex gap-3 border-t border-gray-100 p-5">
          <button
            type="button"
            onClick={onDelete}
            className="flex-1 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => onSave({ name, description })}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-800">{value}</dd>
    </div>
  )
}
