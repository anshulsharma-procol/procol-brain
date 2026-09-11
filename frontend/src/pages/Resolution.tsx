import { ArrowLeft, CheckCircle, ExternalLink, Mail, ShieldCheck, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Card from '../components/Card'
import DiffView from '../components/DiffView'
import PageShell from '../components/PageShell'
import StatusPill from '../components/StatusPill'
import TopBar from '../components/TopBar'
import { useTicketDetail, useWorkspace } from '../platform/react'
import type {
  ConfigFixArtifact,
  CustomerReplyArtifact,
  ImpactArtifact,
  PrArtifact,
  RootCauseArtifact,
  TestResultArtifact,
  TicketDetail,
} from '../platform/types'
import { durationLabel } from '../utils/format'

const APPROVER = 'Anshul Sharma'

/**
 * The decision. Everything a person needs to say yes or no, in the order they
 * need it: what broke, what changed, whether it is proven, who else it
 * touches, and the policy that stopped the run here.
 */
export default function Resolution() {
  const { id } = useParams<{ id: string }>()
  const { workspace } = useWorkspace()
  const { detail, loading, error, decide } = useTicketDetail(id)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

  const { ticket, artifacts, approvalPolicy, decision } = detail
  const find = <T extends { kind: string }>(kind: T['kind']) =>
    artifacts.find((artifact) => artifact.kind === kind)

  const rootCause = find<RootCauseArtifact>('ROOT_CAUSE') as RootCauseArtifact | undefined
  const pr = find<PrArtifact>('PR') as PrArtifact | undefined
  const tests = find<TestResultArtifact>('TEST_RESULT') as TestResultArtifact | undefined
  const impact = find<ImpactArtifact>('IMPACT') as ImpactArtifact | undefined
  const configFix = find<ConfigFixArtifact>('CONFIG_FIX') as ConfigFixArtifact | undefined
  const reply = find<CustomerReplyArtifact>('CUSTOMER_REPLY') as CustomerReplyArtifact | undefined

  const submit = async (outcome: 'APPROVED' | 'REJECTED') => {
    setSubmitting(true)
    try {
      await decide(outcome, APPROVER, note.trim() || undefined)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Shell decision={decision}>
      <div className="px-8 pt-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link
            to={`/tickets/${ticket.reference}`}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Back to the ticket"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Link to={`/tickets/${ticket.reference}`} className="hover:underline">
            {ticket.title}
          </Link>
          <span>/</span>
          <span className="font-mono text-gray-700">{ticket.reference}</span>
        </div>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
          {decision ? (decision.outcome === 'APPROVED' ? 'Fix approved' : 'Sent back for a human') : 'Resolution ready'}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          {decision
            ? decision.outcome === 'APPROVED'
              ? `${decision.by} approved this. The customer has been notified and what the run learned is now part of ${workspace.name}'s institutional memory.`
              : `${decision.by} rejected the proposed fix. The ticket is now waiting on a person.`
            : 'The agents have finished. Review what they produced and decide — nothing ships until you do.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 py-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          {rootCause && (
            <Card className="p-6">
              <p className="text-xs uppercase tracking-wide text-gray-400">Root cause</p>
              <p className="mt-2 text-lg font-semibold leading-snug text-gray-900">
                {rootCause.data.headline}
              </p>
              <p className="mt-2 max-w-[70ch] text-sm leading-relaxed text-gray-600">
                {rootCause.data.detail}
              </p>
              {rootCause.data.evidence && (
                <ul className="mt-3 space-y-1">
                  {rootCause.data.evidence.map((line) => (
                    <li key={line} className="font-mono text-[11px] text-gray-500">
                      <span className="mr-1.5 text-gray-300">›</span>
                      {line}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {pr && (
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-500">
                  The fix ·{' '}
                  <a
                    href={pr.data.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-blue-600 hover:underline"
                  >
                    {pr.data.number}
                    <ExternalLink className="h-3 w-3" />
                  </a>{' '}
                  · <span className="font-mono">{pr.data.filesChanged.join(', ')}</span>
                </p>
                <StatusPill
                  label={pr.data.state === 'merged' ? 'Merged' : 'Open'}
                  tone={pr.data.state === 'merged' ? 'success' : 'info'}
                />
              </div>
              <p className="mt-1 text-sm font-medium text-gray-900">{pr.data.title}</p>
              <div className="mt-3">
                <DiffView diff={pr.data.diff} />
              </div>
            </Card>
          )}

          {configFix && (
            <Card className="p-6">
              <p className="text-xs uppercase tracking-wide text-gray-400">The change</p>
              <p className="mt-2 text-base font-semibold text-gray-900">{configFix.data.summary}</p>
              <p className="mt-1 font-mono text-xs text-gray-600">{configFix.data.change}</p>
              <ol className="mt-3 space-y-1.5">
                {configFix.data.steps.map((step, index) => (
                  <li key={step} className="flex gap-2 text-sm text-gray-600">
                    <span className="font-mono text-xs text-gray-400">{index + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-3 border-t border-gray-100 pt-3 text-sm text-gray-500">
                No code change was needed. Brain reached this without waking the engineering or
                validation agents.
              </p>
            </Card>
          )}

          {tests && (
            <Card className="border-l-4 border-l-green-600 p-6">
              <p className="text-xs uppercase tracking-wide text-gray-400">Validation</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <p className="text-2xl font-bold text-gray-900">
                  {tests.data.passed} / {tests.data.total} tests passed
                </p>
                <span className="font-mono text-sm text-gray-400">
                  {durationLabel(tests.data.durationMs)}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">{tests.data.suite}</p>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {tests.data.cases.map((testCase) => (
                  <li key={testCase} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    {testCase}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {impact && (
            <Card className="p-6">
              <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-400">
                <TrendingUp className="h-3.5 w-3.5" />
                Blast radius
              </p>
              <div className="mt-2 flex flex-wrap items-baseline gap-8">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{impact.data.affectedTenants}</p>
                  <p className="text-sm text-gray-500">tenants affected</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{impact.data.affectedRecords}</p>
                  <p className="text-sm text-gray-500">{impact.data.recordLabel}</p>
                </div>
                <p className="text-sm text-gray-400">since {impact.data.firstSeen}</p>
              </div>
              <p className="mt-3 max-w-[70ch] text-sm text-gray-600">
                This customer reported it. The other {impact.data.affectedTenants - 1} would have
                found out on their own.
              </p>
            </Card>
          )}

          {reply && (
            <Card className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-400">
                  <Mail className="h-3.5 w-3.5" />
                  Customer reply
                </p>
                <StatusPill
                  label={reply.data.sent ? 'Sent' : 'Drafted — sends on approval'}
                  tone={reply.data.sent ? 'success' : 'neutral'}
                />
              </div>
              <p className="mt-2 font-medium text-gray-900">{reply.data.subject}</p>
              <div className="mt-2 space-y-2 text-sm leading-relaxed text-gray-600">
                {reply.data.body.map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <p className="text-gray-500">{reply.data.signature}</p>
              </div>
            </Card>
          )}
        </div>

        {/* -- the decision -------------------------------------------------- */}
        <div>
          <Card className="sticky top-6 p-6 shadow-lg">
            <h2 className="text-base font-semibold text-gray-900">
              {decision ? 'Decision recorded' : 'Your decision'}
            </h2>

            {approvalPolicy && (
              <div className="mt-3 flex gap-2 rounded-lg bg-gray-50 p-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                <div>
                  <p className="text-sm leading-relaxed text-gray-700">{approvalPolicy.reason}</p>
                  <p className="mt-1 font-mono text-[11px] text-gray-400">
                    policy {approvalPolicy.id} · {approvalPolicy.risk} risk
                  </p>
                </div>
              </div>
            )}

            {decision ? (
              <div className="mt-4">
                <StatusPill
                  label={decision.outcome === 'APPROVED' ? 'Fix approved' : 'Rejected'}
                  tone={decision.outcome === 'APPROVED' ? 'success' : 'danger'}
                  icon={<CheckCircle className="h-3.5 w-3.5" />}
                />
                <p className="mt-3 text-sm text-gray-600">
                  {decision.by} · {new Date(decision.at).toLocaleString('en-GB')}
                </p>
                {decision.note && (
                  <p className="mt-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-600">
                    {decision.note}
                  </p>
                )}
                <Link
                  to={`/tickets/${ticket.reference}`}
                  className="mt-4 inline-block text-sm font-medium text-blue-600 hover:underline"
                >
                  See it on the timeline →
                </Link>
              </div>
            ) : (
              <>
                <label htmlFor="decision-note" className="mt-4 block text-sm text-gray-500">
                  Note (optional)
                </label>
                <textarea
                  id="decision-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Anything the record should carry."
                  className="mt-1 w-full resize-none rounded-lg border border-gray-200 p-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-violet-300 focus:outline-none"
                />

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void submit('REJECTED')}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-60"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void submit('APPROVED')}
                    className="flex-1 rounded-lg bg-violet-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-60"
                  >
                    {submitting ? 'Approving…' : 'Approve fix'}
                  </button>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-gray-400">
                  Approving sends the drafted reply, closes the ticket, and writes what this run
                  learned into {workspace.name}&apos;s institutional memory.
                </p>
              </>
            )}
          </Card>
        </div>
      </div>
    </Shell>
  )
}

function Shell({
  children,
  decision,
}: {
  children: React.ReactNode
  decision?: TicketDetail['decision']
}) {
  return (
    <PageShell tip="Nothing ships without a person, and the rule that stopped it is on screen.">
      <TopBar
        trailing={
          <StatusPill
            label={
              decision
                ? decision.outcome === 'APPROVED'
                  ? 'Approved'
                  : 'Rejected'
                : 'Waiting for your approval'
            }
            tone={decision?.outcome === 'REJECTED' ? 'danger' : decision ? 'success' : 'warning'}
          />
        }
      />
      {children}
    </PageShell>
  )
}
