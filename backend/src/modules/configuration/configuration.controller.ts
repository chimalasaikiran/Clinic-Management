import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { Client } from '../../common/decorators/client.decorator'
import { badRequest } from '../../common/errors/app-error'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, OrgFromQuery, OrgMember, RequireAnyPermission, RequirePermissions } from '../permissions/access.decorators'
import {
  acceptanceSchema, agreementSchema, agreementStateSchema, closureSchema, contactSchema, createBranchSchema, createDepartmentSchema, departmentMembersSchema, hoursSchema, operationsSchema, organisationSchema,
  partnerActiveSchema, partnerSchema, specialtiesSchema, updateAgreementSchema, updateBranchSchema, updateDepartmentSchema,
} from './configuration.schemas'
import { DepartmentsService } from './departments.service'
import { InsuranceService } from './insurance.service'
import { OrganisationConfigService } from './organisation-config.service'

const fileName = (header: string | undefined, fallback: string) => {
  try {
    return header ? decodeURIComponent(header) : fallback
  } catch {
    return fallback
  }
}
const statusQuery = z.object({ status: z.enum(['active', 'inactive']).optional() })

@Controller({ path: 'organisation', version: '1' })
export class OrganisationController {
  constructor(private readonly organisation: OrganisationConfigService) {}

  @Get()
  @OrgMember()
  async profile(@CurrentAccess() access: AccessContext) {
    return { data: await this.organisation.profile(access.orgId) }
  }

  @Patch()
  @RequirePermissions('settings.organisation')
  async update(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.organisation.update(access, parse(organisationSchema, body), auth.userId, client) }
  }

  // Onboarding steps after "Clinic profile".
  @Put('contact')
  @RequirePermissions('settings.organisation')
  async contact(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.organisation.saveContact(access, parse(contactSchema, body), auth.userId, client) }
  }

  @Put('operations')
  @RequirePermissions('settings.organisation')
  async operations(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.organisation.saveOperations(access, parse(operationsSchema, body), auth.userId, client) }
  }

  @Put('specialties')
  @RequirePermissions('settings.organisation')
  async specialties(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.organisation.saveSpecialties(access, parse(specialtiesSchema, body), auth.userId, client) }
  }

  @Post('complete')
  @HttpCode(200)
  @RequirePermissions('settings.organisation')
  async complete(@CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.organisation.complete(access, auth.userId, client) }
  }

  // The logo is the raw request body (PNG, JPEG or WebP, at most 5 MB); its name travels in X-File-Name.
  @Put('logo')
  @RequirePermissions('settings.organisation')
  async uploadLogo(@Req() req: Request, @Headers('x-file-name') name: string | undefined, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    if (!Buffer.isBuffer(req.body)) throw badRequest('MEDIA_TYPE', 'Upload a PNG, JPEG or WebP image (at most 5 MB).')
    return { data: await this.organisation.uploadLogo(access, req.body, fileName(name, 'logo'), auth.userId, client) }
  }

  // For <img> tags, which cannot send the organisation header: it comes as ?orgId=.
  @Get('logo')
  @OrgFromQuery()
  @OrgMember()
  async logo(@CurrentAccess() access: AccessContext, @Res() res: Response) {
    const logo = await this.organisation.logo(access.orgId)
    res.setHeader('Content-Type', logo.mimeType)
    res.setHeader('Cache-Control', 'private, max-age=300')
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    res.send(logo.data)
  }
}

@Controller({ path: 'configuration/branches', version: '1' })
export class BranchesController {
  constructor(private readonly organisation: OrganisationConfigService) {}

  @Get()
  @RequirePermissions('branches.view')
  async list(@CurrentAccess() access: AccessContext) {
    return { data: await this.organisation.branches(access) }
  }

  @Get(':id')
  @RequirePermissions('branches.view')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.organisation.branch(access, parse(uuid, id)) }
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('branches.create')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.organisation.createBranch(access, parse(createBranchSchema, body), auth.userId, client) }
  }

  @Patch(':id')
  @RequirePermissions('settings.organisation')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.organisation.updateBranch(access, parse(uuid, id), parse(updateBranchSchema, body), auth.userId, client) }
  }

  @Put(':id/hours')
  @RequirePermissions('branches.hours')
  async hours(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.organisation.setHours(access, parse(uuid, id), parse(hoursSchema, body), auth.userId, client) }
  }

  @Post(':id/closures')
  @HttpCode(201)
  @RequirePermissions('branches.hours')
  async addClosure(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.organisation.addClosure(access, parse(uuid, id), parse(closureSchema, body), auth.userId, client) }
  }

  @Delete(':id/closures/:closureId')
  @RequirePermissions('branches.hours')
  async removeClosure(@Param('id') id: string, @Param('closureId') closureId: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.organisation.removeClosure(access, parse(uuid, id), parse(uuid, closureId), auth.userId, client) }
  }
}

