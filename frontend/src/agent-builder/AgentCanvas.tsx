import { ArrowLeft, Save } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageShell from '../components/PageShell'
import AddNodePopover from './components/AddNodePopover'
import ConfigDrawer from './components/ConfigDrawer'
import NodeCard from './components/NodeCard'
import {
  createEmptyAgentDraft,
  loadAgentSkillsFromStorage,
  loadAgentsFromStorage,
  newNodeId,
  saveAgentsToStorage,
} from './storage'
import { NODE_KIND_META } from './nodeKinds'
import type { AgentNode, AgentRecord, NodeKind } from './types'

function loadInitialDraft(agentId: string | undefined): AgentRecord {
  if (!agentId) return createEmptyAgentDraft()
  const existing = loadAgentsFromStorage().find((agent) => agent.id === agentId)
  return existing ?? createEmptyAgentDraft()
}

export default function AgentCanvas() {
  const { agentId } = useParams()
  const navigate = useNavigate()

  const [draft, setDraft] = useState<AgentRecord>(() => loadInitialDraft(agentId))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const skills = useMemo(() => loadAgentSkillsFromStorage(), [])

  const selectedNode = draft.nodes.find((node) => node.id === selectedId) ?? null
  const lastNode = draft.nodes[draft.nodes.length - 1]
  const canAddNode = !lastNode || lastNode.kind !== 'end'

  function patchNode(nodeId: string, patch: Partial<AgentNode>) {
    setDraft((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node)),
    }))
  }

  function addNode(kind: NodeKind) {
    const meta = NODE_KIND_META[kind]
    const node: AgentNode = {
      id: newNodeId(kind),
      kind,
      title: meta.defaultTitle,
      subtitle: meta.defaultSubtitle,
    }
    setDraft((prev) => ({ ...prev, nodes: [...prev.nodes, node] }))
    setSelectedId(node.id)
    setPopoverOpen(false)
  }

  function deleteNode(nodeId: string) {
    setDraft((prev) => ({ ...prev, nodes: prev.nodes.filter((node) => node.id !== nodeId) }))
    setSelectedId(null)
  }

  function persist(status?: AgentRecord['status']) {
    if (!draft.name.trim()) return false
    const agentNodes = draft.nodes.filter((node) => node.kind === 'agent')
    const description = agentNodes[0]?.instructions?.trim() || draft.description
    const record: AgentRecord = {
      ...draft,
      description,
      status: status ?? draft.status,
      agentCount: Math.max(agentNodes.length, 1),
      workflowKind: draft.nodes.length > 1 ? 'Workflow' : 'Agent',
      updatedAt: new Date().toISOString(),
    }
    const all = loadAgentsFromStorage()
    const exists = all.some((agent) => agent.id === record.id)
    const next = exists ? all.map((agent) => (agent.id === record.id ? record : agent)) : [record, ...all]
    saveAgentsToStorage(next)
    return true
  }

  function handleBack() {
    if (draft.name.trim()) persist()
    navigate('/agent-builder')
  }

  function handlePublish() {
    if (!persist('Live')) return
    navigate('/agent-builder')
  }

  return (
    <PageShell tip="A workflow is just a chain of blocks the AI hands off between.">
      <div className="flex h-screen flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-6">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <span className="h-5 w-px bg-gray-200" />
        <input
          type="text"
          value={draft.name}
          onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
          placeholder="Untitled workflow"
          className="min-w-0 flex-1 rounded-lg border border-transparent px-2 py-1.5 text-sm font-semibold text-gray-900 hover:border-gray-200 focus:border-blue-300 focus:outline-none"
        />
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-500">
          <Save className="h-3 w-3" />
          {draft.status === 'Live' ? 'Published' : 'Saved · draft'}
        </span>
        <button
          type="button"
          onClick={handlePublish}
          disabled={draft.status === 'Live'}
          className="shrink-0 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-default disabled:bg-green-600 disabled:hover:bg-green-600"
        >
          {draft.status === 'Live' ? 'Published' : 'Publish'}
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          data-canvas-bg
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedId(null)
              setPopoverOpen(false)
            }
          }}
          className="flex-1 overflow-y-auto bg-gray-50 px-6 py-10"
        >
          <div className="mx-auto flex w-fit flex-col items-center">
            {draft.nodes.map((node, index) => (
              <div key={node.id} className="flex flex-col items-center">
                <NodeCard node={node} selected={node.id === selectedId} onSelect={() => setSelectedId(node.id)} />
                {index < draft.nodes.length - 1 && <span className="h-10 w-px bg-gray-200" />}
              </div>
            ))}

            {canAddNode && (
              <>
                <span className="h-5 w-px bg-gray-200" />
                <AddNodePopover open={popoverOpen} onToggle={() => setPopoverOpen((open) => !open)} onAdd={addNode} />
              </>
            )}
          </div>
        </div>

        {selectedNode && (
          <ConfigDrawer
            key={selectedNode.id}
            node={selectedNode}
            skills={skills}
            onClose={() => setSelectedId(null)}
            onUpdateNode={(patch) => patchNode(selectedNode.id, patch)}
            onDeleteNode={() => deleteNode(selectedNode.id)}
          />
        )}
      </div>
      </div>
    </PageShell>
  )
}
