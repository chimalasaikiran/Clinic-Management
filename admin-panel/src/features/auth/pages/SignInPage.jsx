import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import Button from '../../../components/ui/Button'
import PageHeading from '../../../components/ui/PageHeading'
import PasswordField from '../../../components/ui/PasswordField'
import TextField from '../../../components/ui/TextField'
import TextLink from '../../../components/ui/TextLink'
import { canOpen } from '../../../config/access'
import { ROUTES } from '../../../config/routes'
import { useFormFields } from '../../../hooks/useFormFields'
import OnboardingLayout from '../../onboarding/components/OnboardingLayout'
import { SESSION_END_MESSAGES } from '../authErrors'
import FormMessage from '../components/FormMessage'
import { landingPath } from '../landing'
import { useAuth } from '../context/useAuth'
import { validateSignIn } from '../validation'

export default function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()
  const [values, handleChange] = useFormFields({ email: location.state?.email ?? '', password: '' })
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState('')
  const errors = submitted ? validateSignIn(values) : {}
  const notice = location.state?.notice ?? SESSION_END_MESSAGES[auth.endedReason]

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    if (Object.keys(validateSignIn(values)).length > 0) return

    setPending(true)
    try {
      const email = values.email.trim()
      const session = await auth.signIn(email, values.password)
      if (session.status === 'unverified') navigate(ROUTES.verify, { replace: true, state: { email } })
      else {
        // Return to the page that asked for sign-in when it is one the user may open.
        const from = location.state?.from
        navigate(session.status === 'ready' && from && canOpen(from, session.can) ? from : landingPath(session), { replace: true })
      }
    } catch (error) {
      setFailure(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <OnboardingLayout formSide="left" align="center">
      <PageHeading
        eyebrow="Welcome back"
        title="Sign in to ClinicOS"
        description="Use your work email and password to open your clinic workspace."
      />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 pt-[22px]">
        <FormMessage tone={location.state?.notice ? 'success' : 'info'}>{!failure && notice}</FormMessage>
        <FormMessage>{failure}</FormMessage>

        <TextField
          label="Work email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="name@clinic.com"
          endIcon={icons.atSign}
          value={values.email}
          onChange={handleChange}
          error={errors.email}
          muted
        />
        <div className="flex flex-col gap-2">
          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={values.password}
            onChange={handleChange}
            error={errors.password}
            muted
          />
          <TextLink to={ROUTES.forgotPassword} state={{ email: values.email.trim() }} tone="teal" className="self-end text-[12.5px] font-medium">
            Forgot password?
          </TextLink>
        </div>

        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={pending}
          className="mt-3 h-[50px]"
          trailing={<img src={icons.arrowLong} alt="" />}
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>

        <p className="text-center text-[13.5px] leading-[20px] text-slate-500">
          New to ClinicOS?{' '}
          <TextLink to={ROUTES.signup} tone="emerald" className="font-semibold">
            Create an account
          </TextLink>
        </p>
      </form>
    </OnboardingLayout>
  )
}
