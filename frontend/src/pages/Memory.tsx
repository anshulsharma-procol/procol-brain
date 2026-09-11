import { Brain, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import Card from '../components/Card'
import { MemoryRow } from '../components/MemoryCard'
import PageShell from '../components/PageShell'
import TopBar from '../components/TopBar'
import { useMemory, useWorkspace } from '../platform/react'

/**
 * Institutional memory.
 *
 * This is the screen that explains why a control tower is worth more in month
 * twelve than in month one. Every closed run leaves a durable answer behind,
 * and the next person — or agent — to meet the same symptom starts from it
 * instead of from the beginning. The saved hours are measured, not claimed:
 * each entry carries how long the original investigation took and how many
 * times that has been avoided since.
 */
export default function Memory() {
  const { workspace } = useWorkspace()
  const { data: entries = [], loading } = useMemory()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return entries
    return entries.filter((entry) =>
      `${entry.title} ${entry.symptom} ${entry.rootCause} ${entry.tags.join(' ')}`
        .toLowerCase()
        .includes(needle),
    )
  }, [entries, query])

  const totalHours = Math.round(
    entries.reduce((sum, entry) => sum + entry.reuseCount * entry.minutesSavedPerReuse, 0) / 60,
  )
  const totalReuses = entries.reduce((sum, entry) => sum + entry.reuseCount, 0)

  return (
    <PageShell tip="A support tool answers a ticket. A control tower remembers the answer.">
      <TopBar />

      <div className="px-8 pt-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Institutional memory</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          What {workspace.name} has learned from every run it has closed. Each entry was written
          automatically at the approval gate, and is matched against new tickets before anyone is
          asked to look at them.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 py-6 sm:grid-cols-3">
        <Stat label="Entries" value={entries.length} caption="Distinct resolutions remembered" />
        <Stat label="Reuses" value={totalReuses} caption="Tickets shortcut by a known answer" />
        <Stat label="Hours saved" value={totalHours} caption="Measured against the original runs" />
      </div>

      <div className="px-8 pb-8">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Brain className="h-4 w-4 text-violet-500" />
              What this control tower knows
            </h2>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <label htmlFor="memory-search" className="sr-only">
                Search memory
              </label>
              <input
                id="memory-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a symptom…"
                className="w-64 rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="px-6">
            {loading && entries.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">Loading memory…</p>
            ) : filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">
                {entries.length === 0
                  ? 'Nothing learned yet. Approve a resolution and it will be remembered here.'
                  : `Nothing matching “${query}”.`}
              </p>
            ) : (
              filtered.map((entry) => <MemoryRow key={entry.id} entry={entry} />)
            )}
          </div>
        </Card>
      </div>
    </PageShell>
  )
}

function Stat({ label, value, caption }: { label: string; value: number; caption: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{caption}</p>
    </Card>
  )
}
