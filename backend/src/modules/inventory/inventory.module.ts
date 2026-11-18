import { Module } from '@nestjs/common'
import { InventoryStateService } from './inventory-state.service'
import { InventoryController } from './inventory.controller'
import { MasterDataService } from './master-data.service'
import { PharmacyService } from './pharmacy.service'
import { PurchasingService } from './purchasing.service'
import { StockLedger } from './stock-ledger'
import { SupplyService } from './supply.service'

@Module({
  controllers: [InventoryController],
  providers: [StockLedger, MasterDataService, SupplyService, PurchasingService, PharmacyService, InventoryStateService],
})
export class InventoryModule {}
