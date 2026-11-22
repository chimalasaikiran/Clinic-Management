import { createHmac, timingSafeEqual } from 'node:crypto'

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024
// How long the link Meta fetches an image from stays valid.
export const MEDIA_LINK_TTL_MS = 60 * 60_000

// The image type from the file's first bytes, never from the name or the declared type.
export function sniffImage(bytes: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp'
  return null
}

// A link to one image that only works until `expires` (ms since epoch). The key is separate from the one that
// encrypts credentials: it is derived from it with a fixed label.
export function mediaSignature(secretKey: Buffer, mediaId: string, expires: number) {
  const key = createHmac('sha256', secretKey).update('clinicos-media-link').digest()
  return createHmac('sha256', key).update(`${mediaId}.${expires}`).digest('base64url')
}

export function mediaLinkValid(secretKey: Buffer, mediaId: string, expires: number, signature: string, now = Date.now()) {
  if (!Number.isFinite(expires) || expires < now) return false
  const expected = Buffer.from(mediaSignature(secretKey, mediaId, expires))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given)
}

// The text published: the caption, then the call to action and its link.
export function publishedCaption(caption: string, cta: string, url: string) {
  return `${caption.trim()}\n\n${cta.trim()}: ${url.trim()}`
}

// Public text must not carry personal or clinical detail: a phone number, an email address, or words that confirm
// someone's care. Returns what was found, in words.
const SENSITIVE: Array<[RegExp, string]> = [
  [/(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/, 'a phone number'],
  [/\b[\w.+-]+@[\w-]+\.[\w.]+\b/, 'an email address'],
  [/\b(diagnos\w*|prescri\w*|treatment|surgery|medicine|medication|your (visit|appointment) on|test results?|your condition)\b/i, 'clinical wording'],
]

export function privacyFindings(text: string): string[] {
  return SENSITIVE.filter(([pattern]) => pattern.test(text)).map(([, label]) => label)
}
