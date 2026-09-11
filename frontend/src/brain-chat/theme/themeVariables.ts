import type { CSSProperties } from 'react'
import type { ProcolBrainTheme } from '../types/config'
import { defaultTheme } from './defaultTheme'

/**
 * Turns a partial theme into the CSS custom properties consumed by the
 * widget's stylesheets. Host apps never need to know the variable names.
 */
export function themeToCssVariables(theme?: ProcolBrainTheme): CSSProperties {
  const t = { ...defaultTheme, ...clean(theme) }

  return {
    '--pb-primary': t.primaryColor,
    '--pb-primary-text': t.primaryTextColor,
    '--pb-primary-soft': withAlpha(t.primaryColor, 0.08),
    '--pb-primary-ring': withAlpha(t.primaryColor, 0.28),
    '--pb-bg': t.backgroundColor,
    '--pb-surface': t.surfaceColor,
    '--pb-text': t.textColor,
    '--pb-muted': t.mutedTextColor,
    '--pb-border': t.borderColor,
    '--pb-success': t.successColor,
    '--pb-success-soft': withAlpha(t.successColor, 0.1),
    '--pb-ai': t.aiColor,
    '--pb-ai-soft': withAlpha(t.aiColor, 0.1),
    '--pb-radius': `${t.borderRadius}px`,
    '--pb-radius-sm': `${Math.max(4, Math.round(t.borderRadius * 0.5))}px`,
    '--pb-font': t.fontFamily,
    '--pb-shadow': t.shadow,
    '--pb-z': t.zIndex,
  } as CSSProperties
}

function clean(theme?: ProcolBrainTheme): ProcolBrainTheme {
  if (!theme) return {}
  return Object.fromEntries(
    Object.entries(theme).filter(([, value]) => value !== undefined && value !== null),
  )
}

/**
 * Best-effort alpha variant of a colour. Hex inputs are converted precisely;
 * anything else (named colours, `var(...)`, gradients) is returned untouched
 * so a custom theme never renders an invalid value.
 */
function withAlpha(color: string, alpha: number): string {
  const hex = color.trim()
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
  if (!match) return color

  const digits = match[1] as string
  const full =
    digits.length === 3
      ? digits
          .split('')
          .map((c) => c + c)
          .join('')
      : digits

  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
