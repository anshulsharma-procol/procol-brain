import type { InvestigationStepStatus, Resolution } from '../../types/brain'
import styles from './ProcolBrain.module.css'
import local from './ResolutionDetails.module.css'
import { CheckIcon, CloseIcon } from './icons'

export interface ResolutionDetailsProps {
  resolution: Resolution
}

/**
 * The full outcome of an agent investigation: what broke, the pull request the
 * Dev Agent opened, the QA Agent's test run, and where approval stands.
 *
 * This card is customer-facing, so it is deliberately read-only. Approving or
 * rejecting a fix is a privileged action that belongs in the internal console -
 * rendering those buttons here would offer the customer something the Brain API
 * will refuse anyway.
 */
export const ResolutionDetails = ({ resolution }: ResolutionDetailsProps) => {
  const { pr, tests } = resolution
  const filesChanged = resolution.filesChanged ?? []
  const hasFix = Boolean(pr) || filesChanged.length > 0
  // A partial run is a failure the customer must see, not a rounding detail.
  const testsFailed = tests ? Math.max(0, tests.total - tests.passed) : 0

  return (
    <section className={styles.card} aria-label="Proposed resolution">
      <div className={styles.cardTop}>
        <h3 className={styles.cardTitle}>Resolution</h3>
      </div>

      <ul className={styles.checkList}>
        {resolution.checks.map((check) => (
          <li
            key={check.label}
            className={`${styles.checkItem} ${
              check.status === 'pending' ? styles.checkItemPending : ''
            }`}
          >
            <span
              className={`${styles.stepMarker} ${markerClass(check.status)}`}
              aria-hidden="true"
            >
              {check.status === 'complete' ? <CheckIcon width={10} height={10} /> : null}
            </span>
            <span>
              {check.label}
              <span className={styles.srOnly}> - {statusLabel(check.status)}</span>
            </span>
          </li>
        ))}
      </ul>

      {resolution.rootCause && (
        <div className={local.section}>
          <div className={local.sectionLabel}>Root cause</div>
          <blockquote className={styles.quote}>{resolution.rootCause}</blockquote>
        </div>
      )}

      {hasFix && (
        <div className={local.section}>
          <div className={local.sectionLabel}>The fix</div>

          {pr && (
            <div className={local.prRow}>
              {/* Rendered as a link only when there is somewhere to go and the
                  pull request was really opened. A missing url means it lives
                  behind a system the customer cannot reach; `real: false`
                  means it does not exist to reach. Either way, a dead link is
                  worse than plain text. */}
              {pr.url && pr.real !== false ? (
                <a
                  className={local.prLink}
                  href={pr.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  PR #{pr.number}
                </a>
              ) : (
                <span className={local.prNumber}>PR #{pr.number}</span>
              )}
              <span className={local.prStatus}>
                {pr.real === false ? 'prepared' : pr.status}
              </span>
            </div>
          )}

          {pr?.title && <p className={local.prTitle}>{pr.title}</p>}

          {filesChanged.length > 0 && (
            <ul className={local.fileList} aria-label="Files changed">
              {filesChanged.map((file) => (
                <li key={file} className={local.fileChip}>
                  {file}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tests && (
        <div className={local.section}>
          <div className={local.sectionLabel}>QA result</div>
          <span
            className={`${local.qaBadge} ${
              testsFailed > 0 ? local.qaBadgeFail : local.qaBadgePass
            }`}
          >
            {testsFailed > 0 ? (
              <CloseIcon width={12} height={12} />
            ) : (
              <CheckIcon width={12} height={12} />
            )}
            <strong className={local.qaCount}>
              {testsFailed > 0 ? testsFailed : tests.passed} / {tests.total}
            </strong>
            {testsFailed > 0 ? ' tests failed' : ' tests passed'}
          </span>
        </div>
      )}

      {/* Nothing to approve when Clara resolved it from configuration. */}
      {(hasFix || resolution.approved) && (
      <div className={`${local.approval} ${resolution.approved ? local.approvalDone : ''}`}>
        <span
          className={`${styles.stepMarker} ${
            resolution.approved ? styles.markerComplete : styles.markerActive
          }`}
          aria-hidden="true"
        >
          {resolution.approved ? <CheckIcon width={10} height={10} /> : null}
        </span>
        {approvalLabel(resolution)}
      </div>
      )}

      <p className={styles.detail}>{resolution.summary}</p>
    </section>
  )
}

function markerClass(status: InvestigationStepStatus): string {
  if (status === 'complete') return styles.markerComplete as string
  if (status === 'active') return styles.markerActive as string
  return styles.markerPending as string
}

function statusLabel(status: InvestigationStepStatus): string {
  if (status === 'complete') return 'completed'
  if (status === 'active') return 'in progress'
  return 'pending'
}

/** The approver's name is only meaningful once someone has actually signed off. */
function approvalLabel({ approved, approver }: Resolution): string {
  if (!approved) return 'Waiting for manager approval'
  return approver ? `Approved by ${approver}` : 'Approved'
}
