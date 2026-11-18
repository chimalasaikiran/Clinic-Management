import { describe, expect, it, vi } from 'vitest'
import type { Request, Response } from 'express'
import { originCheck } from '../../src/common/middleware/origin-check.middleware'

const check = originCheck(['https://app.example.com'], 'session')

function run(method: string, headers: Record<string, string>, cookies: Record<string, string> = {}) {
  const req = { method, cookies, get: (name: string) => headers[name.toLowerCase()] } as unknown as Request
  const json = vi.fn()
  const res = { status: vi.fn(() => ({ json })) } as unknown as Response
  const next = vi.fn()
  check(req, res, next)
  return { allowed: next.mock.calls.length === 1, status: (res.status as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] }
}

describe('origin check (CSRF)', () => {
  it('lets reads through from anywhere', () => {
    expect(run('GET', { origin: 'https://evil.example' }, { session: 'x' }).allowed).toBe(true)
  })

  it('allows changes from the admin panel', () => {
    expect(run('POST', { origin: 'https://app.example.com' }, { session: 'x' }).allowed).toBe(true)
    expect(run('POST', { referer: 'https://app.example.com/roles' }, { session: 'x' }).allowed).toBe(true)
  })

  it('blocks changes from other sites', () => {
    expect(run('POST', { origin: 'https://evil.example' }, { session: 'x' })).toEqual({ allowed: false, status: 403 })
    expect(run('DELETE', { origin: 'https://evil.example' }).allowed).toBe(false)
  })

  it('blocks a cookie-carrying change with no origin at all', () => {
    expect(run('PATCH', {}, { session: 'x' }).allowed).toBe(false)
  })

  it('allows server-to-server calls that carry no session cookie', () => {
    expect(run('POST', {}).allowed).toBe(true)
  })
})
