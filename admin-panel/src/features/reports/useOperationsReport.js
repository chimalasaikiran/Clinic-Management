import { useState } from 'react'
import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../auth/context/useAuth'
import { localToday } from '../patients/format'
import { reportsApi } from './api'
import { operationPeriods } from './reportsLogic'

// The Operations report for a chosen period and branch, from the appointment records. `restricted` when the
// person's role has no reports permission.
export function useOperationsReport() {
  const { can } = useAuth()
  const allowed = can('reports.view')
  const periods = operationPeriods(localToday())
  const [periodId, setPeriodId] = useState(periods[0].id)
  const [branchId, setBranchId] = useState('')
  const period = periods.find((entry) => entry.id === periodId) ?? periods[0]
  const { data, error, loading, reload } = useApiResource(
    () => (allowed ? reportsApi.operations({ from: period.from, to: period.to, branchId: branchId || undefined }) : Promise.resolve(null)),
    `operations:${allowed}:${period.from}:${period.to}:${branchId}`,
  )
  return { allowed, periods, period, setPeriodId, branchId, setBranchId, report: data, error, loading, reload }
}
