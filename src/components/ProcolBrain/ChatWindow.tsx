import { useEffect, useRef } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import type { BrainContext } from '../../types/brain'
import type { BrainMessage, SuggestedAction } from '../../types/messages'
import styles from './ProcolBrain.module.css'
import { BrainHeader } from './BrainHeader'
import { ChatInput } from './ChatInput'
import { ChatMessage } from './ChatMessage'
import { SuggestedActions } from './SuggestedActions'

export interface ChatWindowProps {
  panelId: string
  titleId: string
  assistantName: string
  logo?: string
  subtitle: string
  context?: BrainContext
  messages: BrainMessage[]
  actions: SuggestedAction[]
  busy: boolean
  showControls?: boolean
  footnote?: string
  inputRef?: RefObject<HTMLTextAreaElement | null>
  onSend: (text: string) => void
  onAction: (actionId: string) => void
  onMinimize: () => void
  onClose: () => void
}

/** The floating panel: header, transcript, quick actions, composer. */
export function ChatWindow({
  panelId,
  titleId,
  assistantName,
  logo,
  subtitle,
  context,
  messages,
  actions,
  busy,
  showControls,
  footnote,
  inputRef,
  onSend,
  onAction,
  onMinimize,
  onClose,
}: ChatWindowProps) {
  const threadRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = threadRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onMinimize()
    }
  }

  const contextLabel = describeContext(context)

  return (
    <div
      id={panelId}
      className={styles.panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
    >
      <BrainHeader
        assistantName={assistantName}
        subtitle={subtitle}
        logo={logo}
        titleId={titleId}
        showControls={showControls}
        onMinimize={onMinimize}
        onClose={onClose}
      />

      <div
        className={styles.thread}
        ref={threadRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {contextLabel && <div className={styles.contextChip}>{contextLabel}</div>}
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>

      <SuggestedActions actions={actions} disabled={busy} onSelect={onAction} />

      <ChatInput
        disabled={busy}
        footnote={footnote}
        inputRef={inputRef}
        onSend={onSend}
      />
    </div>
  )
}

/** "Opened from GRN - GRN/2627/5", when the host supplied context. */
function describeContext(context?: BrainContext): string | null {
  if (!context) return null

  const where = context.currentModule ?? context.currentPage
  if (!where) return null

  return context.recordId ? `Opened from ${where} - ${context.recordId}` : `Opened from ${where}`
}
