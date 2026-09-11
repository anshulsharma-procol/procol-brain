import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Keeps a scrolling transcript pinned to the newest entry — but only while
 * the reader is already there.
 *
 * The rule is the whole point: scrolling up is a deliberate act, and the
 * transcript must stay where it was put until the reader comes back down.
 * An investigation streams for a minute or more and re-renders every time it
 * polls, so a transcript that follows on every update makes reading what an
 * agent just said impossible — you are pulled off the line mid-sentence,
 * every second, with no way to stop it.
 */
export interface StickToBottom {
  /** Attach to the scrolling element: `ref={attach}`. */
  attach: (node: HTMLElement | null) => void
  /** True while the reader has scrolled away from the newest entry. */
  detached: boolean
  /** Attach to the same element: `onScroll={onScroll}`. */
  onScroll: () => void
  /** Scroll back to the newest entry and re-pin. */
  scrollToLatest: () => void
}

/**
 * Within this many pixels of the bottom still counts as being at the bottom.
 * Sub-pixel layout means an element parked at the end is often a fraction of
 * a pixel short of it.
 */
const BOTTOM_THRESHOLD_PX = 32

export function useStickToBottom(dependency: unknown): StickToBottom {
  const node = useRef<HTMLElement | null>(null)
  const pinned = useRef(true)
  const observer = useRef<ResizeObserver | null>(null)
  /** The box as it was at the last measurement — see `measure`. */
  const box = useRef({ scrollHeight: 0, clientHeight: 0 })
  const [detached, setDetached] = useState(false)

  const stick = useCallback(() => {
    const element = node.current
    if (!element || !pinned.current) return

    element.scrollTop = element.scrollHeight
    box.current = { scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }
  }, [])

  /**
   * Decides whether a scroll event was the reader moving, or the layout
   * moving underneath them.
   *
   * This distinction is the whole fix. The browser fires `scroll` for both,
   * and they are not the same thing: when a message arrives or the quick
   * actions row appears, the box changes size and the reader's position
   * relative to the bottom changes without them touching anything. Treating
   * that as "they scrolled away" un-pins a reader who never moved — and
   * treating it as "they came back" yanks one who did.
   *
   * So: a scroll that arrives with a size change is layout, and only adjusts
   * the pin in the direction of staying pinned. A scroll at a stable size is
   * the reader, and is obeyed in both directions.
   */
  const measure = useCallback(() => {
    const element = node.current
    if (!element) return

    const { scrollHeight, clientHeight, scrollTop } = element
    const resized =
      scrollHeight !== box.current.scrollHeight || clientHeight !== box.current.clientHeight
    box.current = { scrollHeight, clientHeight }

    const atBottom = scrollHeight - scrollTop - clientHeight <= BOTTOM_THRESHOLD_PX

    if (resized) {
      // Layout moved. Follow it if they were pinned; never un-pin them.
      if (pinned.current) stick()
      return
    }

    pinned.current = atBottom
    setDetached((current) => (current === !atBottom ? current : !atBottom))
  }, [stick])

  const scrollToLatest = useCallback(() => {
    const element = node.current
    if (!element) return

    pinned.current = true
    setDetached(false)
    element.scrollTop = element.scrollHeight
    box.current = { scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }
  }, [])

  /**
   * A callback ref, so the transcript opens at the newest entry — and a
   * resize observer, because the box changes size without a scroll event of
   * its own when the quick-action row appears or the composer grows.
   */
  const attach = useCallback(
    (element: HTMLElement | null) => {
      observer.current?.disconnect()
      node.current = element
      if (!element) return

      element.scrollTop = element.scrollHeight
      box.current = { scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }

      if (typeof ResizeObserver === 'undefined') return
      observer.current = new ResizeObserver(stick)
      observer.current.observe(element)
    },
    [stick],
  )

  // Content changed. Follow it only if the reader had not moved away, and
  // again on the next frame, for anything whose height settles late.
  useEffect(() => {
    stick()
    const frame = requestAnimationFrame(stick)
    return () => cancelAnimationFrame(frame)
  }, [dependency, stick])

  useEffect(() => () => observer.current?.disconnect(), [])

  return { attach, detached, onScroll: measure, scrollToLatest }
}
