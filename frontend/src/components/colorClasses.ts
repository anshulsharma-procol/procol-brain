// Tailwind only picks up class names that appear as literal text in source
// files, so colours are looked up from this map rather than built with string
// interpolation (e.g. `bg-${color}-600`), which Tailwind's scanner cannot see.
//
// Which colour an agent gets is decided in platform/react/agentVisuals.ts,
// from its role. This file only knows how to paint a token.

export type ColorToken = 'violet' | 'blue' | 'green' | 'amber' | 'red' | 'gray'

interface ColorClasses {
  solidBg: string
  lightBg: string
  text: string
  border: string
  /** Left rule on a transcript entry — the agent's signature on the record. */
  rule: string
}

export const colorClasses: Record<ColorToken, ColorClasses> = {
  violet: {
    solidBg: 'bg-violet-600',
    lightBg: 'bg-violet-100',
    text: 'text-violet-600',
    border: 'border-violet-200',
    rule: 'bg-violet-500',
  },
  blue: {
    solidBg: 'bg-blue-500',
    lightBg: 'bg-blue-100',
    text: 'text-blue-600',
    border: 'border-blue-200',
    rule: 'bg-blue-500',
  },
  green: {
    solidBg: 'bg-green-600',
    lightBg: 'bg-green-100',
    text: 'text-green-600',
    border: 'border-green-200',
    rule: 'bg-green-600',
  },
  amber: {
    solidBg: 'bg-amber-500',
    lightBg: 'bg-amber-100',
    text: 'text-amber-600',
    border: 'border-amber-200',
    rule: 'bg-amber-500',
  },
  red: {
    solidBg: 'bg-red-500',
    lightBg: 'bg-red-100',
    text: 'text-red-600',
    border: 'border-red-200',
    rule: 'bg-red-500',
  },
  gray: {
    solidBg: 'bg-gray-400',
    lightBg: 'bg-gray-100',
    text: 'text-gray-500',
    border: 'border-gray-200',
    rule: 'bg-gray-400',
  },
}

export function toColorToken(color: string): ColorToken {
  return color in colorClasses ? (color as ColorToken) : 'gray'
}
