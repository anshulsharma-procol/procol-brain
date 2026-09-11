import { Brain, Code, FlaskConical, User } from 'lucide-react'
import type { AgentId } from '../types'
import { AGENT_COLOR, colorClasses, toColorToken } from './colorClasses'

// Substitution note: lucide-react has no distinct "Clara" glyph, so Clara
// reuses the Brain icon (solid violet) to read as a sibling of the Brain
// orchestrator's gradient mark, per the "closest reasonable icon" rule.
const ICONS: Record<AgentId, typeof Brain> = {
  brain: Brain,
  clara: Brain,
  dev: Code,
  qa: FlaskConical,
  manager: User,
}

const CIRCLE_SIZES = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-11 w-11',
} as const

const SQUARE_SIZES = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-14 w-14',
} as const

interface AgentAvatarProps {
  agentId: AgentId
  size?: keyof typeof CIRCLE_SIZES
  /** 'solid' = colored circle with a white icon (chat, timelines). */
  /** 'light' = light tinted rounded-square with a colored icon (registry). */
  variant?: 'solid' | 'light'
}

export default function AgentAvatar({ agentId, size = 'md', variant = 'solid' }: AgentAvatarProps) {
  const Icon = ICONS[agentId]
  const color = colorClasses[toColorToken(AGENT_COLOR[agentId])]
  const isBrain = agentId === 'brain'

  if (variant === 'light') {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl ${SQUARE_SIZES[size]} ${color.lightBg}`}
      >
        <Icon className={color.text} strokeWidth={2} />
      </div>
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${CIRCLE_SIZES[size]} ${
        isBrain ? 'brand-gradient' : color.solidBg
      } text-white`}
    >
      <Icon className="h-4 w-4" strokeWidth={2.25} />
    </div>
  )
}
