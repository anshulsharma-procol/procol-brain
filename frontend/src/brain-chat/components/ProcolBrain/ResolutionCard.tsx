import type { Resolution } from '../../types/brain'
import styles from './ProcolBrain.module.css'
import { CheckIcon } from './icons'

export interface ResolutionCardProps {
  resolution: Resolution
}

/** Outcome of an agent investigation, ready for human approval. */
export function ResolutionCard({ resolution }: ResolutionCardProps) {
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
              className={`${styles.stepMarker} ${
                check.status === 'complete'
                  ? styles.markerComplete
                  : check.status === 'active'
                    ? styles.markerActive
                    : styles.markerPending
              }`}
              aria-hidden="true"
            >
              {check.status === 'complete' ? <CheckIcon width={10} height={10} /> : null}
            </span>
            {check.label}
          </li>
        ))}
      </ul>

      {resolution.rootCause && (
        <div>
          <div className={styles.metaLabel}>Root cause</div>
          <blockquote className={styles.quote}>{resolution.rootCause}</blockquote>
        </div>
      )}

      {resolution.tests && (
        <span className={styles.testBadge}>
          <CheckIcon width={12} height={12} />
          {resolution.tests.passed} / {resolution.tests.total} tests passed
        </span>
      )}

      <p className={styles.detail}>{resolution.summary}</p>
    </section>
  )
}
