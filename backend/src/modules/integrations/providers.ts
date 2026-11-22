import { Injectable } from '@nestjs/common'
import { call, clip, httpError, ProviderError } from '../messaging/providers'

export { ProviderError }

export interface PublishInput {
  caption: string
  link: string | null
  // A public, fetchable image URL; required for Instagram.
  imageUrl: string | null
  altText: string | null
}

export interface PublishResult {
  providerPostId: string
  permalink: string | null
}

// Meta Graph API for a Facebook Page and its linked Instagram professional account.
// config { pageId, instagramAccountId?, graphVersion? }, secrets { pageAccessToken }.
export interface MetaClient {
  verify(config: Record<string, string>, secrets: Record<string, string>): Promise<string>
  publishFacebook(config: Record<string, string>, secrets: Record<string, string>, post: PublishInput): Promise<PublishResult>
  publishInstagram(config: Record<string, string>, secrets: Record<string, string>, post: PublishInput): Promise<PublishResult>
}

export interface GoogleReview {
  providerReviewId: string
  reviewerName: string
  rating: number
  comment: string | null
  postedAt: Date
  updatedAt: Date
  reply: { comment: string; updatedAt: Date } | null
}

export interface GoogleLocation {
  name: string
  title: string
}

export interface SpecialHourPeriod {
  date: string
  closed: boolean
  opensAt: string | null
  closesAt: string | null
}

// Google Business Profile APIs. config { accountId }, secrets { clientId, clientSecret, refreshToken }.
export interface GoogleClient {
  verify(config: Record<string, string>, secrets: Record<string, string>): Promise<string>
  locations(config: Record<string, string>, secrets: Record<string, string>): Promise<GoogleLocation[]>
  reviews(config: Record<string, string>, secrets: Record<string, string>, location: string): Promise<GoogleReview[]>
  reply(config: Record<string, string>, secrets: Record<string, string>, location: string, providerReviewId: string, comment: string): Promise<{ updatedAt: Date }>
  updateLocation(config: Record<string, string>, secrets: Record<string, string>, location: string, update: { description: string; specialHours: SpecialHourPeriod[] }): Promise<void>
}

export interface PublishingTransport {
  meta: MetaClient
  google: GoogleClient
}

export const PUBLISHING_TRANSPORT = Symbol('PUBLISHING_TRANSPORT')

const metaError = (status: number, body: unknown) => {
  const error = (body as { error?: { code?: number; message?: string } } | null)?.error
  // 190 is an expired or revoked token, 10 / 200 a missing permission.
  if (error?.code === 190 || error?.code === 10 || error?.code === 200) return new ProviderError('auth', `META_${error.code}`, clip(error.message ?? 'Meta refused the access token.'))
  return httpError(status, `META_${error?.code ?? status}`, clip(error?.message ?? `Meta returned HTTP ${status}.`))
}

export class MetaGraphClient implements MetaClient {
  private base(config: Record<string, string>) {
    return `https://graph.facebook.com/${config.graphVersion || 'v21.0'}`
  }

  private async post(url: string, token: string, fields: Record<string, string>) {
    const { status, body } = await call(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...fields, access_token: token }).toString() })
    if (status !== 200) throw metaError(status, body)
    return body as Record<string, string>
  }

  async verify(config: Record<string, string>, secrets: Record<string, string>) {
    const fields = 'name,instagram_business_account{username}'
    const { status, body } = await call(`${this.base(config)}/${encodeURIComponent(config.pageId ?? '')}?fields=${encodeURIComponent(fields)}`, { headers: { Authorization: `Bearer ${secrets.pageAccessToken}` } })
    if (status !== 200) throw metaError(status, body)
    const page = body as { name?: string; instagram_business_account?: { id: string; username?: string } }
    if (config.instagramAccountId && page.instagram_business_account?.id !== config.instagramAccountId) {
      throw new ProviderError('rejected', 'META_INSTAGRAM', 'That Instagram account is not linked to this Facebook Page.')
    }
    const instagram = page.instagram_business_account?.username ? ` · Instagram @${page.instagram_business_account.username}` : ''
    return `${page.name ?? 'Facebook Page'}${instagram}`
  }

  async publishFacebook(config: Record<string, string>, secrets: Record<string, string>, post: PublishInput) {
    const page = encodeURIComponent(config.pageId ?? '')
    const result = post.imageUrl
      ? await this.post(`${this.base(config)}/${page}/photos`, secrets.pageAccessToken!, { url: post.imageUrl, message: post.caption })
      : await this.post(`${this.base(config)}/${page}/feed`, secrets.pageAccessToken!, { message: post.caption, ...(post.link ? { link: post.link } : {}) })
    const id = result.post_id ?? result.id!
    return { providerPostId: id, permalink: `https://www.facebook.com/${id}` }
  }

  // Instagram publishes in two steps: create a media container from the image URL, then publish it.
  async publishInstagram(config: Record<string, string>, secrets: Record<string, string>, post: PublishInput) {
    if (!config.instagramAccountId) throw new ProviderError('rejected', 'META_INSTAGRAM', 'No Instagram account is linked in the Meta connection.')
    if (!post.imageUrl) throw new ProviderError('rejected', 'INSTAGRAM_IMAGE', 'Instagram posts need an image.')
    const account = encodeURIComponent(config.instagramAccountId)
    const container = await this.post(`${this.base(config)}/${account}/media`, secrets.pageAccessToken!, { image_url: post.imageUrl, caption: post.caption, ...(post.altText ? { alt_text: post.altText } : {}) })
    const published = await this.post(`${this.base(config)}/${account}/media_publish`, secrets.pageAccessToken!, { creation_id: container.id! })
    return { providerPostId: published.id!, permalink: null }
  }
}

