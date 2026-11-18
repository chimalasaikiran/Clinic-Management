import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequireAnyPermission, RequirePermissions } from '../permissions/access.decorators'
import { FINANCE_PERMISSIONS } from './billing.constants'
import {
  allocateSchema, createChargeSchema, createInvoiceSchema, createPaymentSchema, createRefundSchema, exceptionEvidenceSchema, exceptionResolveSchema, importStatementSchema,
  ledgerQuerySchema, lineDecisionSchema, refundDecisionSchema, refundFailSchema, refundProcessSchema, refundRejectSchema, serviceSchema, serviceStatusSchema, settingsSchema,
  updateChargeSchema, updateServiceSchema, versionSchema,
} from './billing.schemas'
import { CatalogueService } from './catalogue.service'
import { ChargesService } from './charges.service'
import { InvoicesService } from './invoices.service'
import { LedgerService } from './ledger.service'
import { PaymentsService } from './payments.service'
import { ReconciliationService } from './reconciliation.service'
import { RefundsService } from './refunds.service'

// Billing & finance. Any finance permission reads the ledger; the catalogue, charges and invoices need
// accounting.invoices, collections and reconciliation accounting.payments, and deciding refunds accounting.settlements.
@Controller({ path: 'billing', version: '1' })
export class BillingController {
  constructor(
    private readonly ledger: LedgerService,
    private readonly catalogue: CatalogueService,
    private readonly charges: ChargesService,
    private readonly invoices: InvoicesService,
    private readonly payments: PaymentsService,
    private readonly refunds: RefundsService,
    private readonly reconciliation: ReconciliationService,
  ) {}

  @Get('ledger')
  @RequireAnyPermission(...FINANCE_PERMISSIONS)
  async read(@Query() query: unknown, @CurrentAccess() access: AccessContext) {
    return { data: await this.ledger.ledger(access, parse(ledgerQuerySchema, query).patientId) }
  }

  @Post('services')
  @HttpCode(201)
  @RequirePermissions('accounting.invoices')
  async createService(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: { id: await this.catalogue.createService(access, auth.userId, parse(serviceSchema, body), client) } }
  }

  @Patch('services/:id')
  @RequirePermissions('accounting.invoices')
  async updateService(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    const input = parse(updateServiceSchema, body)
    return { data: { id: await this.catalogue.updateService(access, parse(uuid, id), auth.userId, input.version, input.service, client) } }
  }

  @Post('services/:id/status')
  @HttpCode(200)
  @RequirePermissions('accounting.invoices')
  async serviceStatus(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: { id: await this.catalogue.setServiceStatus(access, parse(uuid, id), auth.userId, parse(serviceStatusSchema, body), client) } }
  }

  @Put('settings')
  @RequirePermissions('accounting.invoices')
  async saveSettings(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.catalogue.saveSettings(access, auth.userId, parse(settingsSchema, body), client)
    return { data: { saved: true } }
  }

  @Post('charges')
  @HttpCode(201)
  @RequirePermissions('accounting.invoices')
  async createCharge(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.charges.create(access, auth.userId, parse(createChargeSchema, body), client) }
  }

  @Patch('charges/:id')
  @RequirePermissions('accounting.invoices')
  async updateCharge(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: { id: await this.charges.update(access, parse(uuid, id), auth.userId, parse(updateChargeSchema, body), client) } }
  }

  @Post('invoices')
  @HttpCode(201)
  @RequirePermissions('accounting.invoices')
  async createInvoice(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.invoices.create(access, auth.userId, parse(createInvoiceSchema, body), client) }
  }

  @Post('payments')
  @HttpCode(201)
  @RequirePermissions('accounting.payments')
  async recordPayment(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.payments.create(access, auth.userId, parse(createPaymentSchema, body), client) }
  }

  @Post('payments/:id/allocations')
  @HttpCode(201)
  @RequirePermissions('accounting.payments')
  async allocate(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: { id: await this.payments.allocateExisting(access, parse(uuid, id), auth.userId, parse(allocateSchema, body), client) } }
  }

  @Post('refunds')
  @HttpCode(201)
  @RequirePermissions('accounting.payments')
  async requestRefund(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.refunds.request(access, auth.userId, parse(createRefundSchema, body), client) }
  }

  @Post('refunds/:id/approve')
  @HttpCode(200)
  @RequirePermissions('accounting.settlements')
  async approveRefund(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: { id: await this.refunds.approve(access, parse(uuid, id), auth.userId, parse(refundDecisionSchema, body), client) } }
  }

  @Post('refunds/:id/reject')
  @HttpCode(200)
  @RequirePermissions('accounting.settlements')
  async rejectRefund(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: { id: await this.refunds.reject(access, parse(uuid, id), auth.userId, parse(refundRejectSchema, body), client) } }
  }

  @Post('refunds/:id/process')
  @HttpCode(200)
  @RequirePermissions('accounting.settlements')
  async processRefund(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: { id: await this.refunds.process(access, parse(uuid, id), auth.userId, parse(refundProcessSchema, body), client) } }
  }

  @Post('refunds/:id/fail')
  @HttpCode(200)
  @RequirePermissions('accounting.settlements')
  async failRefund(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: { id: await this.refunds.fail(access, parse(uuid, id), auth.userId, parse(refundFailSchema, body), client) } }
  }

  @Post('statements')
  @HttpCode(201)
  @RequirePermissions('accounting.payments')
  async importStatement(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.reconciliation.importStatement(access, auth.userId, parse(importStatementSchema, body), client) }
  }

  @Post('statement-lines/:id/confirm')
  @HttpCode(200)
  @RequirePermissions('accounting.payments')
  async confirmLine(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.reconciliation.confirmCandidate(access, parse(uuid, id), auth.userId, parse(lineDecisionSchema, body ?? {}).note, client)
    return { data: { id } }
  }

  @Post('statement-lines/:id/reject')
  @HttpCode(200)
  @RequirePermissions('accounting.payments')
  async rejectLine(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.reconciliation.rejectCandidate(access, parse(uuid, id), auth.userId, parse(lineDecisionSchema, body ?? {}).note, client)
    return { data: { id } }
  }

  @Post('exceptions/:id/review')
  @HttpCode(200)
  @RequirePermissions('accounting.payments')
  async reviewException(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.reconciliation.startReview(access, parse(uuid, id), auth.userId, parse(versionSchema, body).version, client)
    return { data: { id } }
  }

  @Post('exceptions/:id/evidence')
  @HttpCode(200)
  @RequirePermissions('accounting.payments')
  async exceptionEvidence(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.reconciliation.recordEvidence(access, parse(uuid, id), auth.userId, parse(exceptionEvidenceSchema, body), client)
    return { data: { id } }
  }

  @Post('exceptions/:id/resolve')
  @HttpCode(200)
  @RequirePermissions('accounting.payments')
  async resolveException(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    await this.reconciliation.resolve(access, parse(uuid, id), auth.userId, parse(exceptionResolveSchema, body), client)
    return { data: { id } }
  }
}
