import { ExternalLink } from 'lucide-react'
import type { Artifact } from '../platform/types'
import { isArtifact } from '../platform/types'
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
      <div className="mt-1 text-xs leading-relaxed text-gray-500">
        <Summary artifact={artifact} />
      </div>
    </div>
  )
}

function Summary({ artifact }: { artifact: Artifact }) {
  if (isArtifact(artifact, 'ROOT_CAUSE')) {
    return <>{artifact.data.summary}</>
  }

  if (isArtifact(artifact, 'PR')) {
    const { number, url, files, additions, deletions, state } = artifact.data
    return (
      <>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-mono text-blue-600 hover:underline"
        >
          #{number}
          <ExternalLink className="h-3 w-3" />
        </a>
        {/* 'mock' is the contract's own word for a pull request that was not
            really opened. Saying so is better than implying a merge. */}
        {state === 'mock' && <span className="ml-1.5 text-gray-400">mock</span>}
        <span className="ml-1.5 font-mono">{files[0]}</span>
        <span className="ml-1.5 text-green-600">+{additions}</span>
        <span className="ml-1 text-red-500">−{deletions}</span>
      </>
    )
  }

  if (isArtifact(artifact, 'TEST_RESULT')) {
    const { passed, total, durationMs } = artifact.data
    return (
      <>
        {passed} / {total} passed
        <span className="ml-1.5 font-mono text-gray-400">{durationLabel(durationMs)}</span>
      </>
    )
  }

  if (isArtifact(artifact, 'CONFIG_FIX')) return <>{artifact.data.summary}</>

  if (isArtifact(artifact, 'IMPACT')) {
    const { affectedTenants, affectedRecords } = artifact.data
    return (
      <>
        {affectedTenants} tenants · {affectedRecords} records
      </>
    )
  }

  if (isArtifact(artifact, 'CUSTOMER_REPLY')) {
    return (
      <>
        {artifact.data.subject}
        <span className="ml-1.5 text-gray-400">→ {artifact.data.sentTo}</span>
      </>
    )
  }

  if (isArtifact(artifact, 'PROCESS_RESULT')) {
    return <>{artifact.data.stepsCompleted.length} steps completed</>
  }

  return null
}
