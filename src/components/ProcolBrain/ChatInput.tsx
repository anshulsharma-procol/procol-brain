import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import styles from './ProcolBrain.module.css'
import { SendIcon } from './icons'

export interface ChatInputProps {
  disabled?: boolean
  placeholder?: string
  footnote?: string
  /** Lets the panel focus the composer when it opens. */
  inputRef?: RefObject<HTMLTextAreaElement | null>
  onSend: (text: string) => void
}

/** Auto-growing composer. Enter sends, Shift+Enter adds a newline. */
export function ChatInput({
  disabled,
  placeholder = 'Type your message...',
  footnote,
  inputRef,
  onSend,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null)
  const textareaRef = inputRef ?? fallbackRef

  useLayoutEffect(() => {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 96)}px`
  }, [textareaRef, value])

  const submit = () => {
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    setValue('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <div className={styles.composerWrap}>
      <div className={styles.composer}>
        <label className={styles.srOnly} htmlFor="pb-composer">
          Message
        </label>
        <textarea
          id="pb-composer"
          ref={textareaRef}
          className={styles.textarea}
          rows={1}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className={styles.sendButton}
          onClick={submit}
          disabled={disabled || value.trim().length === 0}
          aria-label="Send message"
        >
          <SendIcon width={15} height={15} />
        </button>
      </div>
      {footnote && <p className={styles.footnote}>{footnote}</p>}
    </div>
  )
}