const STARS: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 }
const TOKEN_TTL_MS = 50 * 60_000

const googleError = (status: number, body: unknown) => {
  const error = (body as { error?: { status?: string; message?: string } | string; error_description?: string } | null)?.error
  if (typeof error === 'string') return new ProviderError(status === 400 || status === 401 ? 'auth' : 'rejected', `GOOGLE_${error.toUpperCase()}`, clip((body as { error_description?: string }).error_description ?? error))
  return httpError(status, `GOOGLE_${error?.status ?? status}`, clip(error?.message ?? `Google returned HTTP ${status}.`))
}

const dateParts = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month, day }
}
const timeParts = (time: string) => ({ hours: Number(time.slice(0, 2)), minutes: Number(time.slice(3, 5)) })

@Injectable()
export class GoogleBusinessClient implements GoogleClient {
  private readonly tokens = new Map<string, { token: string; expires: number }>()

  // An access token from the saved refresh token, reused until shortly before it expires.
  private async token(secrets: Record<string, string>) {
    const cached = this.tokens.get(secrets.refreshToken!)
    if (cached && cached.expires > Date.now()) return cached.token
    const { status, body } = await call('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', client_id: secrets.clientId!, client_secret: secrets.clientSecret!, refresh_token: secrets.refreshToken! }).toString(),
    })
    if (status !== 200) throw googleError(status, body)
    const token = (body as { access_token: string }).access_token
    this.tokens.set(secrets.refreshToken!, { token, expires: Date.now() + TOKEN_TTL_MS })
    return token
  }

  private async request(secrets: Record<string, string>, url: string, init: RequestInit = {}) {
    const { status, body } = await call(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await this.token(secrets)}`, 'Content-Type': 'application/json' } })
    if (status < 200 || status >= 300) throw googleError(status, body)
    return body
  }

  async verify(config: Record<string, string>, secrets: Record<string, string>) {
    const locations = await this.locations(config, secrets)
    return `Google Business Profile · ${locations.length} location${locations.length === 1 ? '' : 's'}`
  }

  async locations(config: Record<string, string>, secrets: Record<string, string>) {
    const found: GoogleLocation[] = []
    let pageToken = ''
    do {
      const url = `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${encodeURIComponent(config.accountId ?? '')}/locations?readMask=name,title&pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
      const body = (await this.request(secrets, url)) as { locations?: Array<{ name: string; title: string }>; nextPageToken?: string }
      found.push(...(body.locations ?? []).map((entry) => ({ name: entry.name, title: entry.title })))
      pageToken = body.nextPageToken ?? ''
    } while (pageToken && found.length < 1000)
    return found
  }

  async reviews(config: Record<string, string>, secrets: Record<string, string>, location: string) {
    const found: GoogleReview[] = []
    let pageToken = ''
    do {
      const url = `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(config.accountId ?? '')}/${location}/reviews?pageSize=50&orderBy=updateTime%20desc${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`
      const body = (await this.request(secrets, url)) as {
        reviews?: Array<{ reviewId: string; reviewer?: { displayName?: string; isAnonymous?: boolean }; starRating: string; comment?: string; createTime: string; updateTime: string; reviewReply?: { comment: string; updateTime: string } }>
        nextPageToken?: string
      }
      for (const review of body.reviews ?? []) {
        found.push({
          providerReviewId: review.reviewId,
          reviewerName: review.reviewer?.isAnonymous ? 'Anonymous reviewer' : review.reviewer?.displayName?.slice(0, 120) || 'Google user',
          rating: STARS[review.starRating] ?? 0,
          comment: review.comment ?? null,
          postedAt: new Date(review.createTime),
          updatedAt: new Date(review.updateTime),
          reply: review.reviewReply ? { comment: review.reviewReply.comment, updatedAt: new Date(review.reviewReply.updateTime) } : null,
        })
      }
      pageToken = body.nextPageToken ?? ''
    } while (pageToken && found.length < 2000)
    return found.filter((review) => review.rating >= 1)
  }

  async reply(config: Record<string, string>, secrets: Record<string, string>, location: string, providerReviewId: string, comment: string) {
    const url = `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(config.accountId ?? '')}/${location}/reviews/${encodeURIComponent(providerReviewId)}/reply`
    const body = (await this.request(secrets, url, { method: 'PUT', body: JSON.stringify({ comment }) })) as { updateTime?: string }
    return { updatedAt: body.updateTime ? new Date(body.updateTime) : new Date() }
  }

  async updateLocation(_config: Record<string, string>, secrets: Record<string, string>, location: string, update: { description: string; specialHours: SpecialHourPeriod[] }) {
    const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${location}?updateMask=profile.description,specialHours`
    const specialHourPeriods = update.specialHours.map((period) => ({
      startDate: dateParts(period.date),
      ...(period.closed ? { closed: true } : { openTime: timeParts(period.opensAt!), closeTime: timeParts(period.closesAt!) }),
    }))
    await this.request(secrets, url, { method: 'PATCH', body: JSON.stringify({ profile: { description: update.description }, specialHours: { specialHourPeriods } }) })
  }
}

@Injectable()
export class DefaultPublishingTransport implements PublishingTransport {
  readonly meta = new MetaGraphClient()
  readonly google = new GoogleBusinessClient()
}
