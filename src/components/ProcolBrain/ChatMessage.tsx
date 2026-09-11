import type { BrainMessage } from '../../types/messages'
import styles from './ProcolBrain.module.css'
import { AgentActivityFeed } from './AgentActivityFeed'
import { InvestigationProgress } from './InvestigationProgress'
import { ResolutionDetails } from './ResolutionDetails'
import { SimilarIssueCard } from './SimilarIssueCard'
import { CheckIcon, SearchIcon } from './icons'

export interface ChatMessageProps {
  message: BrainMessage
}

/** Renders one entry of the transcript, whatever shape it takes. */
export function ChatMessage({ message }: ChatMessageProps) {
  switch (message.kind) {
    case 'text':
      return (
        <div
          className={`${styles.messageRow} ${
            message.author === 'user' ? styles.rowUser : styles.rowAssistant
          }`}
        >
          <div
            className={`${styles.bubble} ${
              message.author === 'user' ? styles.bubbleUser : styles.bubbleAssistant
            }`}
          >
            {message.text}
          </div>
        </div>
      )

    case 'status':
      return (
        <div
          className={`${styles.status} ${message.status === 'done' ? styles.statusDone : ''}`}
        >
          {message.status === 'running' && <span className={styles.spinner} aria-hidden="true" />}
          {message.status === 'done' && <CheckIcon width={13} height={13} />}
          {message.status === 'empty' && <SearchIcon width={13} height={13} />}
          {message.text}
        </div>
      )

    case 'similar-issue':
      return <SimilarIssueCard issue={message.issue} />

    case 'investigation':
      return (
        <InvestigationProgress
          ticketReference={message.ticket.reference}
          steps={message.steps}
        />
      )

    case 'agent-activity':
      return <AgentActivityFeed entries={message.entries} />

    case 'resolution':
      return <ResolutionDetails resolution={message.resolution} />

    case 'resolved':
      return (
        <section className={styles.resolvedCard} aria-label="Issue resolved">
          <div className={styles.resolvedTitle}>
            <CheckIcon width={14} height={14} />
            Issue resolved
          </div>
          <p className={styles.detail}>{message.headline}</p>
          <p className={styles.detail}>
            Ticket #{message.ticket.reference} marked as resolved.
          </p>
          <ul className={styles.checkList}>
            {message.checks.map((check) => (
              <li key={check} className={styles.checkItem}>
                <span className={`${styles.stepMarker} ${styles.markerComplete}`} aria-hidden="true">
                  <CheckIcon width={10} height={10} />
                </span>
                {check}
              </li>
            ))}
          </ul>
        </section>
      )

    default:
      return null
  }
}
