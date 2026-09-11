import { ArrowLeft, Brain, MessageSquare, Play, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ArtifactCard from '../components/ArtifactCard'
import Card from '../components/Card'
import { MemoryMatchCard } from '../components/MemoryCard'
import PageShell from '../components/PageShell'
import StageRail from '../components/StageRail'
import StatusPill from '../components/StatusPill'
import TopBar from '../components/TopBar'
import TranscriptEntry from '../components/TranscriptEntry'
import { toExchanges } from '../utils/exchanges'
import { isDemoData } from '../platform/api'
import { useTicketDetail, useWorkspace } from '../platform/react'
import type { Tone } from '../types'
import { dateTimeOf, humaniseConstant } from '../utils/format'

const PRIORITY_TONE: Record<string, Tone> = {
  CRITICAL: 'danger',
  HIGH: 'danger',
  MEDIUM: 'warning',
  LOW: 'neutral',
}

const PATH_COPY: Record<string, string> = {
  CODE_FIX: 'Code fix — engineering and validation are involved',
  CONFIG_FIX: 'Configuration fix — engineering was not needed',
  ANSWER_ONLY: 'Answer only — no change to the product',
  PROCESS: 'Process run — executing a defined business process',
}

/**
 * The screen the product is judged on: the live agent transcript.
 *
 * Three columns — the issue, the transcript, what the run produced. The
 * transcript is built from the activity stream, so a browser refresh
 * mid-run rebuilds an identical timeline in an identical order.
 */
export default function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { workspace } = useWorkspace()
  const { detail, loading, error, startInvestigation } = useTicketDetail(id)

  if (loading && !detail) {
    return (
      <Shell>
        <p className="px-8 py-16 text-center text-sm text-gray-400">Loading {id}…</p>
      </Shell>
    )
  }

  if (error || !detail) {
    return (
      <Shell>
        <p className="px-8 py-16 text-center text-sm text-gray-500">
          {error ?? `Ticket ${id} is not in this control tower.`}{' '}
          <Link to="/" className="text-blue-600 hover:underline">
            Back to the board
          </Link>
        </p>
      </Shell>
    )
  }

  const { ticket, stages, activity, artifacts, memoryMatches } = detail
  const awaitingApproval = ticket.status === 'AWAITING_APPROVAL'
  // Status is the honest signal here. Counting timeline rows is not: Brain
  // writes its classification before a run starts, so a fresh ticket already
  // has a couple of entries on it.
  const notStarted = ticket.status === 'NEW' || ticket.status === 'NEEDS_HUMAN'

  return (
    <Shell>
      <div className="px-8 pt-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/" className="text-gray-400 hover:text-gray-600" aria-label="Back to the board">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Link to="/" className="hover:underline">
            {workspace.name}
          </Link>
          <span>/</span>
          <span className="font-mono text-gray-700">{ticket.reference}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">{ticket.title}</h1>
              <StatusPill
                label={`${humaniseConstant(ticket.priority)} priority`}
                tone={PRIORITY_TONE[ticket.priority] ?? 'neutral'}
              />
              <StatusPill
                label={humaniseConstant(ticket.status)}
                tone={awaitingApproval ? 'warning' : ticket.status === 'RESOLVED' ? 'success' : 'info'}
              />
            </div>
            <p className="mt-1.5 max-w-2xl text-sm text-gray-500">{ticket.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {notStarted ? (
              <button
                type="button"
                onClick={() => void startInvestigation()}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                <Play className="h-4 w-4" />
                {ticket.status === 'NEEDS_HUMAN' ? 'Try again' : 'Start investigation'}
              </button>
            ) : (
              // Rewinding a finished run is a scripted-data affordance. The
              // live API refuses to re-run a ticket that has already reached
              // the gate, which is the correct thing for it to do.
              isDemoData && (
                <button
                  type="button"
                  onClick={() => void startInvestigation()}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  title="Rewind and stream this run from the beginning"
                >
                  <Play className="h-4 w-4" />
                  Replay run
                </button>
              )
            )}
            {awaitingApproval && (
              <button
                type="button"
                onClick={() => navigate(`/tickets/${ticket.reference}/resolution`)}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              >
                Review and decide
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 py-6 lg:grid-cols-[20rem_1fr_18rem]">
        {/* -- the issue ---------------------------------------------------- */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-900">The issue</h2>
            <p className="mt-1 text-xs text-gray-500">
              {ticket.customer} · via {ticket.channel} · {dateTimeOf(ticket.createdAt)}
            </p>

            <blockquote className="mt-3 rounded-lg bg-gray-50 p-3 text-sm leading-relaxed text-gray-700">
              {ticket.issueQuote.map((line) => (
                <p key={line} className="mb-2 last:mb-0">
                  {line}
                </p>
              ))}
            </blockquote>

            <dl className="mt-4 space-y-2.5 text-sm">
              <Row label="Reported by" value={ticket.reportedBy ?? '—'} />
              <Row label="Category" value={ticket.category} />
              <Row label="Impact" value={ticket.impact} />
              {ticket.attachment && <Row label="Attachment" value={ticket.attachment} mono />}
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-900">Stage</h2>
            <div className="mt-3">
              <StageRail stages={stages} />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {stages.find((stage) => stage.status === 'active')?.label ??
                (ticket.status === 'RESOLVED' ? 'Closed' : 'Not started')}
            </p>
            {ticket.path && (
              <p className="mt-3 border-t border-gray-100 pt-3 text-xs leading-relaxed text-gray-500">
                <span className="font-mono text-[11px] text-gray-700">{ticket.path}</span>
                <span className="mt-1 block">{PATH_COPY[ticket.path]}</span>
              </p>
            )}
          </Card>
        </div>

        {/* -- the transcript ----------------------------------------------- */}
        <Card className="flex min-h-[28rem] flex-col p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <MessageSquare className="h-4 w-4 text-violet-500" />
              Live transcript
            </h2>
            {ticket.status === 'RUNNING' ? (
              <StatusPill label="Streaming" tone="info" withDot />
            ) : (
              <span className="font-mono text-[11px] text-gray-400">{activity.length} entries</span>
            )}
          </div>

          {activity.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
              <Brain className="h-8 w-8 text-gray-300" />
              <p className="max-w-xs text-sm text-gray-500">
                Nothing has run on this ticket yet. Start the investigation and every step the agents
                take will appear here.
              </p>
            </div>
          ) : (
            <Transcript activity={activity} />
          )}
        </Card>

        {/* -- what the run produced ---------------------------------------- */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="text-sm font-semibold text-gray-900">Artifacts</h2>
            {artifacts.length === 0 ? (
              <p className="mt-2 text-xs text-gray-400">Nothing produced yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {artifacts.map((artifact) => (
                  <ArtifactCard key={artifact.id} artifact={artifact} />
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Sparkles className="h-4 w-4 text-amber-500" />
              We have seen this before
            </h2>
            {memoryMatches.length === 0 ? (
              <p className="mt-2 text-xs text-gray-400">
                No prior run in this control tower matches these symptoms.
              </p>
            ) : (
              <>
                <p className="mt-1 text-xs text-gray-500">
                  Recalled from {workspace.name}&apos;s institutional memory before anyone was asked.
                </p>
                <div className="mt-3 space-y-2">
                  {memoryMatches.map((match) => (
                    <MemoryMatchCard key={match.entry.id} match={match} />
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </Shell>
  )
}

/**
 * Auto-scrolls to the newest entry, and stops the instant the reader scrolls
 * up. Yanking someone back to the bottom mid-sentence is the most annoying
 * bug this screen could have.
 */
function Transcript({ activity }: { activity: import('../platform/types').ActivityEvent[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pinned, setPinned] = useState(true)

  useEffect(() => {
    const node = scrollRef.current
    if (!node || !pinned) return
    node.scrollTop = node.scrollHeight
  }, [activity.length, pinned])

  return (
    <div className="relative mt-4 flex-1">
      <div
        ref={scrollRef}
        onScroll={(event) => {
          const node = event.currentTarget
          const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 48
          setPinned(atBottom)
        }}
        className="max-h-[32rem] overflow-y-auto pr-1"
      >
        <ol aria-live="polite" className="space-y-0">
          {toExchanges(activity).map((exchange) => (
            <TranscriptEntry key={exchange.id} exchange={exchange} />
          ))}
        </ol>
      </div>

      {!pinned && (
        <button
          type="button"
          onClick={() => setPinned(true)}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          Jump to latest
        </button>
      )}
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageShell tip="Every message, every tool call, every decision — on one record.">
      <TopBar />
      {children}
    </PageShell>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-50 pb-2 last:border-0 last:pb-0">
      <dt className="shrink-0 text-gray-500">{label}</dt>
      <dd className={`text-right font-medium text-gray-800 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  )
}
