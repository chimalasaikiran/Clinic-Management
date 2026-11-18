import { Module } from '@nestjs/common'
import { BalancesRepository } from './balances.repository'
import { BillingController } from './billing.controller'
import { CatalogueService } from './catalogue.service'
import { ChargesService } from './charges.service'
import { FinanceSupport } from './finance.support'
import { InvoicesService } from './invoices.service'
import { LedgerService } from './ledger.service'
import { PaymentsService } from './payments.service'
import { ReconciliationService } from './reconciliation.service'
import { RefundsService } from './refunds.service'

@Module({
  controllers: [BillingController],
  providers: [FinanceSupport, BalancesRepository, CatalogueService, ChargesService, InvoicesService, PaymentsService, RefundsService, ReconciliationService, LedgerService],
})
export class BillingModule {}
