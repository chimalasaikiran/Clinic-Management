import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { mediaLinkValid, mediaSignature, privacyFindings, publishedCaption, sniffImage } from '../../src/modules/content/content.logic'
import { contentSchema, decideContentSchema } from '../../src/modules/content/content.schemas'
import { byDay, reputationMetrics } from '../../src/modules/reviews/reviews.logic'
import { profileSchema } from '../../src/modules/reviews/reviews.schemas'

describe('media', () => {
  it('recognises images by their first bytes, not their name', () => {
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImage(Buffer.from('89504e470d0a1a0a0000', 'hex'))).toBe('image/png')
    expect(sniffImage(Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'latin1'))).toBe('image/webp')
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull()
  })

  it('signs image links for one image and a limited time', () => {
    const key = randomBytes(32)
    const expires = Date.now() + 60_000
    const signature = mediaSignature(key, 'm-1', expires)
    expect(mediaLinkValid(key, 'm-1', expires, signature)).toBe(true)
    expect(mediaLinkValid(key, 'm-2', expires, signature)).toBe(false)
    expect(mediaLinkValid(key, 'm-1', expires + 1, signature)).toBe(false)
    expect(mediaLinkValid(randomBytes(32), 'm-1', expires, signature)).toBe(false)
    expect(mediaLinkValid(key, 'm-1', expires, signature, expires + 1)).toBe(false)
  })
})

describe('content', () => {
  it('publishes the caption followed by the call to action and its link', () => {
    expect(publishedCaption(' Plan your check. ', 'Enquire', 'https://aura.example')).toBe('Plan your check.\n\nEnquire: https://aura.example')
  })

  it('needs a network, an https link and alt text; a rejection needs a reason', () => {
    const base = { title: 'T', category: 'Prevention', branchId: '0195d7a0-0000-7000-8000-000000000001', ownerMembershipId: '0195d7a0-0000-7000-8000-000000000002', caption: 'C', targets: ['facebook', 'facebook'], cta: 'Go', url: 'https://aura.example', altText: 'A', date: '2026-12-01', time: '10:00' }
    expect(contentSchema.parse(base).targets).toEqual(['facebook'])
    expect(contentSchema.safeParse({ ...base, targets: [] }).success).toBe(false)
    expect(contentSchema.safeParse({ ...base, url: 'http://aura.example' }).success).toBe(false)
    expect(contentSchema.safeParse({ ...base, altText: ' ' }).success).toBe(false)
    expect(decideContentSchema.safeParse({ decision: 'reject', version: 1 }).success).toBe(false)
    expect(decideContentSchema.safeParse({ decision: 'approve', version: 1 }).success).toBe(true)
  })
})

describe('review replies', () => {
  it('finds phone numbers, emails and clinical wording in public text', () => {
    expect(privacyFindings('Call 98480 22110 or +91-9848022110')).toEqual(['a phone number'])
    expect(privacyFindings('Write to front.desk@aura.example')).toEqual(['an email address'])
    expect(privacyFindings('We reviewed your treatment plan.')).toEqual(['clinical wording'])
    expect(privacyFindings('Thank you for your feedback. We have updated our opening hours.')).toEqual([])
  })
})

describe('branch profile', () => {
  const base = { businessName: 'Aura', street: 'Plot 42', city: 'Hyderabad', state: 'Telangana', postalCode: '500033', primaryCategory: 'Medical clinic' }

  it('checks the PIN code, links and special hours', () => {
    expect(profileSchema.parse(base)).toMatchObject({ specialHours: [], reviewUrl: null, googleLocation: null, description: '' })
    expect(profileSchema.safeParse({ ...base, postalCode: '050033' }).success).toBe(false)
    expect(profileSchema.safeParse({ ...base, googleLocation: 'accounts/1/locations/2' }).success).toBe(false)
    expect(profileSchema.safeParse({ ...base, specialHours: [{ date: '2026-12-25', closed: true }] }).success).toBe(true)
    expect(profileSchema.safeParse({ ...base, specialHours: [{ date: '2026-12-25', opensAt: '10:00' }] }).success).toBe(false)
    expect(profileSchema.safeParse({ ...base, specialHours: [{ date: '2026-12-25', closed: true }, { date: '2026-12-25', closed: true }] }).success).toBe(false)
  })
})

describe('reputation report', () => {
  const at = (iso: string) => new Date(iso)

  it('reports volume, average, distribution and the median time to reply', () => {
    const metrics = reputationMetrics([
      { rating: 5, postedAt: at('2026-11-01T04:00:00Z'), publicReplyAt: at('2026-11-01T06:00:00Z') },
      { rating: 2, postedAt: at('2026-11-02T04:00:00Z'), publicReplyAt: at('2026-11-03T04:00:00Z') },
      { rating: 4, postedAt: at('2026-11-02T10:00:00Z'), publicReplyAt: null },
    ])
    expect(metrics).toMatchObject({ total: 3, average: 3.7, replied: 2, medianReplyHours: 13 })
    expect(metrics.distribution.find((entry) => entry.star === 2)!.count).toBe(1)
    expect(reputationMetrics([])).toMatchObject({ total: 0, average: null, medianReplyHours: null })
  })

  it('counts reviews per clinic day', () => {
    const local = (instant: Date) => instant.toISOString().slice(0, 10)
    expect(byDay([{ rating: 5, postedAt: at('2026-11-02T04:00:00Z'), publicReplyAt: null }, { rating: 4, postedAt: at('2026-11-01T04:00:00Z'), publicReplyAt: null }, { rating: 3, postedAt: at('2026-11-02T09:00:00Z'), publicReplyAt: null }], local))
      .toEqual([{ date: '2026-11-01', count: 1 }, { date: '2026-11-02', count: 2 }])
  })
})
