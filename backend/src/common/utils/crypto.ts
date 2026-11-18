import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

// 256 bits, URL-safe: session cookies and invitation links.
export const generateToken = () => randomBytes(32).toString('base64url')

// Tokens, codes and rate-limit keys are stored only as keyed hashes, so a database leak reveals nothing usable.
export const keyedHash = (pepper: string, value: string) => createHmac('sha256', pepper).update(value).digest('hex')

export function hashesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex')
  const right = Buffer.from(b, 'hex')
  return left.length === right.length && timingSafeEqual(left, right)
}
