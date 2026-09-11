import {
  ArrowLeft,
  Bell,
  CheckCircle,
  Code,
  ExternalLink,
  FileText,
  FlaskConical,
  GitPullRequest,
  Mail,
  PartyPopper,
  RotateCw,
  User,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
// Substitution note: lucide-react dropped brand/logo icons (no "Github"
// export), so GitHub-flavored buttons use GitPullRequest instead.
import Card from '../components/Card'
import PageShell from '../components/PageShell'
import StatusPill from '../components/StatusPill'
import TopBar from '../components/TopBar'
import { primaryTicket } from '../data/mockData'

const NEXT_STEPS = [
  { label: 'Close ticket', detail: 'Mark as resolved', icon: CheckCircle, color: 'text-green-600' },
  { label: 'Notify customer', detail: 'Send resolution update', icon: Mail, color: 'text-green-600' },
  { label: 'Log activity', detail: 'Update knowledge base', icon: FileText, color: 'text-green-600' },
]

export default function Resolution() {
  const { id } = useParams()
  const ticket = primaryTicket
  const [decision, setDecision] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const notFound = id !== undefined && id !== ticket.id

  if (notFound) {
    return (
      <PageShell tip="Automate. Investigate. Fix. Deliver.">
        <TopBar />
        <div className="px-8 py-16 text-center text-gray-500">Ticket #{id} not found in this demo.</div>
      </PageShell>
    )
  }

  return (
    <PageShell tip="Automate. Investigate. Fix. Deliver.">
      <TopBar
        trailing={
          <StatusPill
            label={
              decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : 'Ready for Approval'
            }
            tone={decision === 'rejected' ? 'danger' : 'success'}
            icon={<CheckCircle className="h-3.5 w-3.5" />}
          />
        }
      />

      <div className="px-8 pt-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to={`/tickets/${ticket.id}`} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <Link to="/" className="hover:underline">
            Tickets
          </Link>
          <span>/</span>
          <span className="text-gray-700">{ticket.number}</span>
        </div>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900">Resolution Ready</h1>
        <p className="mt-1 text-sm text-gray-500">
          The issue has been fixed and validated by QA. Review the details and approve to close the ticket.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 px-8 py-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-gray-900">{ticket.number}</span>
              <StatusPill label={`${ticket.priority} Priority`} tone="danger" />
            </div>
            <h2 className="mt-2 text-lg font-bold text-gray-900">{ticket.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4 text-gray-400" />
                {ticket.customer}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-gray-400" />
                {ticket.category}
              </span>
              <span className="flex items-center gap-1.5">
                <Bell className="h-4 w-4 text-gray-400" />
                Created {ticket.createdAt}
              </span>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <RotateCw className="h-4 w-4 text-blue-500" />
              Root Cause
            </h2>
            <div className="mt-3 rounded-lg bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">{ticket.rootCause.headline}</p>
              <p className="mt-1.5 text-sm text-gray-600">{ticket.rootCause.detail}</p>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Code className="h-4 w-4 text-blue-500" />
              Fix Implemented
            </h2>
            <div className="mt-3 rounded-lg bg-gray-50 p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-semibold text-blue-600">
                  PR {ticket.fix.prNumber}
                  <ExternalLink className="h-3.5 w-3.5" />
                </span>
                <StatusPill label="Merged" tone="success" withDot />
              </div>
              <p className="mt-2 text-sm font-medium text-gray-800">{ticket.fix.file}</p>
              <p className="mt-1 text-sm text-gray-600">{ticket.fix.description}</p>
              <button
                type="button"
                className="mt-3 flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <GitPullRequest className="h-4 w-4" />
                View Pull Request
              </button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <FlaskConical className="h-4 w-4 text-blue-500" />
              QA Result
            </h2>
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-green-50 p-4">
              <CheckCircle className="h-8 w-8 shrink-0 text-green-600" />
              <div>
                <p className="text-base font-bold text-green-700">
                  {ticket.testResults.passed}/{ticket.testResults.total} TESTS PASSED
                </p>
                <p className="text-sm text-green-700/80">All invoice regression tests passed successfully.</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-4 gap-3 text-center text-sm">
              <StatCell label="Test Suite" value={ticket.testResults.suite} />
              <StatCell label="Total Tests" value={ticket.testResults.total} />
              <StatCell label="Passed" value={ticket.testResults.passed} valueColor="text-green-600" />
              <StatCell label="Failed" value={ticket.testResults.failed} valueColor="text-red-500" />
            </div>
          </Card>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDecision('rejected')}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-red-500 px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
              Reject
            </button>
            <button
              type="button"
              onClick={() => setDecision('approved')}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4" />
              Approve Fix
            </button>
          </div>
          {decision !== 'pending' && (
            <p className={`text-sm font-medium ${decision === 'approved' ? 'text-green-600' : 'text-red-500'}`}>
              {decision === 'approved'
                ? 'Fix approved — customer will be notified and the ticket closed.'
                : 'Fix rejected — sent back to Dev Agent for another pass.'}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <FileText className="h-4 w-4 text-gray-500" />
              Ticket Timeline
            </h2>
            <ol className="mt-4">
              {ticket.timeline.map((step, index) => (
                <li key={step.label} className="relative flex gap-3 pb-6 last:pb-0">
                  {index < ticket.timeline.length - 1 && (
                    <span className="absolute left-[9px] top-5 h-full w-px bg-gray-200" />
                  )}
                  <span className="relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                    {step.state === 'current' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-semibold text-white">
                        {index + 1}
                      </span>
                    )}
                  </span>
                  <div className="flex flex-1 items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{step.label}</p>
                      <p className="text-xs text-gray-500">{step.detail}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">{step.time}</span>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <User className="h-4 w-4 text-gray-500" />
              Customer Impact
            </h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Customer</dt>
                <dd className="font-medium text-gray-900">{ticket.customer}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500">Impact</dt>
                <dd className="font-medium text-gray-900">{ticket.impact}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="shrink-0 text-gray-500">Reported by</dt>
                <dd className="text-right font-medium text-gray-900">{ticket.reportedBy}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-semibold text-gray-900">Next Steps (after approval)</h2>
            <ul className="mt-3 space-y-3">
              {NEXT_STEPS.map((step) => (
                <li key={step.label} className="flex items-start gap-3">
                  <step.icon className={`mt-0.5 h-4 w-4 shrink-0 ${step.color}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{step.label}</p>
                    <p className="text-xs text-gray-500">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex items-start gap-3 rounded-xl bg-green-50 p-4">
            <PartyPopper className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
            <div>
              <p className="text-sm font-semibold text-green-800">Ready to deliver value!</p>
              <p className="text-xs text-green-700">
                Approve the fix to resolve this ticket and notify the customer.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function StatCell({
  label,
  value,
  valueColor = 'text-gray-900',
}: {
  label: string
  value: string | number
  valueColor?: string
}) {
  return (
    <div>
      <p className={`text-base font-bold ${valueColor}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}
