import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common'
import { Client } from '../../common/decorators/client.decorator'
import type { AccessContext, AuthContext, ClientInfo } from '../../common/utils/request'
import { parse, uuid } from '../../common/validation/validation'
import { CurrentAuth } from '../auth/auth.decorators'
import { CurrentAccess, RequireAnyPermission, RequirePermissions } from '../permissions/access.decorators'
import { InventoryStateService } from './inventory-state.service'
import {
  adjustmentSchema, cancelSchema, caseDecisionSchema, caseSchema, dispenseSchema, itemSchema, locationActiveSchema, locationSchema, orderSchema, receiptSchema, receiveTransferSchema,
  requestSchema, resolveDiscrepancySchema, reviewRequestSchema, supplierActiveSchema, supplierSchema, transferSchema, updateItemSchema, updateRequestSchema, updateSupplierSchema,
  updateTransferSchema, versionSchema,
} from './inventory.schemas'
import { MasterDataService } from './master-data.service'
import { PharmacyService } from './pharmacy.service'
import { PurchasingService } from './purchasing.service'
import { SupplyService } from './supply.service'

// Inventory (inventory.view to read, inventory.manage to change) and pharmacy (pharmacy.view, pharmacy.dispense).
// Pharmacists raise stock requests and receive transfers at their pharmacy; changes to a location also need
// the caller's branch scope to include its branch.
@Controller({ version: '1' })
export class InventoryController {
  constructor(
    private readonly state: InventoryStateService,
    private readonly master: MasterDataService,
    private readonly supply: SupplyService,
    private readonly purchasing: PurchasingService,
    private readonly pharmacy: PharmacyService,
  ) {}

  @Get('inventory/state')
  @RequireAnyPermission('inventory.view', 'pharmacy.view')
  async read(@CurrentAccess() access: AccessContext) {
    return { data: await this.state.state(access) }
  }

