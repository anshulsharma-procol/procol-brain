import { useCallback, useEffect, useRef } from 'react'

/**
 * Moves focus into a panel when it opens, and back where it came from when it
 * closes.
 *
 * Without it, pressing Enter on "Add connection" leaves focus on the trigger
 * and the panel is rendered last in the document — so reaching the thing you
 * just opened means tabbing past every filter chip and every card, twenty-odd
 * stops, with nothing to say it worked. A keyboard user gets no feedback at
 * all from an action that visibly changed the screen.
 *
 * Escape closes, for the same reason a dialog does: the way out should not
 * require finding a specific button.
 */
export function usePanelFocus(onClose: () => void) {
  const returnTo = useRef<HTMLElement | null>(null)
  const panel = useRef<HTMLElement | null>(null)

  useEffect(() => {
    return () => {
      // Only if the reader has not since moved on themselves — stealing focus
      // back from wherever they went is worse than leaving it. Removing the
      // panel drops focus to the body, which is the case this restores from.
      const active = document.activeElement
      const inside = panel.current?.contains(active) ?? false
      if (inside || active === document.body || active === null) {
        returnTo.current?.focus?.()
      }
    }
  }, [])

  const attach = useCallback((node: HTMLElement | null) => {
    panel.current = node
    if (!node) return

    // Captured here rather than in an effect: ref callbacks run during commit,
    // before effects, so by the time an effect could read it the panel would
    // already hold focus and we would "return" to the panel we just closed.
    returnTo.current ??= document.activeElement as HTMLElement | null

    // The panel itself, not its first control: a screen reader then announces
    // the heading and what this is for, rather than starting on "Close".
    node.focus({ preventScroll: true })
  }, [])

  const onKeyDown = useCallback(
    (event: { key: string; stopPropagation: () => void }) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    },
    [onClose],
  )

  /** Spread onto the panel element. */
  return { ref: attach, tabIndex: -1, onKeyDown }
}
