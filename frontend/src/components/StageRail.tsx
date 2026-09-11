import { agentVisual, useWorkspace } from '../platform/react'
import type { Stage } from '../platform/types'
import { colorClasses } from './colorClasses'

/**
 * Four dots — context, investigate, verify, approve — joined by hairlines.
 * A completed dot takes the colour of the agent that completed it, so the
 * shape of a run is readable across a room without a single label.
 *
 * A skipped dot is the whole point of the configuration case: the rail is
 * visibly shorter because Brain decided engineering was not needed.
 */
export default function StageRail({ stages, size = 'md' }: { stages: Stage[]; size?: 'sm' | 'md' }) {
  const { workspace } = useWorkspace()
  if (stages.length === 0) return null

  const dot = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'
  const gap = size === 'sm' ? 'w-4' : 'w-6'

  return (
    <div className="flex items-center" role="list" aria-label="Run stages">
      {stages.map((stage, index) => {
        const visual = agentVisual(workspace, stage.agentId)
        const color = colorClasses[visual.color]

        return (
          <div key={stage.id} className="flex items-center">
            {index > 0 && <span className={`h-px ${gap} bg-gray-200`} />}
            <span
              role="listitem"
              aria-label={`${stage.label}: ${stage.status}`}
              title={`${stage.label} — ${stage.status}${stage.agentId ? ` (${visual.name})` : ''}`}
              className={`block shrink-0 rounded-full ${dot} ${
                stage.status === 'complete'
                  ? color.solidBg
                  : stage.status === 'active'
                    ? 'pulse-live bg-amber-500'
                    : stage.status === 'skipped'
                      ? 'border border-dashed border-gray-300'
                      : 'border border-gray-300'
              }`}
            />
          </div>
        )
      })}
    </div>
  )
}
