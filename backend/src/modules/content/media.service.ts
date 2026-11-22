import { Inject, Injectable } from '@nestjs/common'
import { notFound, unprocessable } from '../../common/errors/app-error'
import type { AccessContext } from '../../common/utils/request'
import { ENV, Env } from '../../config/env'
import { PrismaService } from '../../database/prisma.service'
import { MAX_MEDIA_BYTES, MEDIA_LINK_TTL_MS, mediaLinkValid, mediaSignature, sniffImage } from './content.logic'

// Post images, kept in Postgres. Staff see them through the signed-in API; Meta fetches them through a signed link
// that expires after an hour.
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get key() {
    return this.env.MESSAGING_SECRET_KEY ? Buffer.from(this.env.MESSAGING_SECRET_KEY, 'base64') : null
  }

  async upload(access: AccessContext, bytes: Buffer, fileName: string, actorUserId: string) {
    if (!bytes.length) throw unprocessable('MEDIA_EMPTY', 'Choose an image to upload.')
    if (bytes.length > MAX_MEDIA_BYTES) throw unprocessable('MEDIA_TOO_LARGE', 'Use an image of at most 5 MB.')
    const mimeType = sniffImage(bytes)
    if (!mimeType) throw unprocessable('MEDIA_TYPE', 'Upload a JPEG, PNG or WebP image.')
    const created = await this.prisma.mediaAsset.create({
      data: { orgId: access.orgId, fileName: fileName.replace(/[^\w.\- ]/g, '_').slice(0, 200) || 'image', mimeType, size: bytes.length, data: new Uint8Array(bytes), createdById: actorUserId },
      select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true },
    })
    return created
  }

  async read(orgId: string, id: string) {
    const row = await this.prisma.mediaAsset.findFirst({ where: { id, orgId }, select: { mimeType: true, data: true } })
    if (!row) throw notFound('Image not found.')
    return { mimeType: row.mimeType, data: Buffer.from(row.data) }
  }

  // For Meta: a link that works without signing in, only for this image and only for an hour.
  publicUrl(id: string, now = Date.now()) {
    if (!this.env.PUBLIC_API_URL || !this.key) return null
    const expires = now + MEDIA_LINK_TTL_MS
    return `${this.env.PUBLIC_API_URL.replace(/\/$/, '')}/v1/media/public/${id}?expires=${expires}&signature=${mediaSignature(this.key, id, expires)}`
  }

  async readSigned(id: string, expires: number, signature: string) {
    if (!this.key || !mediaLinkValid(this.key, id, expires, signature)) throw notFound('Image not found.')
    const row = await this.prisma.mediaAsset.findUnique({ where: { id }, select: { mimeType: true, data: true } })
    if (!row) throw notFound('Image not found.')
    return { mimeType: row.mimeType, data: Buffer.from(row.data) }
  }
}
