import { Prisma } from '../generated/prisma/client'

// P2002: a unique constraint rejected the write (for example a duplicate role name or email).
export const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'

// Name of the database constraint a write broke (check or exclusion constraints), or null. Postgres puts the
// constraint name in its message, and Prisma passes that message through in the error or its cause.
export function violatedConstraint(error: unknown, names: readonly string[]): string | null {
  if (!(error instanceof Error)) return null
  const seen = new Set<unknown>()
  const texts: string[] = []
  let current: unknown = error
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current)
    texts.push(current.message)
    const meta = (current as { meta?: unknown }).meta
    if (meta) texts.push(JSON.stringify(meta))
    current = (current as { cause?: unknown }).cause
  }
  const text = texts.join(' ')
  return names.find((name) => text.includes(name)) ?? null
}
