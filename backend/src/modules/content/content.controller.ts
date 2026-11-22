import { Body, Controller, Get, Headers, HttpCode, Param, Patch, Post, Query, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { Client } from '../../common/decorators/client.decorator'
import { badRequest } from '../../common/errors/app-error'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth, Public } from '../auth/auth.decorators'
import { CurrentAccess, OrgFromQuery, RequirePermissions } from '../permissions/access.decorators'
import {
  contentSchema, contentTemplateSchema, decideContentSchema, listContentSchema, resolvePublicationSchema, submitContentSchema, updateContentSchema, updateContentTemplateSchema,
} from './content.schemas'
import { ContentService } from './content.service'
import { MediaService } from './media.service'

const versionBody = z.object({ version: z.number().int().min(1) })
const target = z.enum(['facebook', 'instagram'])
const signedQuery = z.object({ expires: z.coerce.number().int(), signature: z.string().min(10).max(100) })

// Sends an image with headers that let the admin panel (another origin) and Meta show it.
function sendImage(res: Response, image: { mimeType: string; data: Buffer }, cache: string) {
  res.setHeader('Content-Type', image.mimeType)
  res.setHeader('Cache-Control', cache)
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.send(image.data)
}

@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(private readonly media: MediaService) {}

  // The image itself is the request body (Content-Type image/jpeg, image/png or image/webp); the name travels in
  // X-File-Name, URI-encoded.
  @Post()
  @HttpCode(201)
  @RequirePermissions('growth.manage')
  async upload(@Req() req: Request, @Headers('x-file-name') name: string | undefined, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext) {
    if (!Buffer.isBuffer(req.body)) throw badRequest('MEDIA_TYPE', 'Upload a JPEG, PNG or WebP image (at most 5 MB).')
    let fileName = 'image'
    try {
      fileName = name ? decodeURIComponent(name) : 'image'
    } catch {
      // A malformed name is replaced; the image is what matters.
    }
    return { data: await this.media.upload(access, req.body, fileName, auth.userId) }
  }

  // For Meta: no sign-in, but only with a valid, unexpired signature for this image.
  @Get('public/:id')
  @Public()
  async publicImage(@Param('id') id: string, @Query() query: unknown, @Res() res: Response) {
    const { expires, signature } = parse(signedQuery, query)
    sendImage(res, await this.media.readSigned(parse(uuid, id), expires, signature), 'public, max-age=300')
  }

  // For the admin panel's <img> tags, which cannot send the organisation header: it comes as ?orgId=.
  @Get(':id')
  @OrgFromQuery()
  @RequirePermissions('growth.view')
  async image(@Param('id') id: string, @CurrentAccess() access: AccessContext, @Res() res: Response) {
    sendImage(res, await this.media.read(access.orgId, parse(uuid, id)), 'private, max-age=3600')
  }
}

@Controller({ path: 'content', version: '1' })
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  @RequirePermissions('growth.view')
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    const { items, ...meta } = await this.content.list(access, parse(listContentSchema, query))
    return { data: items, meta }
  }

  // The fixed paths are declared before ':id' so they are not read as post ids.
  @Get('templates')
  @RequirePermissions('growth.view')
  async templates(@CurrentAccess() access: AccessContext) {
    return { data: await this.content.templates(access.orgId) }
  }

  @Post('templates')
  @HttpCode(201)
  @RequirePermissions('growth.manage')
  async createTemplate(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.content.createTemplate(access, parse(contentTemplateSchema, body), auth.userId, client) }
  }

  @Patch('templates/:id')
  @RequirePermissions('growth.manage')
  async updateTemplate(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.content.updateTemplate(access, parse(uuid, id), parse(updateContentTemplateSchema, body), auth.userId, client) }
  }

  @Get('owners')
  @RequirePermissions('growth.view')
  async owners(@CurrentAccess() access: AccessContext) {
    return { data: await this.content.owners(access) }
  }

  @Get(':id')
  @RequirePermissions('growth.view')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.content.get(access, parse(uuid, id)) }
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('growth.manage')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.content.create(access, parse(contentSchema, body), auth.userId, client) }
  }

  @Patch(':id')
  @RequirePermissions('growth.manage')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.content.update(access, parse(uuid, id), parse(updateContentSchema, body), auth.userId, client) }
  }

  @Post(':id/submit')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async submit(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.content.submit(access, parse(uuid, id), parse(submitContentSchema, body), auth.userId, client) }
  }

  @Post(':id/decision')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async decide(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.content.decide(access, parse(uuid, id), parse(decideContentSchema, body), auth.userId, client) }
  }

  @Post(':id/withdraw')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async withdraw(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.content.withdraw(access, parse(uuid, id), parse(versionBody, body).version, auth.userId, client) }
  }

  @Post(':id/retry')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async retry(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.content.retry(access, parse(uuid, id), parse(versionBody, body).version, auth.userId, client) }
  }

  @Post(':id/publications/:target/resolve')
  @HttpCode(200)
  @RequirePermissions('growth.manage')
  async resolve(@Param('id') id: string, @Param('target') network: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.content.resolve(access, parse(uuid, id), parse(target, network), parse(resolvePublicationSchema, body), auth.userId, client) }
  }
}
