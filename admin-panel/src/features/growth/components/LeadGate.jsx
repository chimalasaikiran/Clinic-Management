import { Banner } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import LoadingState from '../../patients/components/LoadingState'
import { LIVE_NOTE } from '../leadsView'
import { useLead } from '../useLeads'
import GrowthFrame from './GrowthFrame'

// Loads the lead in the address and renders `children(lead, reload)` once it is there.
export default function LeadGate({ leadId, back = { to: ROUTES.leads, label: 'Back to Lead Register' }, children }) {
  const state = useLead(leadId)
  const frame = (title, body) => <GrowthFrame back={back} crumb="Owner Panel / Growth OS / Leads" title={title} sample={LIVE_NOTE}>{body}</GrowthFrame>

  if (state.missing) return frame('Lead not found', <Banner tone="warning" title="No lead matches this link">Open the Lead Register to find the record. Leads outside your branches are not shown.</Banner>)
  if (state.error) return frame('Lead', <LoadingState error={state.error} onRetry={state.reload} />)
  if (state.loading) return frame('Lead', <LoadingState label="Loading lead…" />)
  return children(state.lead, state.reload)
}
