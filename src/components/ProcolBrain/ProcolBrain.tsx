import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { BrainApi } from '../../services/brainApi'
import { createBrainClient } from '../../services/brainApi'
import { MockBrainApi } from '../../services/mockBrainApi'
import type { ProcolBrainProps } from '../../types/config'
import { themeToCssVariables } from '../../theme/themeVariables'
import { useProcolBrain } from '../../hooks/useProcolBrain'
import styles from './ProcolBrain.module.css'
import { BrainLauncher } from './BrainLauncher'
import { ChatWindow } from './ChatWindow'

const DEFAULT_ASSISTANT_NAME = 'Procol Brain'

/**
 * Embeddable support assistant.
 *
 * ```tsx
 * <ProcolBrain companyId="abc-corp" userId="user-123" />
 * ```
 *
 * Renders a floating launcher plus a panel; the host application's UI stays
 * visible and interactive behind it.
 */
export function ProcolBrain({
  companyId,
  userId,
  apiBaseUrl,
  api,
  theme,
  position = 'bottom-right',
  defaultOpen = false,
  display = 'floating',
  initialMessage,
  assistantName = DEFAULT_ASSISTANT_NAME,
  logo,
  launcherIcon,
  launcherLabel = 'Help & Support',
  greeting,
  footer,
  context,
  onTicketCreated,
  onTicketResolved,
  onResolutionReady,
  onOpenChange,
  className,
}: ProcolBrainProps) {
  const inline = display === 'inline'
  const [openState, setOpen] = useState(defaultOpen)
  const open = inline || openState

  const reactId = useId().replace(/:/g, '')
  const panelId = `pb-panel-${reactId}`
  const titleId = `pb-title-${reactId}`

  const launcherRef = useRef<HTMLButtonElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const wasOpen = useRef(open)

  const brain: BrainApi = useMemo(() => {
    if (api) return api
    if (apiBaseUrl) return createBrainClient({ baseUrl: apiBaseUrl })
    return new MockBrainApi()
  }, [api, apiBaseUrl])

  const identity = useMemo(() => ({ companyId, userId }), [companyId, userId])

  const resolvedGreeting =
    greeting ??
    `Hi! I'm ${assistantName} \u{1F44B}\n\nDescribe your issue and I'll help you find a solution.`

  const {
    messages,
    suggestedActions,
    busy,
    sendMessage,
    startConversation,
    runAction,
    reset,
  } = useProcolBrain({
    api: brain,
    identity,
    context,
    greeting: resolvedGreeting,
    onTicketCreated,
    onTicketResolved,
    onResolutionReady,
  })

  const setOpenState = useCallback(
    (next: boolean) => {
      if (inline) return
      setOpen(next)
      onOpenChange?.(next)
    },
    [inline, onOpenChange],
  )

  // Report the host-provided opening message. `startConversation` resets first,
  // so re-running this effect (StrictMode, or a changed message) is harmless.
  useEffect(() => {
    if (!initialMessage) return
    startConversation(initialMessage)
  }, [initialMessage, startConversation])

  // Focus the composer when opening; hand focus back to the launcher on close.
  useEffect(() => {
    if (open && !wasOpen.current) {
      const frame = requestAnimationFrame(() => inputRef.current?.focus())
      wasOpen.current = true
      return () => cancelAnimationFrame(frame)
    }

    if (!open && wasOpen.current) {
      launcherRef.current?.focus()
      wasOpen.current = false
    }

    return undefined
  }, [open])

  const handleClose = useCallback(() => {
    setOpenState(false)
    reset()
  }, [reset, setOpenState])

  const style = useMemo(() => themeToCssVariables(theme), [theme])

  const positionClass = position === 'bottom-left' ? styles.bottomLeft : styles.bottomRight
  const rootClassName = [
    styles.root,
    inline ? styles.inline : positionClass,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClassName} style={style} data-procol-brain="">
      {open && (
        <ChatWindow
          panelId={panelId}
          titleId={titleId}
          assistantName={assistantName}
          logo={logo}
          subtitle={busy ? 'Working on it...' : 'AI support assistant'}
          context={context}
          messages={messages}
          actions={suggestedActions}
          busy={busy}
          showControls={!inline}
          footnote={footer === false ? undefined : (footer ?? `Powered by ${assistantName}`)}
          inputRef={inputRef}
          onSend={sendMessage}
          onAction={runAction}
          onMinimize={() => setOpenState(false)}
          onClose={handleClose}
        />
      )}

      {!inline && (
        <BrainLauncher
          label={launcherLabel}
          icon={launcherIcon}
          open={open}
          panelId={panelId}
          buttonRef={launcherRef}
          onClick={() => setOpenState(!open)}
        />
      )}
    </div>
  )
}
