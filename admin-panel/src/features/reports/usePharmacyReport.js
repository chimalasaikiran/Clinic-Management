import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../auth/context/useAuth'
import { toStockState } from '../inventory/adapters'
import { inventoryApi } from '../inventory/api'
import { pharmacyReport } from './reportsLogic'

// The pharmacy & inventory report for the last 30 days, from the live stock state. `restricted` when the
// person's role has no inventory or pharmacy permission.
export function usePharmacyReport() {
  const { can } = useAuth()
  const allowed = can('inventory.view') || can('pharmacy.view')
  const { data, error, loading, reload } = useApiResource(() => (allowed ? inventoryApi.state() : Promise.resolve(null)), `pharmacy-report:${allowed}`)
  if (!allowed) return { restricted: true }
  if (!data) return { loading: loading || !error, error, reload }
  const stock = toStockState(data)
  return { report: pharmacyReport(stock, data.today), today: data.today, locations: stock.locations }
}
