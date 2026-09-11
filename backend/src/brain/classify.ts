import { FALLBACK_PLAYBOOK, PLAYBOOKS, type Playbook } from '../domain/playbooks.js'
import { getWorkspace, WORKSPACES } from '../domain/workspaces.js'
import type { Workspace } from '../domain/types.js'

/**
 * Triage: a sentence from a customer becomes a workspace and a playbook.
 *
 * This is the one place an LLM belongs, and the one place it is not yet. The
 * matcher is deterministic and scored, which for a demo is a feature — the
 * same sentence routes the same way every time, with the wifi off. Swapping in
 * a model means replacing this function; the orchestrator asks for a
 * classification and does not care how it was produced.
 */
export interface Classification {
  workspace: Workspace
  playbook: Playbook
  /** 0..1. Below `MIN_CONFIDENCE` the fallback playbook is used. */
  confidence: number
  /** Terms that decided it, shown in the audit trail. */
  matched: string[]
  recognised: boolean
}

const MIN_SCORE = 3

export function classify(input: {
  message: string
  /** Tenant the request arrived from — the widget sends it as `companyId`. */
  workspaceId?: string
}): Classification {
  const workspace = getWorkspace(input.workspaceId)
  const haystack = input.message.toLowerCase()

  const candidates = PLAYBOOKS
    // A playbook belongs to a control tower. A Procol case cannot answer an
    // AcmeCloud ticket, even if the words line up.
    .filter((playbook) => playbook.workspaceId === workspace.id)
    .map((playbook) => score(playbook, haystack))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score)

  const best = candidates[0]

  if (!best || best.score < MIN_SCORE) {
    return {
      workspace,
      playbook: { ...FALLBACK_PLAYBOOK, workspaceId: workspace.id },
      confidence: best ? Math.min(0.4, best.score / 6) : 0,
      matched: best?.matched ?? [],
      recognised: false,
    }
  }

  return {
    workspace,
    playbook: best.playbook,
    confidence: Math.min(0.97, best.score / 8),
    matched: best.matched,
    recognised: true,
  }
}

function score(playbook: Playbook, haystack: string) {
  const matched: string[] = []
  let score = 0

  if (playbook.match.veto?.some((term) => haystack.includes(term))) {
    return { playbook, score: 0, matched }
  }

  for (const term of playbook.match.strong ?? []) {
    if (haystack.includes(term)) {
      score += 3
      matched.push(term)
    }
  }

  for (const term of playbook.match.terms) {
    if (haystack.includes(term)) {
      score += 1
      matched.push(term)
    }
  }

  return { playbook, score, matched }
}

/**
 * Which control tower a request belongs to. The widget sends `companyId`; a
 * client dashboard that has not been told its tenant yet falls back to the
 * default, and the console can always switch.
 */
export function resolveWorkspace(companyId: string | undefined): Workspace {
  if (!companyId) return getWorkspace(undefined)
  return WORKSPACES.find((workspace) => workspace.id === companyId) ?? getWorkspace(undefined)
}
