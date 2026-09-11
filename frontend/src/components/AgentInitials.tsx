import { agentVisual, useWorkspace } from '../platform/react'
import { colorClasses } from './colorClasses'

/** Initials-in-a-circle avatar, used in dense tables. */
export default function AgentInitials({ agentId }: { agentId: string | undefined }) {
  const { workspace } = useWorkspace()
  const visual = agentVisual(workspace, agentId)
  const color = colorClasses[visual.color]

  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${color.solidBg}`}
      title={visual.name}
    >
      {visual.shortLabel}
    </div>
  )
}
