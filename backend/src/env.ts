import { z } from 'zod'

/**
 * Environment, validated at boot. It fails loudly on start rather than
 * silently at 3am, which is the only reason this file exists.
 */
const schema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  AGENT_MODE: z.enum(['mounted', 'separate']).default('mounted'),
  AGENT_URLS: z
    .string()
    .default('http://localhost:4101,http://localhost:4102,http://localhost:4103'),
  CORS_ORIGIN: z.string().default('*'),
  RUN_SPEED: z.coerce.number().positive().default(1),
  STATE_FILE: z.string().default('.state.json'),
  A2A_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment:\n' + parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'))
  process.exit(1)
}

export const env = {
  ...parsed.data,
  agentUrls: parsed.data.AGENT_URLS.split(',').map((url) => url.trim()).filter(Boolean),
  corsOrigins: parsed.data.CORS_ORIGIN === '*' ? true : parsed.data.CORS_ORIGIN.split(',').map((o) => o.trim()),
  stateFile: parsed.data.STATE_FILE.trim() || undefined,
}
