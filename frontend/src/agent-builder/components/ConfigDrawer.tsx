import type { ReactNode } from 'react'
import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { NODE_KIND_META } from '../nodeKinds'
import type { AgentNode, Skill } from '../types'
import Toggle from './Toggle'

type SectionId = 'general' | 'model' | 'sources' | 'guardrails' | 'tools' | 'connectors' | 'skills'

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'model', label: 'Model' },
  { id: 'sources', label: 'Data Sources' },
  { id: 'guardrails', label: 'Guardrails' },
  { id: 'tools', label: 'Tools' },
  { id: 'connectors', label: 'Connectors' },
  { id: 'skills', label: 'Skills' },
]

const DEMO_DATA_SOURCES = ['QCS bid data', 'Vendor master', 'Material master']

const GUARDRAILS_SEED = [
  { label: 'Block competitor names in responses', hint: '', on: true },
  { label: 'Warn on commitments over $1M', hint: '', on: true },
  { label: 'Block unredacted contracts', hint: '', on: false },
  { label: 'Require human approval for vendor calls', hint: '', on: true },
]

const TOOLS_SEED = [
  { label: 'Calculator', hint: 'Arithmetic and bid math', on: true },
  { label: 'Web Search', hint: 'Live web lookup', on: false },
  { label: 'WhatsApp', hint: 'Outbound vendor messages', on: false },
  { label: 'Document QA', hint: 'Read PDFs and contracts', on: true },
]

const MODEL_OPTIONS = [
  'Anthropic · claude-sonnet-4.5',
  'OpenAI · gpt-4o',
  'OpenAI · gpt-4o-mini',
  'Google · gemini-1.5-pro',
]

const TRIGGER_TYPES = ['Chat message', 'Schedule', 'Webhook', 'Event']

interface ConfigDrawerProps {
  node: AgentNode
  onClose: () => void
  onUpdateNode: (patch: Partial<AgentNode>) => void
  onDeleteNode: () => void
  skills: Skill[]
}

// Guardrail/tool toggle state and the static data-source chips are demo-only
// (not persisted per node) — the reference implementation left these
// unbound too. Skills ARE persisted on the node, per the rebuild spec.
export default function ConfigDrawer({ node, onClose, onUpdateNode, onDeleteNode, skills }: ConfigDrawerProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('general')
  const [guardrails, setGuardrails] = useState(GUARDRAILS_SEED)
  const [tools, setTools] = useState(TOOLS_SEED)

  const meta = NODE_KIND_META[node.kind]
  const Icon = meta.icon
  const skillIds = node.skillIds ?? []

  function toggleSkill(skillId: string) {
    const next = skillIds.includes(skillId)
      ? skillIds.filter((id) => id !== skillId)
      : [...skillIds, skillId]
    onUpdateNode({ skillIds: next })
  }

  return (
    <div className="flex h-full w-[420px] shrink-0 flex-col border-l border-gray-200 bg-white">
      <div className="flex items-start gap-3 border-b border-gray-100 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${meta.tintBg} ${meta.tintText}`}>
          <Icon className="h-5 w-5" strokeWidth={1.6} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">{node.title}</p>
          <p className="text-xs text-gray-500">{meta.label} block · configuration</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close configuration"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="w-[124px] shrink-0 border-r border-gray-100 py-2">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`block w-full px-3 py-2 text-left text-xs font-medium ${
                activeSection === section.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {activeSection === 'general' && (
            <div className="space-y-4">
              <Field label="Block name">
                <input
                  type="text"
                  value={node.title}
                  onChange={(event) => onUpdateNode({ title: event.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
                />
              </Field>
              <Field label="Description">
                <textarea
                  rows={2}
                  value={node.subtitle}
                  onChange={(event) => onUpdateNode({ subtitle: event.target.value })}
                  className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
                />
              </Field>
              {node.kind === 'trigger' && (
                <Field label="Trigger type">
                  <select
                    value={node.triggerType ?? TRIGGER_TYPES[0]}
                    onChange={(event) => onUpdateNode({ triggerType: event.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
                  >
                    {TRIGGER_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {node.kind !== 'trigger' && (
                <button
                  type="button"
                  onClick={onDeleteNode}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete block
                </button>
              )}
            </div>
          )}

          {activeSection === 'model' && (
            <div className="space-y-4">
              {node.kind !== 'agent' ? (
                <p className="text-sm text-gray-400">Model configuration is only available on Agent blocks.</p>
              ) : (
                <>
                  <Field label="Provider · Model">
                    <select
                      value={node.model ?? MODEL_OPTIONS[0]}
                      onChange={(event) => onUpdateNode({ model: event.target.value })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
                    >
                      {MODEL_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Temperature">
                    <input
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={node.temperature ?? 0.7}
                      onChange={(event) => onUpdateNode({ temperature: Number(event.target.value) })}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
                    />
                  </Field>
                  <Field label="Instructions">
                    <textarea
                      rows={6}
                      value={node.instructions ?? ''}
                      onChange={(event) => onUpdateNode({ instructions: event.target.value })}
                      placeholder="You are a procurement analyst agent..."
                      className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
                    />
                  </Field>
                </>
              )}
            </div>
          )}

          {activeSection === 'sources' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {DEMO_DATA_SOURCES.map((source) => (
                  <span
                    key={source}
                    className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600"
                  >
                    {source}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add data source
              </button>
            </div>
          )}

          {activeSection === 'guardrails' && (
            <div className="divide-y divide-gray-100">
              {guardrails.map((row, index) => (
                <Toggle
                  key={row.label}
                  label={row.label}
                  checked={row.on}
                  onChange={(next) =>
                    setGuardrails((prev) => prev.map((item, i) => (i === index ? { ...item, on: next } : item)))
                  }
                />
              ))}
            </div>
          )}

          {activeSection === 'tools' && (
            <div className="divide-y divide-gray-100">
              {tools.map((row, index) => (
                <Toggle
                  key={row.label}
                  label={row.label}
                  hint={row.hint}
                  checked={row.on}
                  onChange={(next) =>
                    setTools((prev) => prev.map((item, i) => (i === index ? { ...item, on: next } : item)))
                  }
                />
              ))}
            </div>
          )}

          {activeSection === 'connectors' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Map upstream variables into this block's inputs.</p>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add connector mapping
              </button>
            </div>
          )}

          {activeSection === 'skills' && (
            <div>
              {skills.length === 0 ? (
                <p className="text-xs text-gray-400">No skills defined yet — create them in Settings → Skills.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {skills.map((skill) => (
                    <div key={skill.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-gray-800">{skill.name}</p>
                          <CategoryChip category={skill.category} />
                        </div>
                      </div>
                      <Toggle checked={skillIds.includes(skill.id)} onChange={() => toggleSkill(skill.id)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-gray-500">{label}</span>
      {children}
    </label>
  )
}

export function CategoryChip({ category }: { category: Skill['category'] }) {
  const isValidation = category === 'validation'
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
        isValidation ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
      }`}
    >
      {isValidation ? 'Validation' : 'Analysis'}
    </span>
  )
}
