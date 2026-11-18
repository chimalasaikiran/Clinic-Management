import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../auth/context/useAuth'
import { toLedgerView } from './adapters'
import { billingApi } from './api'

export const FINANCE_PERMISSIONS = ['accounting.revenue', 'accounting.payments', 'accounting.invoices', 'accounting.expenses', 'accounting.settlements']
const NONE = { invoices: [], payments: [], refunds: [], charges: [] }

// One patient's charges, invoices, payments and processed refunds, for summaries outside the billing screens.
// Empty for people without a finance permission, and while it loads.
export function usePatientLedger(patientId) {
  const { can } = useAuth()
  const allowed = FINANCE_PERMISSIONS.some(can)
  const { data } = useApiResource(() => (patientId && allowed ? billingApi.ledger(patientId) : Promise.resolve(null)), `patient-ledger:${patientId}:${allowed}`)
  return data ? toLedgerView(data).records : NONE
}
