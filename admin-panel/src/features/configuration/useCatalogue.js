import { useApiResource } from '../../hooks/useApiResource'
import { toServiceView } from '../billing/adapters'
import { billingApi } from '../billing/api'
import { configApi } from './api'

// The billing service catalogue (one catalogue for the organisation) and the branches it is priced at.
export function useCatalogue(key = 0) {
  const services = useApiResource(() => billingApi.services(), `catalogue#${key}`)
  const branches = useApiResource(() => configApi.branches(), 'config-branches')
  const ready = Boolean(services.data && branches.data)
  return {
    ready,
    error: services.error ?? branches.error,
    reload: () => {
      services.reload()
      branches.reload()
    },
    services: ready ? services.data.map(toServiceView) : [],
    branches: ready ? branches.data.map((branch) => ({ ...branch, short: branch.name })) : [],
  }
}
