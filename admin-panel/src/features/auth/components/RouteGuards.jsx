import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { canOpen } from '../../../config/access'
import { ROUTES } from '../../../config/routes'
import { useAuth } from '../context/useAuth'
import { landingPath } from '../landing'
import AccessDeniedPage from '../pages/AccessDeniedPage'
import AuthStatusScreen from './AuthStatusScreen'

// Loading, failed and misconfigured sessions look the same behind every guard.
function SessionGate({ auth }) {
  if (auth.status === 'loading') return <AuthStatusScreen title="Loading your workspace…" />
  if (auth.status === 'misconfigured') return <AuthStatusScreen title="Sign-in is not configured" message={auth.error} />
  if (auth.status === 'error') {
    return <AuthStatusScreen title="We could not load your account" message={auth.error} action="Try again" onAction={() => auth.refresh().catch(() => {})} />
  }
  return null
}

const signInRedirect = (location) => (
  <Navigate to={ROUTES.signin} replace state={{ from: `${location.pathname}${location.search}` }} />
)

// Onboarding: signed in with a verified email; an organisation is not needed yet.
export function RequireAccount() {
  const auth = useAuth()
  const location = useLocation()
  const gate = SessionGate({ auth })
  if (gate) return gate
  if (auth.status === 'signedOut') return signInRedirect(location)
  if (auth.status === 'unverified') return <Navigate to={ROUTES.verify} replace state={{ email: auth.user.email }} />
  return <Outlet />
}

// Workspace: an active membership, and a permission that opens this part of the app.
export function RequireWorkspace() {
  const auth = useAuth()
  const location = useLocation()
  const gate = SessionGate({ auth })
  if (gate) return gate
  if (auth.status === 'signedOut') return signInRedirect(location)
  if (auth.status === 'unverified') return <Navigate to={ROUTES.verify} replace state={{ email: auth.user.email }} />
  if (auth.status === 'noOrganisation') return <Navigate to={ROUTES.clinic} replace />
  if (!canOpen(location.pathname, auth.can)) return <AccessDeniedPage />
  return <Outlet />
}

// Sign-in and sign-up: someone already signed in goes straight to where they belong.
export function RequireGuest() {
  const auth = useAuth()
  if (auth.status === 'loading') return <AuthStatusScreen title="Loading…" />
  if (['ready', 'noOrganisation'].includes(auth.status)) return <Navigate to={landingPath(auth)} replace />
  return <Outlet />
}

// "/" and unknown URLs.
export function RootRedirect() {
  const auth = useAuth()
  if (auth.status === 'loading') return <AuthStatusScreen title="Loading…" />
  return <Navigate to={landingPath(auth)} replace />
}
