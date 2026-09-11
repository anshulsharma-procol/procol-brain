import type { ReactNode } from 'react'
import type { BrainApi } from '../services/brainApi'
import type { BrainContext, BrainTicket, Resolution } from './brain'

export type BrainPosition = 'bottom-right' | 'bottom-left'

/**
 * Visual tokens a host application may override. Every value maps to a CSS
 * custom property on the widget root, so overriding one does not require
 * rebuilding the package.
 */
export interface ProcolBrainTheme {
  /** Accent used for primary buttons, links and the assistant avatar ring. */
  primaryColor?: string
  /** Text rendered on top of `primaryColor`. */
  primaryTextColor?: string
  /** Panel background. */
  backgroundColor?: string
  /** Background for assistant bubbles, cards and the composer. */
  surfaceColor?: string
  /** Primary text colour. */
  textColor?: string
  /** Secondary / helper text colour. */
  mutedTextColor?: string
  /** Hairline borders. */
  borderColor?: string
  /** Success states (resolved, completed steps). */
  successColor?: string
  /** AI accent, used sparingly for agent labels. */
  aiColor?: string
  /** Panel corner radius in px. */
  borderRadius?: number
  /** Font stack for the whole widget. */
  fontFamily?: string
  /** Panel shadow. */
  shadow?: string
  /** Stacking order of the launcher and panel. */
  zIndex?: number
}

export interface ProcolBrainProps {
  /** Tenant the conversation belongs to. Required. */
  companyId: string
  /** End user reporting the issue. */
  userId?: string

  /** Base URL of the Brain API. When omitted the bundled mock API is used. */
  apiBaseUrl?: string
  /**
   * Escape hatch: supply a fully custom {@link BrainApi} implementation.
   * Takes precedence over `apiBaseUrl`.
   */
  api?: BrainApi

  /** Visual overrides. Merged over the default Procol Brain theme. */
  theme?: ProcolBrainTheme

  position?: BrainPosition
  defaultOpen?: boolean

  /** Displayed in the header and the greeting. Defaults to "Procol Brain". */
  assistantName?: string
  /** Image URL shown in the header. Falls back to a built-in mark. */
  logo?: string
  /** Custom launcher content (an emoji, an <img />, an icon component). */
  launcherIcon?: ReactNode
  /** Launcher label. Defaults to "Help & Support". */
  launcherLabel?: string
  /** First assistant message. */
  greeting?: string
  /**
   * Small print under the composer. Defaults to `Powered by <assistantName>`;
   * pass `false` to hide it entirely.
   */
  footer?: string | false

  /** Where in the host app the widget was opened from. */
  context?: BrainContext

  onTicketCreated?: (ticket: BrainTicket) => void
  onTicketResolved?: (ticket: BrainTicket) => void
  onResolutionReady?: (resolution: Resolution) => void
  onOpenChange?: (open: boolean) => void

  /** Extra class on the widget root, for host-side positioning tweaks. */
  className?: string
}
