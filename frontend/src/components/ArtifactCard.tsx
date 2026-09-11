import { ExternalLink } from 'lucide-react'
import type { Artifact } from '../platform/types'
import { durationLabel } from '../utils/format'

/**
 * One produced artifact, summarised. Artifacts appear in the ticket's right
 * column as the run creates them — a pull request that has not been opened
 * yet is not on screen, because it does not exist yet.
 */
export default function ArtifactCard({ artifact }: { artifact: Artifact }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs font-semibold text-gray-900">{artifact.title}</p>
      <div className="mt-1 text-xs leading-relaxed text-gray-500">{summary(artifact)}</div>
    </div>
  )
}

function summary(artifact: Artifact) {
  switch (artifact.kind) {
    case 'ROOT_CAUSE':
      return artifact.data.headline

    case 'PR':
      return (
        <>
          <a
            href={artifact.data.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-blue-600 hover:underline"
          >
            {artifact.data.number}
            <ExternalLink className="h-3 w-3" />
          </a>
          <span className="ml-1.5 font-mono">{artifact.data.filesChanged[0]}</span>
          <span className="ml-1.5 text-green-600">+{artifact.data.additions}</span>
          <span className="ml-1 text-red-500">−{artifact.data.deletions}</span>
        </>
      )

    case 'TEST_RESULT':
      return (
        <>
          {artifact.data.passed} / {artifact.data.total} passed
          <span className="ml-1.5 font-mono text-gray-400">
            {durationLabel(artifact.data.durationMs)}
          </span>
        </>
      )

    case 'CONFIG_FIX':
      return artifact.data.summary

    case 'IMPACT':
      return `${artifact.data.affectedTenants} tenants · ${artifact.data.affectedRecords} ${artifact.data.recordLabel}`

    case 'CUSTOMER_REPLY':
      return artifact.data.sent ? `Sent — ${artifact.data.subject}` : `Drafted — ${artifact.data.subject}`

    case 'PROCESS_RESULT':
      return `${artifact.data.steps.length} steps completed`
  }
}
