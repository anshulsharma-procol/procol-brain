/**
 * A unified diff, rendered red/green.
 *
 * The contract sends `diff` as one string, so this parses it rather than
 * taking a pre-split array — about thirty lines, which is less than the cost
 * of a dependency and enough for a patch that has to be legible on a
 * projector.
 */
export default function DiffView({ diff }: { diff: string }) {
  const lines = diff.split('\n')

  return (
    <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 py-2 font-mono text-[12px] leading-6">
      {lines.map((line, index) => {
        const kind = classify(line)

        return (
          <code
            key={`${index}-${line}`}
            className={`block px-3 ${
              kind === 'add'
                ? 'bg-green-50 text-green-800'
                : kind === 'remove'
                  ? 'bg-red-50 text-red-700'
                  : kind === 'meta'
                    ? 'text-gray-400'
                    : 'text-gray-500'
            }`}
          >
            {line || ' '}
          </code>
        )
      })}
    </pre>
  )
}

function classify(line: string): 'add' | 'remove' | 'meta' | 'context' {
  // File headers first: `+++` and `---` start with the same characters as an
  // added or removed line and would otherwise paint the whole header green.
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('@@')) return 'meta'
  if (line.startsWith('+')) return 'add'
  if (line.startsWith('-')) return 'remove'
  return 'context'
}
