import type { ArtifactKind, ResolutionPath, Ticket, Workspace } from '../domain/types.js'

/**
 * What needs a human, and why.
 *
 * Declarative on purpose: the matched policy's reason is returned on the run
 * and rendered above the approve button, because visible governance is the
 * argument against a fully autonomous competitor. A rule nobody can read is
 * not governance.
 */
export function policyFor(
  workspace: Workspace,
  path: ResolutionPath,
  producedKinds: ArtifactKind[],
  ticket: Ticket,
): { id: string; reason: string; risk: 'low' | 'medium' | 'high' } | undefined {
  // A question that changes nothing does not need a gate. Restraint here is
  // what stops the gate from becoming noise people click through.
  if (path === 'ANSWER_ONLY') return undefined

  for (const policy of workspace.approvalPolicies) {
    if (!policy.appliesTo.some((kind) => producedKinds.includes(kind))) continue

    return {
      id: policy.id,
      reason: policy.reason,
      risk: escalate(policy.risk, ticket),
    }
  }

  return undefined
}

/** A critical ticket raises the stated risk one notch. */
function escalate(
  risk: 'low' | 'medium' | 'high',
  ticket: Ticket,
): 'low' | 'medium' | 'high' {
  if (ticket.priority !== 'CRITICAL') return risk
  return risk === 'low' ? 'medium' : 'high'
}
