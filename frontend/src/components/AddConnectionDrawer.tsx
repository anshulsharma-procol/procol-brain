import { ArrowLeft, Bot, ChevronRight, Cloud, Database, FileText, Plug, Sparkles, X } from 'lucide-react'
import { useState } from 'react'
import type { ConnectionCategory, ConnectionType } from '../platform/types'

/**
 * "What would you like to connect?"
 *
 * Five types, chosen first, because what a company plugs in decides what is
 * asked for next — an agent needs a card URL, a database needs a read-only
 * connection string. The panel then says plainly what it is about to do:
 * discovery is the step that turns a URL into a set of capabilities the
 * agents can route against, and it is worth naming rather than hiding behind
 * a spinner.
 */
interface Props {
  types: ConnectionType[]
  busy: boolean
  error?: string
  onClose: () => void
  onSubmit: (input: {
    category: ConnectionCategory
    name: string
    endpoint?: string
  }) => Promise<void>
}

const ICONS: Record<ConnectionCategory, typeof Bot> = {
  agent: Bot,
  mcp: Plug,
  database: Database,
  saas: Cloud,
  knowledge: FileText,
}

const ACCENTS: Record<ConnectionType['accent'], { bg: string; fg: string }> = {
  violet: { bg: 'bg-violet-100', fg: 'text-violet-600' },
  blue: { bg: 'bg-blue-100', fg: 'text-blue-600' },
  green: { bg: 'bg-green-100', fg: 'text-green-600' },
  orange: { bg: 'bg-orange-100', fg: 'text-orange-600' },
  red: { bg: 'bg-red-100', fg: 'text-red-600' },
}

export default function AddConnectionDrawer({ types, busy, error, onClose, onSubmit }: Props) {
  const [chosen, setChosen] = useState<ConnectionType | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})

  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }))

  const canSubmit =
    chosen !== null &&
    chosen.fields
      .filter((field) => field.required)
      .every((field) => (values[field.key] ?? '').trim().length > 0)

  const submit = async () => {
    if (!chosen || !canSubmit) return
    await onSubmit({
      category: chosen.id,
      name: (values.name ?? '').trim(),
      endpoint: (values.endpoint ?? '').trim() || undefined,
    })
  }

  return (
    <aside
      className="flex h-full w-[380px] shrink-0 flex-col border-l border-gray-200 bg-white"
      aria-label="Add connection"
    >
      <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-6">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-gray-900">
            {chosen ? `Connect ${chosen.name}` : 'Add Connection'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {chosen ? chosen.description : 'What would you like to connect?'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-50 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        {!chosen ? (
          <ul className="space-y-2.5">
            {types.map((type) => {
              const Icon = ICONS[type.id]
              const accent = ACCENTS[type.accent]

              return (
                <li key={type.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(type)
                      setValues({})
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3.5 text-left transition-colors hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent.bg}`}
                    >
                      <Icon className={`h-5 w-5 ${accent.fg}`} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-gray-900">{type.name}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                        {type.description}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                  </button>
                </li>
              )
            })}

            <li className="pt-1.5">
              <div className="rounded-xl bg-violet-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                  <Sparkles className="h-4 w-4" />
                  Plug. Discover. Empower.
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-violet-900/80">
                  Connect your systems and let Procol Brain discover their capabilities
                  automatically.
                </p>
              </div>
            </li>
          </ul>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
            className="space-y-4"
          >
            <button
              type="button"
              onClick={() => setChosen(null)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <ArrowLeft className="h-4 w-4" />
              All types
            </button>

            {chosen.fields.map((field) => (
              <div key={field.key}>
                <label
                  htmlFor={`connect-${field.key}`}
                  className="block text-sm font-medium text-gray-700"
                >
                  {field.label}
                  {!field.required && <span className="ml-1 text-gray-400">optional</span>}
                </label>
                <input
                  id={`connect-${field.key}`}
                  type={field.secret ? 'password' : 'text'}
                  value={values[field.key] ?? ''}
                  onChange={(event) => set(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  autoComplete="off"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-violet-300 focus:outline-none"
                />
              </div>
            ))}

            <div className="rounded-xl bg-violet-50 p-3.5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-900">
                <Sparkles className="h-4 w-4" />
                What happens next
              </p>
              <p className="mt-1 text-xs leading-relaxed text-violet-900/80">
                {chosen.discovering}. Brain records the capabilities it finds and makes them
                available to any agent that declares a need for them.
              </p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={!canSubmit || busy}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Discovering capabilities…' : 'Connect and discover'}
            </button>
          </form>
        )}
      </div>

    </aside>
  )
}
