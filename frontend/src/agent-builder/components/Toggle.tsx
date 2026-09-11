interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  label?: string
  hint?: string
}

/** 30x18px pill switch — matches the reference builder's toggle rows. */
export default function Toggle({ checked, onChange, label, hint }: ToggleProps) {
  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors ${
        checked ? 'bg-[#1375e4]' : 'bg-[#dee2e6]'
      }`}
    >
      <span
        className="absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all"
        style={{ left: checked ? '14px' : '2px' }}
      />
    </button>
  )

  if (!label) return track

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      {track}
    </div>
  )
}
