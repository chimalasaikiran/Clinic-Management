import { homePath } from '../../config/access'
import { ROUTES } from '../../config/routes'

// Where a person belongs given their session: verify, set up a clinic, or their first permitted section.
export function landingPath({ status, can }) {
  if (status === 'unverified') return ROUTES.verify
  if (status === 'noOrganisation') return ROUTES.clinic
  if (status === 'ready') return homePath(can) ?? ROUTES.dashboard
  return ROUTES.setup
}
