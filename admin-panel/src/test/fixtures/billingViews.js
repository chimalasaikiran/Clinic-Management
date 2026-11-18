import { toLedgerView } from '../../features/billing/adapters'
import { ledgerSeed } from './billingApi'

// The fake billing ledger as the screens see it (through the same adapters as production), for logic tests.
export const billingViews = () => toLedgerView(ledgerSeed())
