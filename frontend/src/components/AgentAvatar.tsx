import { agentVisual, useWorkspace } from '../platform/react'
import { colorClasses } from './colorClasses'

const CIRCLE_SIZES = { sm: 'h-7 w-7', md: 'h-9 w-9', lg: 'h-11 w-11' } as const
const SQUARE_SIZES = { sm: 'h-9 w-9', md: 'h-11 w-11', lg: 'h-14 w-14' } as const

interface AgentAvatarProps {
  /** Any agent id declared by the current workspace, or 'human'. */
  agentId: string | undefined
  size?: keyof typeof CIRCLE_SIZES
  /** 'solid' = coloured circle with a white icon (transcript, timelines). */
  /** 'light' = tinted rounded square with a coloured icon (registry). */
  variant?: 'solid' | 'light'
}

/**
 * The agent's face. It resolves the agent through the active workspace, so
 * the same component renders Clara for Procol and the Company Knowledge Agent
 * for AcmeCloud without knowing either name.
 */
export default function AgentAvatar({ agentId, size = 'md', variant = 'solid' }: AgentAvatarProps) {
  const { workspace } = useWorkspace()
  const visual = agentVisual(workspace, agentId)
  const color = colorClasses[visual.color]
  const Icon = visual.icon

  if (variant === 'light') {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl ${SQUARE_SIZES[size]} ${color.lightBg}`}
        title={visual.name}
      >
        <Icon className={color.text} strokeWidth={2} />
      </div>
    )
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full ${CIRCLE_SIZES[size]} ${
        visual.isOrchestrator ? 'brand-gradient' : color.solidBg
      } text-white`}
      title={visual.name}
    >
      <Icon className="h-4 w-4" strokeWidth={2.25} />
    </div>
  )
}
