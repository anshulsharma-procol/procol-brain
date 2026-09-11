import type { SVGProps } from 'react'

/** Inline icons - keeps the package dependency-free. */
type IconProps = SVGProps<SVGSVGElement>

const base = (props: IconProps): IconProps => ({
  width: 16,
  height: 16,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
  ...props,
})

export function ChatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 9.5A2.5 2.5 0 0 1 11.5 12H5l-3 2.5V4.5A2.5 2.5 0 0 1 4.5 2h7A2.5 2.5 0 0 1 14 4.5z" />
    </svg>
  )
}

export function BrainMarkIcon(props: IconProps) {
  return (
    <svg {...base(props)} viewBox="0 0 16 16">
      <path d="M8 1.5 9.4 5l3.6 1.3L9.4 7.6 8 11 6.6 7.6 3 6.3 6.6 5z" />
      <path d="M12.5 10.5 13 12l1.5.5L13 13l-.5 1.5L12 13l-1.5-.5L12 12z" />
    </svg>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base(props)} strokeWidth={2}>
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m4 4 8 8M12 4l-8 8" />
    </svg>
  )
}

export function MinimizeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8.5h8" />
    </svg>
  )
}

export function SendIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 2 7 9" />
      <path d="M14 2 9.5 14l-2.3-5-5-2.3z" />
    </svg>
  )
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10.5 10.5 3 3" />
    </svg>
  )
}
