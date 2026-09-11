import { useState } from 'react'
import type { SVGProps } from 'react'
import type { AgentActivity, AgentDescriptor, AgentId } from '../../types/a2a'
import { AGENT_REGISTRY } from '../../data/demoScenario'
import shared from './ProcolBrain.module.css'
import styles from './AgentActivityFeed.module.css'

export interface AgentActivityFeedProps {
  /** Hops revealed so far, oldest first. */
  entries: AgentActivity[]
  /**
   * Registry used for names and avatars. Defaults to the bundled roster so the
   * feed still reads well before a host wires `GET /agents` up; pass the live
   * registry to show whichever agents the backend actually routes to.
   */
  agents?: AgentDescriptor[]
  title?: string
}

/**
 * The live Brain <-> agent conversation.
 *
 * Two protocols share one timeline and the difference is the point of the
 * architecture, so it is spelled out rather than implied: A2A rows are one
 * agent delegating to another, MCP rows are an agent reaching for an external
 * tool and carry the server plus the call it made. Both carry a text tag, so
 * the distinction survives greyscale, colour-blindness and a screen reader.
 */
export function AgentActivityFeed({
  entries,
  agents = AGENT_REGISTRY,
  title = 'Agent collaboration',
}: AgentActivityFeedProps) {
  // Rows already present on mount are history, not news. Held in state so the
  // count is captured once: only later arrivals get the appear animation, and
  // re-opening a resolved ticket never replays the whole conversation.
  const [settledCount] = useState(entries.length)

  if (entries.length === 0) return null

  return (
    <section className={shared.card} aria-label={title}>
      <div className={shared.cardTop}>
        <h3 className={shared.cardTitle}>{title}</h3>
        <span className={styles.count}>
          {entries.length === 1 ? '1 exchange' : `${entries.length} exchanges`}
        </span>
      </div>

      <ol className={styles.list} role="list">
        {entries.map((entry, index) => {
          const isTool = entry.via === 'MCP'
          const sender = describeParty(entry.from, agents)
          // An MCP hop points at a server, not an agent, so the tool binding
          // names the recipient whenever the backend sends one.
          const recipient = isTool
            ? toolParty(entry.tool?.server ?? entry.to)
            : describeParty(entry.to, agents)
          const time = entry.at ? formatTime(entry.at) : ''

          const rowClassName = [
            styles.row,
            isTool ? styles.rowTool : '',
            index >= settledCount ? styles.rowNew : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <li key={entry.id} className={rowClassName}>
              <div className={styles.hop}>
                <span className={styles.party}>
                  <PartyAvatar party={sender} />
                  <span className={styles.partyName}>{sender.name}</span>
                </span>

                <ArrowRightIcon className={styles.arrow} />
                <span className={shared.srOnly}>to</span>

                <span className={`${styles.party} ${isTool ? styles.partyTool : ''}`}>
                  <PartyAvatar party={recipient} />
                  <span className={styles.partyName}>{recipient.name}</span>
                </span>

                <span className={`${styles.tag} ${isTool ? styles.tagTool : ''}`}>
                  {isTool ? 'MCP' : 'A2A'}
                  <span className={shared.srOnly}> {kindLabel(entry.kind)}</span>
                </span>

                {time && (
                  <time className={styles.time} dateTime={entry.at}>
                    {time}
                  </time>
                )}
              </div>

              {isTool && entry.tool && (
                <div className={styles.toolLine}>
                  <span className={styles.toolLabel}>Tool call</span>
                  <code className={styles.toolCall}>{entry.tool.call}</code>
                </div>
              )}

              <p className={styles.text}>{entry.text}</p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/* ------------------------------------------------------------------ parties */

interface Party {
  name: string
  /** Emoji or image URL, when the registry supplies one. */
  avatar?: string
  initials: string
  tool?: boolean
}

/** Emoji, logo or initials - whatever the registry gives us, never nothing. */
function PartyAvatar({ party }: { party: Party }) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      {party.tool ? (
        <ServerIcon width={10} height={10} />
      ) : party.avatar && isImageSource(party.avatar) ? (
        <img className={styles.avatarImage} src={party.avatar} alt="" />
      ) : (
        (party.avatar ?? party.initials)
      )}
    </span>
  )
}

function describeParty(id: AgentId, agents: AgentDescriptor[]): Party {
  const agent = agents.find((candidate) => candidate.id === id)
  const name = agent?.name ?? humaniseId(id)
  return { name, avatar: agent?.avatar, initials: initialsOf(name) }
}

/** MCP servers are not agents, so they get the id verbatim and a tool glyph. */
function toolParty(server: string): Party {
  return { name: server, initials: initialsOf(server), tool: true }
}

/** `dev-agent` -> `Dev Agent`, for ids the registry does not know about. */
function humaniseId(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) =>
      word.length <= 2 ? word.toUpperCase() : `${(word[0] ?? '').toUpperCase()}${word.slice(1)}`,
    )
    .join(' ')
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const first = words[0] ?? ''
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : ''
  return `${first.slice(0, 1)}${last.slice(0, 1)}`.toUpperCase() || '?'
}

function isImageSource(avatar: string): boolean {
  return /^(https?:\/\/|data:|\/)/.test(avatar)
}

/** Read out after the protocol tag, so "MCP" is never colour-only. */
function kindLabel(kind: AgentActivity['kind']): string {
  if (kind === 'response') return 'reply'
  if (kind === 'tool') return 'tool call'
  return 'request'
}

/** Locale time, no formatting dependency. Empty for anything unparseable. */
function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

/* -------------------------------------------------------------------- icons */

type IconProps = SVGProps<SVGSVGElement>

/** Mirrors `icons.tsx`; kept local because only the feed needs these two. */
const base = (props: IconProps): IconProps => ({
  width: 12,
  height: 12,
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

function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 8h11" />
      <path d="M9.5 4.5 13 8l-3.5 3.5" />
    </svg>
  )
}

function ServerIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="2.5" width="12" height="5" rx="1.5" />
      <rect x="2" y="8.5" width="12" height="5" rx="1.5" />
      <path d="M4.5 5h.01M4.5 11h.01" />
    </svg>
  )
}
