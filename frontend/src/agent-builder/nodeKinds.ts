import { Brain, Flag, GitBranch, Globe, Plug, Wrench, Zap } from 'lucide-react'
import type { NodeKind } from './types'

interface NodeKindMeta {
  label: string
  hint: string
  icon: typeof Brain
  /** Literal Tailwind arbitrary-value classes so the JIT scanner can see them. */
  tintBg: string
  tintText: string
  defaultTitle: string
  defaultSubtitle: string
}

export const NODE_KIND_META: Record<NodeKind, NodeKindMeta> = {
  trigger: {
    label: 'Trigger',
    hint: 'Start the workflow',
    icon: Zap,
    tintBg: 'bg-[#ecfeff]',
    tintText: 'text-[#0e7490]',
    defaultTitle: 'When a user starts a chat',
    defaultSubtitle: 'Trigger · Chat',
  },
  agent: {
    label: 'Agent',
    hint: 'General-purpose assistant',
    icon: Brain,
    tintBg: 'bg-[#eff6ff]',
    tintText: 'text-[#1d4ed8]',
    defaultTitle: 'Agent',
    defaultSubtitle: 'General-purpose assistant',
  },
  classify: {
    label: 'Classify',
    hint: 'Route by intent',
    icon: GitBranch,
    tintBg: 'bg-[#fef3c7]',
    tintText: 'text-[#b45309]',
    defaultTitle: 'Classify',
    defaultSubtitle: 'Route by intent',
  },
  end: {
    label: 'End',
    hint: 'Finish the workflow',
    icon: Flag,
    tintBg: 'bg-[#dcfce7]',
    tintText: 'text-[#15803d]',
    defaultTitle: 'End',
    defaultSubtitle: 'Finish the workflow',
  },
  mcp: {
    label: 'MCP',
    hint: 'External tool connection',
    icon: Plug,
    tintBg: 'bg-[#fef9c3]',
    tintText: 'text-[#a16207]',
    defaultTitle: 'MCP',
    defaultSubtitle: 'External tool connection',
  },
  custom: {
    label: 'Custom',
    hint: 'Tailored action block',
    icon: Wrench,
    tintBg: 'bg-[#f5f5f4]',
    tintText: 'text-[#57534e]',
    defaultTitle: 'Custom',
    defaultSubtitle: 'Tailored action block',
  },
  web_search: {
    label: 'Web search',
    hint: 'Live web lookup',
    icon: Globe,
    tintBg: 'bg-[#fef9c3]',
    tintText: 'text-[#a16207]',
    defaultTitle: 'Web search',
    defaultSubtitle: 'Live web lookup',
  },
}

export const ADD_NODE_GROUPS: { label: string; kinds: NodeKind[] }[] = [
  { label: 'Core', kinds: ['agent', 'classify', 'end'] },
  { label: 'Tools', kinds: ['mcp', 'custom', 'web_search'] },
]
