import { hash } from '@node-rs/argon2'
import { describe, expect, it } from 'vitest'
import { PasswordService } from '../../src/modules/auth/password.service'

const passwords = new PasswordService()

describe('PasswordService', () => {
  it('stores Argon2id hashes with the OWASP baseline parameters and a random salt', async () => {
    const first = await passwords.hash('Clinic2026')
    const second = await passwords.hash('Clinic2026')
    expect(first).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    expect(first).not.toContain('Clinic2026')
    expect(first).not.toBe(second)
  })

  it('verifies the right password and rejects others', async () => {
    const stored = await passwords.hash('Clinic2026')
    expect(await passwords.verify(stored, 'Clinic2026')).toBe(true)
    expect(await passwords.verify(stored, 'clinic2026')).toBe(false)
    expect(await passwords.verify(stored, '')).toBe(false)
  })

  it('never accepts a malformed stored hash', async () => {
    expect(await passwords.verify('not-a-hash', 'anything')).toBe(false)
    expect(await passwords.verify('', '')).toBe(false)
  })

  it('asks for a rehash only when the stored parameters are weaker than today', async () => {
    expect(passwords.needsRehash(await passwords.hash('Clinic2026'))).toBe(false)
    expect(passwords.needsRehash(await hash('Clinic2026', { memoryCost: 4096, timeCost: 1 }))).toBe(true)
    expect(passwords.needsRehash('garbage')).toBe(true)
  })

  it('can run a dummy verification for unknown accounts', async () => {
    await expect(passwords.verifyAgainstDummy('whatever')).resolves.toBeUndefined()
  })
})
