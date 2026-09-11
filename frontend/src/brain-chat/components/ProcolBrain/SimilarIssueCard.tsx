import { useState } from 'react'
import type { SimilarIssue } from '../../types/brain'
import styles from './ProcolBrain.module.css'

export interface SimilarIssueCardProps {
  issue: SimilarIssue
}

/** A previously resolved ticket that matches what the user just described. */
export function SimilarIssueCard({ issue }: SimilarIssueCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <article className={styles.card} aria-label={`Similar resolved issue ${issue.reference}`}>
      <div className={styles.cardTop}>
        <span className={styles.cardRef}>#{issue.reference}</span>
        <h3 className={styles.cardTitle}>{issue.title}</h3>
        {typeof issue.confidence === 'number' && (
          <span className={styles.cardBadge}>{Math.round(issue.confidence * 100)}% match</span>
        )}
      </div>

      <div className={styles.metaRow}>
        <span className={styles.metaLabel}>Customer</span>
        <span className={styles.metaValue}>{issue.customer}</span>
      </div>

      <div>
        <div className={styles.metaLabel}>Previous solution</div>
        <blockquote className={styles.quote}>{issue.solution}</blockquote>
      </div>

      {expanded && (
        <p className={styles.detail}>
          Resolved ticket #{issue.reference} for {issue.customer}. The same fix applies whenever
          tenant-level configuration is missing from the calculation context.
        </p>
      )}

      <div className={styles.cardFooter}>
        {issue.url ? (
          <a
            className={styles.linkButton}
            href={issue.url}
            target="_blank"
            rel="noreferrer noopener"
          >
            View solution
          </a>
        ) : (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? 'Hide solution' : 'View solution'}
          </button>
        )}
      </div>
    </article>
  )
}
