import { Injectable } from '@nestjs/common'
import { hash, parseOptions, verify } from '@node-rs/argon2'

// Argon2id with the OWASP-recommended baseline: 19 MiB memory, 2 passes, 1 lane.
// Argon2id is the library's default algorithm (value 2 in its Algorithm enum).
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const
const ARGON2ID = 2

@Injectable()
export class PasswordService {
  // Checked when an email has no account, so a wrong email takes as long as a wrong password.
  private readonly dummyHash = hash('timing-equaliser-not-a-password', OPTIONS)

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS)
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password)
    } catch {
      // A malformed stored hash must never let someone in.
      return false
    }
  }

  async verifyAgainstDummy(password: string): Promise<void> {
    await this.verify(await this.dummyHash, password)
  }

  // True when the stored hash used weaker settings than today's; it is upgraded at the next sign-in.
  needsRehash(passwordHash: string): boolean {
    try {
      const current = parseOptions(passwordHash)
      return current.algorithm !== ARGON2ID || current.memoryCost < OPTIONS.memoryCost || current.timeCost < OPTIONS.timeCost
    } catch {
      return true
    }
  }
}
