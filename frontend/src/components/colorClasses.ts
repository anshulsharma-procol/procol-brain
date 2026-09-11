// Tailwind only picks up class names that appear as literal text in source
// files, so agent/status colors are looked up from this map rather than
// built with string interpolation (e.g. `bg-${color}-600`), which Tailwind's
// scanner cannot see.
import type { AgentId } from '../types'

export type ColorToken = 'violet' | 'blue' | 'green' | 'amber' | 'red' | 'gray'

export const AGENT_COLOR: Record<AgentId, string> = {
  brain: 'violet',
  clara: 'violet',
  dev: 'blue',
  qa: 'green',
  manager: 'amber',
}

interface ColorClasses {
  solidBg: string
  lightBg: string
  text: string
  border: string
}

export const colorClasses: Record<ColorToken, ColorClasses> = {
  violet: {
    solidBg: 'bg-violet-600',
    lightBg: 'bg-violet-100',
    text: 'text-violet-600',
    border: 'border-violet-200',
  },
  blue: {
    solidBg: 'bg-blue-500',
    lightBg: 'bg-blue-100',
    text: 'text-blue-600',
    border: 'border-blue-200',
  },
  green: {
    solidBg: 'bg-green-600',
    lightBg: 'bg-green-100',
    text: 'text-green-600',
    border: 'border-green-200',
  },
  amber: {
    solidBg: 'bg-amber-500',
    lightBg: 'bg-amber-100',
    text: 'text-amber-600',
    border: 'border-amber-200',
  },
  red: {
    solidBg: 'bg-red-500',
    lightBg: 'bg-red-100',
    text: 'text-red-600',
    border: 'border-red-200',
  },
  gray: {
    solidBg: 'bg-gray-400',
    lightBg: 'bg-gray-100',
    text: 'text-gray-500',
    border: 'border-gray-200',
  },
}

export function toColorToken(color: string): ColorToken {
  if (color === 'violet' || color === 'blue' || color === 'green' || color === 'amber' || color === 'red' || color === 'gray') {
    return color
  }
  return 'gray'
}
