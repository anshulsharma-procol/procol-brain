import type { SuggestedAction } from '../../types/messages'
import styles from './ProcolBrain.module.css'

export interface SuggestedActionsProps {
  actions: SuggestedAction[]
  disabled?: boolean
  onSelect: (actionId: string) => void
}

/** Quick replies rendered between the transcript and the composer. */
export function SuggestedActions({ actions, disabled, onSelect }: SuggestedActionsProps) {
  if (actions.length === 0) return null

  return (
    <div className={styles.actions} role="group" aria-label="Suggested actions">
      {actions.map((action) => (
        <button
          key={action.id}
          type="button"
          className={`${styles.actionButton} ${
            action.tone === 'primary' ? styles.actionPrimary : ''
          }`}
          disabled={disabled}
          onClick={() => onSelect(action.id)}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
