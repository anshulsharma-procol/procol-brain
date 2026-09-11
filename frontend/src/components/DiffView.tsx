import type { PrArtifact } from '../platform/types'

/**
 * A 30-line diff renderer. A library would be more than this needs: the
 * patch is short by design, and it has to be legible on a projector.
 */
export default function DiffView({ diff }: { diff: PrArtifact['data']['diff'] }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 py-2 font-mono text-[12px] leading-6">
      {diff.map((line, index) => (
        <code
          key={`${index}-${line.text}`}
          className={`block px-3 ${
            line.type === 'add'
              ? 'bg-green-50 text-green-800'
              : line.type === 'remove'
                ? 'bg-red-50 text-red-700'
                : 'text-gray-500'
          }`}
        >
          <span className="select-none text-gray-400">
            {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
          </span>{' '}
          {line.text}
        </code>
      ))}
    </pre>
  )
}
