import { Bot, Database, Plug } from 'lucide-react'
import type { ReactElement } from 'react'

/**
 * A connection's mark.
 *
 * Where a brand's logo is simple enough to draw faithfully it is drawn; where
 * it is not — an octocat, an elephant — a monogram in the brand's colour
 * stands in. A recognisable letterform beats an approximation of someone's
 * trademark that is subtly wrong, and the `logo` key is there so a real asset
 * can be dropped in later without touching a card.
 */
interface Props {
  logo: string
  name: string
  category?: string
  size?: number
}

export default function ConnectionLogo({ logo, name, category, size = 44 }: Props) {
  const mark = MARKS[logo]

  if (mark) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-xl"
        style={{ width: size, height: size, background: mark.background }}
        aria-hidden
      >
        {mark.render(Math.round(size * 0.55))}
      </span>
    )
  }

  return <Monogram logo={logo} name={name} category={category} size={size} />
}

interface Mark {
  background: string
  render: (glyph: number) => ReactElement
}

const MARKS: Record<string, Mark> = {
  slack: {
    background: '#fff',
    render: (s) => (
      <svg width={s} height={s} viewBox="0 0 122 122" role="img">
        <path d="M25.8 77.6a12.9 12.9 0 1 1-12.9-12.9h12.9v12.9Z" fill="#E01E5A" />
        <path d="M32.3 77.6a12.9 12.9 0 0 1 25.8 0v32.3a12.9 12.9 0 1 1-25.8 0V77.6Z" fill="#E01E5A" />
        <path d="M45.2 25.8a12.9 12.9 0 1 1 12.9-12.9v12.9H45.2Z" fill="#36C5F0" />
        <path d="M45.2 32.3a12.9 12.9 0 0 1 0 25.8H12.9a12.9 12.9 0 1 1 0-25.8h32.3Z" fill="#36C5F0" />
        <path d="M96.9 45.2a12.9 12.9 0 1 1 12.9 12.9H96.9V45.2Z" fill="#2EB67D" />
        <path d="M90.4 45.2a12.9 12.9 0 0 1-25.8 0V12.9a12.9 12.9 0 1 1 25.8 0v32.3Z" fill="#2EB67D" />
        <path d="M77.5 96.9a12.9 12.9 0 1 1-12.9 12.9V96.9h12.9Z" fill="#ECB22E" />
        <path d="M77.5 90.4a12.9 12.9 0 0 1 0-25.8h32.3a12.9 12.9 0 1 1 0 25.8H77.5Z" fill="#ECB22E" />
      </svg>
    ),
  },
  notion: {
    background: '#fff',
    render: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" role="img">
        <rect x="1.5" y="1.5" width="21" height="21" rx="3" fill="#fff" stroke="#111" strokeWidth="1.6" />
        <path d="M8 17V8l8 8.2V7" stroke="#111" strokeWidth="1.9" fill="none" strokeLinecap="square" />
      </svg>
    ),
  },
  googledrive: {
    background: '#fff',
    render: (s) => (
      <svg width={s} height={s} viewBox="0 0 48 48" role="img">
        <path d="M17.5 6h13l13 22.5h-13L17.5 6Z" fill="#FFCF63" />
        <path d="M4.5 28.5 17.5 6l6.5 11.25L11 39.75 4.5 28.5Z" fill="#0F9D58" />
        <path d="M11 39.75h26l6.5-11.25h-26L11 39.75Z" fill="#4285F4" />
      </svg>
    ),
  },
  jira: {
    background: '#fff',
    render: (s) => (
      <svg width={s} height={s} viewBox="0 0 32 32" role="img">
        <path d="M16 2 29 15l-4.3 4.3L16 10.6 7.3 19.3 3 15 16 2Z" fill="#2684FF" />
        <path d="M16 30 3 17l4.3-4.3L16 21.4l8.7-8.7L29 17 16 30Z" fill="#2684FF" opacity=".55" />
      </svg>
    ),
  },
  confluence: {
    background: '#fff',
    render: (s) => (
      <svg width={s} height={s} viewBox="0 0 32 32" role="img">
        <path d="M3 22c5-8 11-10 18-5l7 4-4 6-7-4c-4-2-7-1-9 2l-5-3Z" fill="#2684FF" />
        <path d="M29 10c-5 8-11 10-18 5l-7-4 4-6 7 4c4 2 7 1 9-2l5 3Z" fill="#2684FF" opacity=".55" />
      </svg>
    ),
  },
  pagerduty: {
    background: '#06AC38',
    render: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" role="img">
        <path d="M7 3h6.5c3.6 0 6 2.2 6 5.6s-2.4 5.7-6 5.7H10V19H7V3Zm3 3v5.3h3.2c1.8 0 3-1 3-2.6S15 6 13.2 6H10Z" fill="#fff" />
      </svg>
    ),
  },
  agent: {
    background: '#F3EEFF',
    render: (s) => <Bot width={s} height={s} color="#7C3AED" strokeWidth={2} />,
  },
  mcp: {
    background: '#EAF1FF',
    render: (s) => <Plug width={s} height={s} color="#2563EB" strokeWidth={2} />,
  },
  database: {
    background: '#E9F7EF',
    render: (s) => <Database width={s} height={s} color="#0F9D58" strokeWidth={2} />,
  },
}

