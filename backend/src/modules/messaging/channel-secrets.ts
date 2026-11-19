import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

// Channel credentials at rest: AES-256-GCM with a random 96-bit nonce, stored as "v1.<iv>.<tag>.<ciphertext>"
// (base64url). The tag makes a tampered or wrongly keyed value fail to decrypt instead of returning garbage.

export function sealSecret(key: Buffer, value: Record<string, string>): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return ['v1', iv, cipher.getAuthTag(), data].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.')
}

export function openSecret(key: Buffer, sealed: string): Record<string, string> {
  const [version, iv, tag, data] = sealed.split('.')
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unrecognised secret format')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  const plain = Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()])
  return JSON.parse(plain.toString('utf8')) as Record<string, string>
}