@Controller({ path: 'departments', version: '1' })
export class DepartmentsController {
  constructor(private readonly departments: DepartmentsService) {}

  // Any member: the staff, doctor and service forms choose from this list.
  @Get()
  @OrgMember()
  async list(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.departments.list(access.orgId, parse(statusQuery, query).status) }
  }

  @Get(':id')
  @RequirePermissions('branches.view')
  async get(@Param('id') id: string, @CurrentAccess() access: AccessContext) {
    return { data: await this.departments.get(access.orgId, parse(uuid, id)) }
  }

  @Post()
  @HttpCode(201)
  @RequirePermissions('settings.organisation')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.departments.create(access, parse(createDepartmentSchema, body), auth.userId, client) }
  }

  @Patch(':id')
  @RequirePermissions('settings.organisation')
  async update(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.departments.update(access, parse(uuid, id), parse(updateDepartmentSchema, body), auth.userId, client) }
  }

  @Post(':id/members')
  @HttpCode(200)
  @RequirePermissions('settings.organisation')
  async addMembers(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.departments.assignMembers(access, parse(uuid, id), parse(departmentMembersSchema, body), auth.userId, client) }
  }
}

@Controller({ path: 'insurance', version: '1' })
export class InsuranceController {
  constructor(private readonly insurance: InsuranceService) {}

  @Get()
  @RequireAnyPermission('settings.organisation', 'accounting.invoices')
  async overview(@CurrentAccess() access: AccessContext) {
    return { data: await this.insurance.overview(access.orgId) }
  }

  @Put('acceptance')
  @RequirePermissions('settings.organisation')
  async acceptance(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.insurance.setAcceptance(access, parse(acceptanceSchema, body).accepts, auth.userId, client) }
  }

  @Post('partners')
  @HttpCode(201)
  @RequirePermissions('settings.organisation')
  async addPartner(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.insurance.addPartner(access, parse(partnerSchema, body), auth.userId, client) }
  }

  @Patch('partners/:id')
  @RequirePermissions('settings.organisation')
  async partner(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.insurance.setPartnerActive(access, parse(uuid, id), parse(partnerActiveSchema, body).active, auth.userId, client) }
  }

  // The PDF is the raw request body (Content-Type application/pdf, at most 10 MB).
  @Post('documents')
  @HttpCode(201)
  @RequirePermissions('settings.organisation')
  async upload(@Req() req: Request, @Headers('x-file-name') name: string | undefined, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext) {
    if (!Buffer.isBuffer(req.body)) throw badRequest('DOCUMENT_TYPE', 'Upload the agreement as a PDF (at most 10 MB).')
    return { data: await this.insurance.uploadDocument(access, req.body, fileName(name, 'agreement.pdf'), auth.userId) }
  }

  @Get('documents/:id')
  @OrgFromQuery()
  @RequireAnyPermission('settings.organisation', 'accounting.invoices')
  async document(@Param('id') id: string, @CurrentAccess() access: AccessContext, @Res() res: Response) {
    const document = await this.insurance.document(access.orgId, parse(uuid, id))
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${document.fileName.replace(/"/g, '')}"`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.send(document.data)
  }

  @Post('agreements')
  @HttpCode(201)
  @RequirePermissions('settings.organisation')
  async createAgreement(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.insurance.createAgreement(access, parse(agreementSchema, body), auth.userId, client) }
  }

  @Patch('agreements/:id')
  @RequirePermissions('settings.organisation')
  async updateAgreement(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.insurance.updateAgreement(access, parse(uuid, id), parse(updateAgreementSchema, body), auth.userId, client) }
  }

  @Post('agreements/:id/activate')
  @HttpCode(200)
  @RequirePermissions('settings.organisation')
  async activate(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.insurance.activate(access, parse(uuid, id), parse(agreementStateSchema, body).version, auth.userId, client) }
  }

  @Post('agreements/:id/end')
  @HttpCode(200)
  @RequirePermissions('settings.organisation')
  async end(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.insurance.end(access, parse(uuid, id), parse(agreementStateSchema, body).version, auth.userId, client) }
  }
}