/** Brand colours for the marks that are stood in for, and for new additions. */
const MONOGRAM: Record<string, { background: string; color: string; label?: string }> = {
  github: { background: '#181717', color: '#fff', label: 'GH' },
  postgres: { background: '#336791', color: '#fff', label: 'PG' },
  sap: { background: '#0FAAFF', color: '#fff', label: 'SAP' },
}

const CATEGORY_TINT: Record<string, { background: string; color: string }> = {
  agent: { background: '#F3EEFF', color: '#7C3AED' },
  mcp: { background: '#EAF1FF', color: '#2563EB' },
  database: { background: '#E9F7EF', color: '#0F9D58' },
  saas: { background: '#FFF1E6', color: '#C2410C' },
  knowledge: { background: '#FDECEC', color: '#DC2626' },
}

/**
 * The mark, when we have no SVG for a brand.
 *
 * A brand's own colours are used as the brand publishes them — SAP's white on
 * #0FAAFF measures 2.56:1, below AA, and is left alone deliberately: WCAG
 * exempts text that is part of a logo, the element is `aria-hidden` so no
 * reader announces it, and the connection's name sits beside it at 17:1.
 * Repainting a company's mark to pass a contrast check misrepresents it and
 * helps nobody. The category tints below are ours and do meet AA.
 */
function Monogram({ logo, name, category, size }: Props & { size: number }) {
  const brand = MONOGRAM[logo]
  const tint = CATEGORY_TINT[category ?? ''] ?? { background: '#F1F1F0', color: '#4B5563' }

  const background = brand?.background ?? tint.background
  const color = brand?.color ?? tint.color
  const label = brand?.label ?? initials(name)

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-xl font-semibold"
      style={{
        width: size,
        height: size,
        background,
        color,
        fontSize: Math.round(size * (label.length > 2 ? 0.29 : 0.34)),
        letterSpacing: '0.01em',
      }}
      aria-hidden
    >
      {label}
    </span>
  )
}

/**
 * A monogram for a brand we have no mark for.
 *
 * Spread into characters before slicing, never `slice(0, 2)`: that cuts UTF-16
 * code units, so a name like "A🚀" splits the surrogate pair and renders a
 * lone half as tofu. Companies name connections in their own scripts and with
 * emoji, and a broken glyph is the first thing anyone notices.
 */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return [...words[0]!].slice(0, 2).join('').toUpperCase()
  return ([...words[0]!][0]! + [...words[1]!][0]!).toUpperCase()
}
