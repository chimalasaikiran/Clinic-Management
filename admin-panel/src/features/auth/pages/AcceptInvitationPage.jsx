import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import Button from '../../../components/ui/Button'
import PageHeading from '../../../components/ui/PageHeading'
import PasswordField from '../../../components/ui/PasswordField'
import TextField from '../../../components/ui/TextField'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import { useFormFields } from '../../../hooks/useFormFields'
import { ApiError } from '../../../lib/api'
import { MIN_PASSWORD_LENGTH } from '../../../lib/validators'
import OnboardingLayout from '../../onboarding/components/OnboardingLayout'
import { authApi } from '../api'
import FormMessage from '../components/FormMessage'
import { landingPath } from '../landing'
import { useAuth } from '../context/useAuth'
import { validateAccount } from '../validation'

const TOKEN_KEY = 'clinicos.invitation'

// The link carries the token in the URL fragment (#token=…), which browsers never send to servers.
// It is moved to this tab's session storage and removed from the address bar, so it survives a sign-in
// detour without lingering in history.
function takeToken() {
  const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('token')
  try {
    if (fromHash) {
      window.sessionStorage.setItem(TOKEN_KEY, fromHash)
      window.history.replaceState(null, '', window.location.pathname)
    }
    return fromHash ?? window.sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return fromHash
  }
}

function forgetToken() {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // nothing stored
  }
}

export default function AcceptInvitationPage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const [token] = useState(takeToken)
  const [invitation, setInvitation] = useState(null)
  const [loadError, setLoadError] = useState(token ? '' : 'This invitation link is incomplete. Open the link from your email again.')
  const [values, handleChange] = useFormFields({ fullName: '', password: '' })
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState('')

  useEffect(() => {
    if (!token) return
    authApi
      .previewInvitation(token)
      .then(setInvitation)
      .catch((error) => setLoadError(error.message))
  }, [token])

  const errors = submitted && invitation ? validateAccount({ ...values, email: invitation.email }) : {}
  const signedInAs = ['ready', 'noOrganisation'].includes(auth.status) ? auth.user.email : null
  const matchesSignedIn = signedInAs && invitation && signedInAs.toLowerCase() === invitation.email.toLowerCase()

  const finish = async () => {
    forgetToken()
    navigate(landingPath(await auth.refresh()), { replace: true })
  }

  const acceptExisting = async () => {
    setFailure('')
    setPending(true)
    try {
      await authApi.acceptInvitation(token)
      await finish()
    } catch (error) {
      setFailure(error.message)
    } finally {
      setPending(false)
    }
  }

  const acceptNew = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    if (Object.keys(validateAccount({ ...values, email: invitation.email })).length > 0) return

    setPending(true)
    try {
      await authApi.acceptInvitationAsNewUser(token, { fullName: values.fullName.trim(), password: values.password })
      await auth.signIn(invitation.email, values.password)
      await finish()
    } catch (error) {
      setFailure(error instanceof ApiError && error.code === 'VALIDATION_FAILED' ? Object.values(error.fieldErrors()).join(' ') : error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <OnboardingLayout formSide="left" align="center">
      <PageHeading
        eyebrow="Team invitation"
        title={invitation ? `Join ${invitation.organisation}` : 'Accept your invitation'}
        description={invitation ? `${invitation.invitedBy} invited ${invitation.email} as ${invitation.roles.join(', ') || 'a team member'}.` : 'Checking your invitation…'}
      />

      <div className="flex flex-col gap-5 pt-[22px]">
        <FormMessage>{loadError || failure}</FormMessage>

        {invitation && matchesSignedIn && (
          <Button size="lg" fullWidth disabled={pending} onClick={acceptExisting} trailing={<img src={icons.arrowLong} alt="" />}>
            {pending ? 'Joining…' : `Accept and join ${invitation.organisation}`}
          </Button>
        )}

        {invitation && signedInAs && !matchesSignedIn && (
          <>
            <FormMessage tone="info">
              You are signed in as {signedInAs}, but this invitation is for {invitation.email}. Sign out and sign in with the invited email.
            </FormMessage>
            <Button size="lg" fullWidth onClick={() => auth.signOut()}>
              Sign out
            </Button>
          </>
        )}

        {invitation && !signedInAs && invitation.accountExists && (
          <>
            <FormMessage tone="info">You already have a ClinicOS account. Sign in as {invitation.email} to accept.</FormMessage>
            <Button size="lg" fullWidth onClick={() => navigate(ROUTES.signin, { state: { email: invitation.email, from: ROUTES.invite } })} trailing={<img src={icons.arrowLong} alt="" />}>
              Sign in to accept
            </Button>
          </>
        )}

        {invitation && !signedInAs && !invitation.accountExists && (
          <form onSubmit={acceptNew} noValidate className="flex flex-col gap-5">
            <TextField label="Work email" type="email" name="email" value={invitation.email} readOnly muted endIcon={icons.atSign} />
            <TextField label="Full name" name="fullName" autoComplete="name" placeholder="Enter your full name" value={values.fullName} onChange={handleChange} error={errors.fullName} muted />
            <PasswordField
              label="Password"
              hint={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
              name="password"
              autoComplete="new-password"
              placeholder="Create a Password"
              value={values.password}
              onChange={handleChange}
              error={errors.password}
              muted
            />
            <Button type="submit" size="lg" fullWidth disabled={pending} className="mt-3 h-[50px]" trailing={<img src={icons.arrowLong} alt="" />}>
              {pending ? 'Creating account…' : 'Create account & join'}
            </Button>
          </form>
        )}

        <p className="text-center text-[13.5px] leading-[20px] text-slate-500">
          <TextLink to={ROUTES.signin} tone="emerald" className="font-semibold">
            Back to sign in
          </TextLink>
        </p>
      </div>
    </OnboardingLayout>
  )
}
