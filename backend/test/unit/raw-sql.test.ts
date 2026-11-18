import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (name === 'generated') return []
    return statSync(full).isDirectory() ? sourceFiles(full) : full.endsWith('.ts') ? [full] : []
  })
}

// SQL injection guard: raw SQL is only allowed through Prisma's tagged templates, which send every
// interpolated value as a bound parameter. The *Unsafe variants concatenate strings and are banned.
describe('raw SQL', () => {
  it('never uses the Unsafe Prisma query functions', () => {
    const offenders = sourceFiles(SRC).filter((file) => /\$(queryRaw|executeRaw)Unsafe\b|Prisma\.raw\(/.test(readFileSync(file, 'utf8')))
    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([])
  })

  it('only calls $queryRaw / $executeRaw as tagged templates', () => {
    const offenders = sourceFiles(SRC).filter((file) => /\$(queryRaw|executeRaw)(<[^>]*>)?\(/.test(readFileSync(file, 'utf8')))
    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([])
  })
})
