import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { parseEnv } from 'node:util'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string
  }
}

const ROOT = path.resolve(import.meta.dirname, '../..')

// "ep-name-123-pooler.region.aws.neon.tech/neondb" and the direct host for the same branch compare equal.
const target = (url: string) => {
  const parsed = new URL(url)
  return `${parsed.hostname.replace('-pooler.', '.')}${parsed.pathname}`
}

// Integration tests run against a separate Neon branch (or database) and delete everything in it.
// They refuse to start unless that target is configured and is not the database the API normally uses.
export default function setup(project: TestProject) {
  const envFile = path.join(ROOT, 'backend.env')
  const file = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}
  const value = (name: string) => process.env[name] || file[name] || undefined

  const databaseUrl = value('TEST_DATABASE_URL')
  const directUrl = value('TEST_DIRECT_URL') ?? databaseUrl
  if (!databaseUrl || !directUrl) {
    throw new Error('Integration tests need a separate Neon test branch: set TEST_DATABASE_URL and TEST_DIRECT_URL in backend/backend.env (README, "Tests").')
  }
  const main = [value('DATABASE_URL'), value('DIRECT_URL')].filter((url): url is string => Boolean(url)).map(target)
  if ([databaseUrl, directUrl].some((url) => main.includes(target(url)))) {
    throw new Error('TEST_DATABASE_URL points at the main database. Use a separate Neon branch for tests; they delete all data.')
  }

  // Apply the same migrations production uses, so tests run against the real schema.
  const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js')
  execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: ROOT,
    env: { ...process.env, DIRECT_URL: directUrl, SKIP_ENV_FILE: '1' },
    stdio: 'inherit',
  })

  project.provide('databaseUrl', databaseUrl)
}
