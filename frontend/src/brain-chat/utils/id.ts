let counter = 0

/** Stable unique id with a fallback for browsers without `crypto.randomUUID`. */
export function createId(prefix = 'pb'): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${(counter++).toString(36)}`

  return `${prefix}_${uuid}`
}
