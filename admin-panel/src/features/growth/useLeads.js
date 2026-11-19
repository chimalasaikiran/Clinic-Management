import { useAuth } from '../auth/context/useAuth'
import { useApiResource } from '../../hooks/useApiResource'
import { useWorkspace } from '../workspace/useWorkspace'
import { locationOptions } from '../workspace/workspaceView'
import { formatDate } from '../patients/format'
import { leadsApi } from './leadsApi'
import { clinicNow, toLeadView } from './leadsView'

// One lead with its history: { lead, loading, missing, error, reload }.
export function useLead(leadId) {
  const resource = useApiResource(() => leadsApi.get(leadId), `lead:${leadId}`)
  return {
    lead: resource.data ? toLeadView(resource.data) : null,
    loading: !resource.data && !resource.error,
    missing: resource.error?.status === 404,
    error: resource.error,
    reload: resource.reload,
  }
}

// Members who can own leads, each with the branches they cover.
export function useLeadOwners() {
  return useApiResource(() => leadsApi.owners(), 'lead-owners').data ?? []
}

// The return-context line Growth pages print: organisation, working location and today's clinic date.
export function useLeadContext() {
  const { organisation } = useAuth()
  const { branches, branchId } = useWorkspace()
  const scope = branchId ? branches.find((branch) => branch.id === branchId)?.name : branches.length ? locationOptions(branches, organisation?.branchScope)[0].label : 'All locations'
  return {
    line: `${organisation?.organisation.name ?? 'ClinicOS'} · ${scope ?? 'All locations'}`,
    today: `Today · ${formatDate(clinicNow().date)} · IST`,
    branches,
    branchId,
  }
}
