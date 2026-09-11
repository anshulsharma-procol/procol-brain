import styles from './ProcolBrain.module.css'
import { BrainMarkIcon, CloseIcon, MinimizeIcon } from './icons'

export interface BrainHeaderProps {
  assistantName: string
  subtitle: string
  logo?: string
  titleId: string
  onMinimize: () => void
  onClose: () => void
}

export function BrainHeader({
  assistantName,
  subtitle,
  logo,
  titleId,
  onMinimize,
  onClose,
}: BrainHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <span className={styles.avatar}>
          {logo ? (
            <img src={logo} alt="" className={styles.avatarImage} />
          ) : (
            <BrainMarkIcon width={18} height={18} />
          )}
        </span>
        <div className={styles.headerText}>
          <h2 className={styles.headerTitle} id={titleId}>
            {assistantName}
          </h2>
          <p className={styles.headerSubtitle}>
            <span className={styles.onlineDot} aria-hidden="true" />
            {subtitle}
          </p>
        </div>
      </div>

      <div className={styles.headerActions}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onMinimize}
          aria-label="Minimize support chat"
        >
          <MinimizeIcon />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onClose}
          aria-label="Close support chat"
        >
          <CloseIcon />
        </button>
      </div>
    </header>
  )
}
