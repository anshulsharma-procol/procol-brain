import type { ReactNode } from 'react'
import type { Tone } from '../types'

const toneClasses: Record<Tone, string> = {
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-600',
  info: 'bg-blue-100 text-blue-600',
  neutral: 'bg-gray-100 text-gray-600',
}

const dotClasses: Record<Tone, string> = {
  success: 'bg-green-600',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-400',
}

interface StatusPillProps {
  label: string
  tone: Tone
  icon?: ReactNode
  withDot?: boolean
}

export default function StatusPill({ label, tone, icon, withDot }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${toneClasses[tone]}`}
    >
      {withDot ? <span className={`h-1.5 w-1.5 rounded-full ${dotClasses[tone]}`} /> : icon}
      {label}
    </span>
  )
}
