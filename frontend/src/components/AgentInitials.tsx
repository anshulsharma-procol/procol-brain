import type { AgentId } from '../types'
import { AGENT_COLOR, colorClasses, toColorToken } from './colorClasses'

const INITIALS: Record<AgentId, string> = {
  brain: 'BR',
  clara: 'CL',
  dev: 'DEV',
  qa: 'QA',
  manager: 'MGR',
}

interface AgentInitialsProps {
  agentId: AgentId
}

/** Small initials-in-a-circle avatar, used only in the Home operations table. */
export default function AgentInitials({ agentId }: AgentInitialsProps) {
  const color = colorClasses[toColorToken(AGENT_COLOR[agentId])]
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${color.solidBg}`}
    >
      {INITIALS[agentId]}
    </div>
  )
}
