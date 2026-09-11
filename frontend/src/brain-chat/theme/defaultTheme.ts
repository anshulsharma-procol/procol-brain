import type { ProcolBrainTheme } from '../types/config'

/**
 * Minimalist enterprise SaaS defaults: white surfaces, hairline greys,
 * a soft blue accent, green for success and a restrained purple for AI.
 */
export const defaultTheme: Required<ProcolBrainTheme> = {
  primaryColor: '#2563eb',
  primaryTextColor: '#ffffff',
  backgroundColor: '#ffffff',
  surfaceColor: '#f8fafc',
  textColor: '#0f172a',
  mutedTextColor: '#64748b',
  borderColor: '#e2e8f0',
  successColor: '#16a34a',
  aiColor: '#7c3aed',
  borderRadius: 16,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  shadow: '0 12px 32px -8px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.06)',
  zIndex: 2147483000,
}
