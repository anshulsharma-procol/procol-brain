import * as React from 'react'
import { useState } from 'react'

let counter = 0

const nextId = () => `pb${(counter++).toString(36)}`

/**
 * A unique id per widget instance, used to wire `aria-controls` and
 * `aria-labelledby` together.
 *
 * Prefers React 18's `useId` (hydration-safe) and falls back to a module
 * counter on React 17, so the package works across all three major versions.
 */
export function useInstanceId(): string {
  const reactUseId = (React as { useId?: () => string }).useId

  // The branch is decided by the React build in use and never changes between
  // renders, so the rule-of-hooks guarantee still holds.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const id = reactUseId ? reactUseId() : useState(nextId)[0]

  return id.replace(/:/g, '')
}
