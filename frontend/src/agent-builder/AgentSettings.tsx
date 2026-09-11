import { ArrowLeft, ChevronDown, Pencil, Plus, Shield, ShieldAlert, Sparkles, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell'
import TopBar from '../components/TopBar'
import { CategoryChip } from './components/ConfigDrawer'
import Toggle from './components/Toggle'
import { loadAgentSkillsFromStorage, newSkillId, saveAgentSkillsToStorage } from './storage'
import type { Skill, SkillCategory } from './types'

type SettingsTab = 'pii' | 'guardrails' | 'skills'

const RAIL_ITEMS: { id: SettingsTab; label: string; icon: typeof Shield }[] = [
  { id: 'pii', label: 'PII & Data Protection', icon: Shield },
  { id: 'guardrails', label: 'Guardrails', icon: ShieldAlert },
  { id: 'skills', label: 'Skills', icon: Sparkles },
]

const PII_SEED = [
  { label: 'Email addresses', on: true },
  { label: 'Phone numbers', on: true },
  { label: 'Tax IDs / GSTIN / PAN', on: true },
  { label: 'Bank account numbers', on: true },
  { label: 'Vendor codes', on: true },
]

const GUARDRAILS_SEED = [
  { label: 'Block competitor names in responses', on: true },
  { label: 'Warn on commitments over $1M', on: true },
  { label: 'Block unredacted contracts', on: false },
  { label: 'Require human approval for vendor calls', on: true },
]

export default function AgentSettings() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<SettingsTab>('skills')
  const [pii, setPii] = useState(PII_SEED)
  const [guardrails, setGuardrails] = useState(GUARDRAILS_SEED)
  const [skills, setSkills] = useState<Skill[]>(() => loadAgentSkillsFromStorage())
  const [editingId, setEditingId] = useState<string | null>(null)

  function persistSkills(next: Skill[]) {
    setSkills(next)
    saveAgentSkillsToStorage(next)
  }

  function handleNewSkill() {
    const skill: Skill = {
      id: newSkillId(),
      name: 'New Skill',
      category: 'analysis',
      description: 'Describe what this skill does and when it should be used.',
    }
    persistSkills([skill, ...skills])
    setEditingId(skill.id)
  }

  function handleDeleteSkill(skillId: string) {
    if (!window.confirm('Delete this skill?')) return
    persistSkills(skills.filter((skill) => skill.id !== skillId))
  }

  function handleUpdateSkill(skillId: string, patch: Partial<Skill>) {
    persistSkills(skills.map((skill) => (skill.id === skillId ? { ...skill, ...patch } : skill)))
  }

  return (
    <PageShell tip="Guardrails keep agents safe; skills make them useful.">
      <TopBar />

      <div className="flex items-center gap-3 border-b border-gray-100 px-8 py-5">
        <button
          type="button"
          onClick={() => navigate('/agent-builder')}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <span className="h-5 w-px bg-gray-200" />
        <h1 className="text-lg font-bold text-gray-900">Settings</h1>
      </div>

      <div className="flex flex-1">
        <div className="w-60 shrink-0 border-r border-gray-100 p-4">
          {RAIL_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium ${
                activeTab === item.id ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1 px-8 py-6">
          {activeTab === 'pii' && (
            <div className="max-w-2xl">
              <p className="mb-4 text-sm text-gray-500">
                Control which sensitive data types agents automatically redact or flag before they leave the
                workspace.
              </p>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 px-4">
                {pii.map((row, index) => (
                  <Toggle
                    key={row.label}
                    label={row.label}
                    checked={row.on}
                    onChange={(next) =>
                      setPii((prev) => prev.map((item, i) => (i === index ? { ...item, on: next } : item)))
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'guardrails' && (
            <div className="max-w-2xl">
              <p className="mb-4 text-sm text-gray-500">
                Default guardrails applied across every agent and workflow block.
              </p>
              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 px-4">
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
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="max-w-3xl">
              <button
                type="button"
                onClick={handleNewSkill}
                className="mb-4 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-600 hover:border-gray-400 hover:text-gray-800"
              >
                <Plus className="h-4 w-4" />
                New skill
              </button>

              <div className="space-y-3">
                {skills.map((skill) =>
                  editingId === skill.id ? (
                    <SkillEditCard
                      key={skill.id}
                      skill={skill}
                      onCancel={() => setEditingId(null)}
                      onSave={(patch) => {
                        handleUpdateSkill(skill.id, patch)
                        setEditingId(null)
                      }}
                    />
                  ) : (
                    <div key={skill.id} className="flex items-start gap-3 rounded-xl border border-gray-200 p-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                        <Sparkles className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{skill.name}</p>
                          <CategoryChip category={skill.category} />
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{skill.description}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          aria-label="Expand"
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Edit skill"
                          onClick={() => setEditingId(skill.id)}
                          className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete skill"
                          onClick={() => handleDeleteSkill(skill.id)}
                          className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}

interface SkillEditCardProps {
  skill: Skill
  onSave: (patch: Partial<Skill>) => void
  onCancel: () => void
}

function SkillEditCard({ skill, onSave, onCancel }: SkillEditCardProps) {
  const [name, setName] = useState(skill.name)
  const [description, setDescription] = useState(skill.description)
  const [category, setCategory] = useState<SkillCategory>(skill.category)

  return (
    <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold focus:border-blue-300 focus:outline-none"
      />
      <textarea
        rows={2}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
      />
      <select
        value={category}
        onChange={(event) => setCategory(event.target.value as SkillCategory)}
        className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-300 focus:outline-none"
      >
        <option value="analysis">Analysis</option>
        <option value="validation">Validation</option>
      </select>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave({ name, description, category })}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    </div>
  )
}