  // ── master data ──
  @Post('inventory/items')
  @HttpCode(201)
  @RequirePermissions('inventory.manage')
  async createItem(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.master.createItem(access, auth.userId, parse(itemSchema, body), client) }
  }

  @Patch('inventory/items/:id')
  @RequirePermissions('inventory.manage')
  async updateItem(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    const input = parse(updateItemSchema, body)
    return { data: await this.master.updateItem(access, parse(uuid, id), auth.userId, input.version, input.item, client) }
  }

  @Post('inventory/locations')
  @HttpCode(201)
  @RequirePermissions('inventory.manage')
  async createLocation(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.master.createLocation(access, auth.userId, parse(locationSchema, body), client) }
  }

  @Put('inventory/locations/:id/active')
  @RequirePermissions('inventory.manage')
  async locationActive(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.master.setLocationActive(access, parse(uuid, id), auth.userId, parse(locationActiveSchema, body).active, client) }
  }

  @Post('inventory/suppliers')
  @HttpCode(201)
  @RequirePermissions('inventory.manage')
  async createSupplier(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.master.createSupplier(access, auth.userId, parse(supplierSchema, body), client) }
  }

  @Patch('inventory/suppliers/:id')
  @RequirePermissions('inventory.manage')
  async updateSupplier(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    const input = parse(updateSupplierSchema, body)
    return { data: await this.master.updateSupplier(access, parse(uuid, id), auth.userId, input.version, input.supplier, client) }
  }

  @Put('inventory/suppliers/:id/active')
  @RequirePermissions('inventory.manage')
  async supplierActive(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.master.setSupplierActive(access, parse(uuid, id), auth.userId, parse(supplierActiveSchema, body), client) }
  }

  // ── stock requests and transfers ──
  @Post('inventory/requests')
  @HttpCode(201)
  @RequireAnyPermission('inventory.manage', 'pharmacy.dispense')
  async createRequest(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.supply.createRequest(access, auth.userId, parse(requestSchema, body), client) }
  }

  @Patch('inventory/requests/:id')
  @RequireAnyPermission('inventory.manage', 'pharmacy.dispense')
  async updateRequest(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.supply.updateRequest(access, parse(uuid, id), auth.userId, parse(updateRequestSchema, body), client) }
  }

  @Post('inventory/requests/:id/cancel')
  @HttpCode(200)
  @RequireAnyPermission('inventory.manage', 'pharmacy.dispense')
  async cancelRequest(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.supply.cancelRequest(access, parse(uuid, id), auth.userId, parse(cancelSchema, body), client) }
  }

  @Post('inventory/requests/:id/review')
  @HttpCode(200)
  @RequirePermissions('inventory.manage')
  async reviewRequest(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.supply.reviewRequest(access, parse(uuid, id), auth.userId, parse(reviewRequestSchema, body), client) }
  }

  @Post('inventory/requests/:id/transfer')
  @HttpCode(201)
  @RequirePermissions('inventory.manage')
  async transferForRequest(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.supply.transferForRequest(access, parse(uuid, id), auth.userId, client) }
  }

  @Post('inventory/transfers')
  @HttpCode(201)
  @RequirePermissions('inventory.manage')
  async createTransfer(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.supply.createTransfer(access, auth.userId, parse(transferSchema, body), client) }
  }

  @Patch('inventory/transfers/:id')
  @RequirePermissions('inventory.manage')
  async updateTransfer(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.supply.updateTransfer(access, parse(uuid, id), auth.userId, parse(updateTransferSchema, body), client) }
  }

  @Post('inventory/transfers/:id/dispatch')
  @HttpCode(200)
  @RequirePermissions('inventory.manage')
  async dispatch(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.supply.dispatch(access, parse(uuid, id), auth.userId, parse(versionSchema, body).version, client) }
  }

  @Post('inventory/transfers/:id/receive')
  @HttpCode(200)
  @RequireAnyPermission('inventory.manage', 'pharmacy.dispense')
  async receive(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.supply.receive(access, parse(uuid, id), auth.userId, parse(receiveTransferSchema, body), client) }
  }

  @Post('inventory/transfers/:id/cancel')
  @HttpCode(200)
  @RequirePermissions('inventory.manage')
  async cancelTransfer(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.supply.cancelTransfer(access, parse(uuid, id), auth.userId, parse(versionSchema, body).version, client) }
  }

  // ── purchasing and adjustments ──
  @Post('inventory/orders')
  @HttpCode(201)
  @RequirePermissions('inventory.manage')
  async createOrder(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.purchasing.createOrder(access, auth.userId, parse(orderSchema, body), client) }
  }

  @Post('inventory/receipts')
  @HttpCode(201)
  @RequirePermissions('inventory.manage')
  async createReceipt(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.purchasing.saveReceipt(access, auth.userId, parse(receiptSchema, body), client) }
  }

  @Put('inventory/receipts/:id')
  @RequirePermissions('inventory.manage')
  async updateReceipt(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.purchasing.saveReceipt(access, auth.userId, parse(receiptSchema, body), client, parse(uuid, id)) }
  }

  @Post('inventory/receipts/:id/resolve')
  @HttpCode(200)
  @RequirePermissions('inventory.manage')
  async resolve(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.purchasing.resolveDiscrepancy(access, parse(uuid, id), auth.userId, parse(resolveDiscrepancySchema, body), client) }
  }

  @Post('inventory/receipts/:id/post')
  @HttpCode(200)
  @RequirePermissions('inventory.manage')
  async postReceipt(@Param('id') id: string, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.purchasing.postReceipt(access, parse(uuid, id), auth.userId, client) }
  }

  @Post('inventory/adjustments')
  @HttpCode(201)
  @RequirePermissions('inventory.manage')
  async createAdjustment(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.purchasing.saveAdjustment(access, auth.userId, parse(adjustmentSchema, body), client) }
  }

  @Put('inventory/adjustments/:id')
  @RequirePermissions('inventory.manage')
  async updateAdjustment(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.purchasing.saveAdjustment(access, auth.userId, parse(adjustmentSchema, body), client, parse(uuid, id)) }
  }

  // ── pharmacy ──
  @Post('pharmacy/prescriptions/:id/dispense')
  @HttpCode(201)
  @RequirePermissions('pharmacy.dispense')
  async dispense(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.pharmacy.dispense(access, parse(uuid, id), auth.userId, parse(dispenseSchema, body), client) }
  }

  @Post('pharmacy/cases')
  @HttpCode(201)
  @RequirePermissions('pharmacy.dispense')
  async createCase(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.pharmacy.createCase(access, auth.userId, parse(caseSchema, body), client) }
  }

  @Post('pharmacy/cases/:id/decide')
  @HttpCode(200)
  @RequireAnyPermission('pharmacy.dispense', 'inventory.manage')
  async decideCase(@Param('id') id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @CurrentAccess() access: AccessContext, @Client() client: ClientInfo) {
    return { data: await this.pharmacy.decideCase(access, parse(uuid, id), auth.userId, parse(caseDecisionSchema, body), client) }
  }
}
