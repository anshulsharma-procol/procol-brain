import type { InvestigationStep } from '../../types/brain'
import styles from './ProcolBrain.module.css'
import { CheckIcon } from './icons'

export interface InvestigationProgressProps {
  ticketReference: string
  steps: InvestigationStep[]
}

/** Live view of the agent pipeline working on the ticket. */
export function InvestigationProgress({ ticketReference, steps }: InvestigationProgressProps) {
  return (
    <section className={styles.card} aria-label="Investigation progress">
      <div className={styles.cardTop}>
        <span className={styles.cardRef}>#{ticketReference}</span>
        <h3 className={styles.cardTitle}>Investigation progress</h3>
      </div>

      <ol className={styles.stepList}>
        {steps.map((step) => (
          <li key={step.id} className={styles.step}>
            <span className={`${styles.stepMarker} ${markerClass(step.status)}`} aria-hidden="true">
              {step.status === 'complete' ? <CheckIcon width={10} height={10} /> : null}
            </span>
            <span className={styles.stepBody}>
              <span
                className={`${styles.stepLabel} ${
                  step.status === 'pending' ? styles.stepPendingLabel : ''
                }`}
              >
                {step.label}
                <span className={styles.srOnly}> - {statusLabel(step.status)}</span>
              </span>
              {step.agent && <span className={styles.stepAgent}>{step.agent}</span>}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function markerClass(status: InvestigationStep['status']): string {
  if (status === 'complete') return styles.markerComplete as string
  if (status === 'active') return styles.markerActive as string
  return styles.markerPending as string
}

function statusLabel(status: InvestigationStep['status']): string {
  if (status === 'complete') return 'completed'
  if (status === 'active') return 'in progress'
  return 'pending'
}
