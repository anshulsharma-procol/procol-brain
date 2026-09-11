import { randomBytes } from 'node:crypto'

/**
 * Collision-resistant ids. The contract says tickets are human-readable
 * (`PRO-1245`) and everything else is a cuid, so this is what everything else
 * gets — sortable by creation because the timestamp leads.
 */
let counter = 0

export function cuid(prefix = 'c'): string {
  const time = Date.now().toString(36)
  const count = (counter++ & 0xffff).toString(36).padStart(4, '0')
  const random = randomBytes(4).toString('hex')
  return `${prefix}_${time}${count}${random}`
}
