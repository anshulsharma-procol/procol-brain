#!/usr/bin/env node
/**
 * Copies the frozen contract into both packages, or checks they have not
 * drifted. `contracts/api.ts` is the only file anyone edits.
 *
 *   node contracts/sync.mjs          write the copies
 *   node contracts/sync.mjs --check  exit 1 if a copy is stale
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'contracts/api.ts')
const targets = [
  join(root, 'backend/src/contract.ts'),
  join(root, 'frontend/src/platform/contract.ts'),
]

const HEADER = `// GENERATED FROM contracts/api.ts — DO NOT EDIT.
// Run \`npm run contract:sync\` at the repo root after editing the contract.
`

const expected = HEADER + readFileSync(source, 'utf8')
const check = process.argv.includes('--check')
let drifted = false

for (const target of targets) {
  let current = null
  try {
    current = readFileSync(target, 'utf8')
  } catch {
    /* missing counts as drifted */
  }

  if (current === expected) continue

  if (check) {
    console.error(`contract drift: ${target.replace(root + '/', '')} does not match contracts/api.ts`)
    drifted = true
  } else {
    writeFileSync(target, expected)
    console.log(`wrote ${target.replace(root + '/', '')}`)
  }
}

if (check && drifted) {
  console.error('\nRun `npm run contract:sync` and commit the result.')
  process.exit(1)
}
if (check) console.log('contract copies are in sync')
