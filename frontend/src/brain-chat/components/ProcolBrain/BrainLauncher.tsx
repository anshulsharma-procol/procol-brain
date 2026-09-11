import type { ReactNode } from 'react'
import type { Ref } from 'react'
import styles from './ProcolBrain.module.css'
import { ChatIcon } from './icons'

export interface BrainLauncherProps {
  label: string
  icon?: ReactNode
  open: boolean
  panelId: string
  onClick: () => void
  buttonRef?: Ref<HTMLButtonElement>
}

/** The always-visible entry point in the host application. */
export function BrainLauncher({
  label,
  icon,
  open,
  panelId,
  onClick,
  buttonRef,
}: BrainLauncherProps) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={styles.launcher}
      onClick={onClick}
      aria-expanded={open}
      aria-controls={panelId}
      aria-label={open ? `Close ${label}` : label}
    >
      <span className={styles.launcherIcon}>{icon ?? <ChatIcon width={18} height={18} />}</span>
      {label}
    </button>
  )
}
