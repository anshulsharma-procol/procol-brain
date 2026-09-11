import { useState } from 'react'
import { ConsoleApp } from './ConsoleApp'
import { ShowcasePage } from './ShowcasePage'

type View = 'console' | 'showcase'

/** Dev shell: the embedded experience, and a gallery of every widget state. */
export function DemoApp() {
  const [view, setView] = useState<View>('console')

  return (
    <div className="demo">
      <div className="demo__tabs" role="tablist" aria-label="Demo views">
        {(
          [
            ['console', 'Embedded in host app'],
            ['showcase', 'UI states'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={view === id ? 'demo__tab demo__tab--active' : 'demo__tab'}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'console' ? <ConsoleApp /> : <ShowcasePage />}
    </div>
  )
}
