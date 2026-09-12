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
    return <>{artifact.data.rootCause}</>
  }

  if (isArtifact(artifact, 'PR')) {
    const { number, url, real, branch, filesChanged, state } = artifact.data
    const stat = artifact.data as { additions?: number; deletions?: number }

    return (
      <>
        {/* The contract's `real` flag is the whole point of this branch: a
            link that cannot be opened must not look like one that can. When
            the PR was not really opened the reader is shown the branch the
            patch is on, which is the thing that does exist. */}
        {real ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-blue-600 hover:underline"
          >
            #{number}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <>
            <span className="font-mono text-gray-600">#{number}</span>
            <span className="ml-1.5 text-gray-400">{state}</span>
            <span className="ml-1.5 font-mono text-gray-400">{branch}</span>
          </>
        )}
        {filesChanged?.[0] && <span className="ml-1.5 font-mono">{filesChanged[0]}</span>}
        {stat.additions !== undefined && (
          <span className="ml-1.5 text-green-600">+{stat.additions}</span>
        )}
        {stat.deletions !== undefined && (
          <span className="ml-1 text-red-500">−{stat.deletions}</span>
        )}
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

  if (isArtifact(artifact, 'CONFIG_FIX')) return <>{artifact.data.title}</>

  if (isArtifact(artifact, 'IMPACT')) {
    const { affectedTenants, affectedRecords } = artifact.data
    return (
      <>
        {affectedTenants} tenants · {affectedRecords} records
      </>
    )
  }

  if (isArtifact(artifact, 'CUSTOMER_REPLY')) {
    // `sentTo` is additive; without it the subject stands on its own.
    const to = (artifact.data as { sentTo?: string }).sentTo
    return (
      <>
        {artifact.data.subject}
        {to && <span className="ml-1.5 text-gray-400">→ {to}</span>}
      </>
    )
  }

  if (isArtifact(artifact, 'PROCESS_RESULT')) {
    const { completed, pending } = artifact.data
    return (
      <>
        {completed.length} steps completed
        {pending.length > 0 && <span className="ml-1.5 text-amber-600">{pending.length} pending</span>}
      </>
    )
  }

  return null
}
