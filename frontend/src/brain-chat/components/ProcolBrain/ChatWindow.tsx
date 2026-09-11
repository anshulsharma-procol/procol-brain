import type { KeyboardEvent, RefObject } from 'react'
import { useStickToBottom } from '../../hooks/useStickToBottom'
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
  /** When false, Brain <-> agent hops are hidden from the transcript. */
  showAgentActivity?: boolean
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
  showAgentActivity = true,
  footnote,
  inputRef,
  onSend,
  onAction,
  onMinimize,
  onClose,
}: ChatWindowProps) {
  // Follows the newest entry, unless the reader has scrolled up to read
  // something — an investigation re-renders every time it polls, and yanking
  // someone back down mid-sentence once a second is unusable.
  const { attach, detached, onScroll, scrollToLatest } = useStickToBottom(messages)

  /**
   * Sending re-pins, even from halfway up the transcript. Typing a message is
   * asking to see what comes back, so the one place a jump is wanted is right
   * after your own action.
   */
  const handleSend = (text: string) => {
    scrollToLatest()
    onSend(text)
  }

  const handleAction = (actionId: string) => {
    scrollToLatest()
    onAction(actionId)
  }

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

      <div className={styles.threadWrap}>
        <div
          className={styles.thread}
          ref={attach}
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {contextLabel && <div className={styles.contextChip}>{contextLabel}</div>}
          {messages
            .filter((message) => showAgentActivity || message.kind !== 'agent-activity')
            .map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
        </div>

        {detached && (
          <button
            type="button"
            className={styles.jumpToLatest}
            onClick={scrollToLatest}
          >
            Jump to latest
          </button>
        )}
      </div>

      <SuggestedActions actions={actions} disabled={busy} onSelect={handleAction} />

      <ChatInput
        disabled={busy}
        footnote={footnote}
        inputRef={inputRef}
        onSend={handleSend}
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
