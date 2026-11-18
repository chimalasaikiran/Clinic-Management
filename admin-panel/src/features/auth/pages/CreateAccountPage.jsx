import { useState } from 'react'
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
import { ONBOARDING_STEPS } from '../../onboarding/data/onboardingSteps'
import { authApi } from '../api'
import FormMessage from '../components/FormMessage'
import { validateAccount } from '../validation'

export default function CreateAccountPage() {
  const navigate = useNavigate()
  const [values, handleChange] = useFormFields({ fullName: '', email: '', password: '' })
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [failure, setFailure] = useState('')
  const errors = submitted ? { ...serverErrors, ...validateAccount(values) } : {}

  const handleChangeField = (event) => {
    setServerErrors((current) => ({ ...current, [event.target.name]: undefined }))
    handleChange(event)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    if (Object.keys(validateAccount(values)).length > 0) return

    setPending(true)
    try {
      const email = values.email.trim().toLowerCase()
      await authApi.register({ fullName: values.fullName.trim(), email, password: values.password })
      navigate(ROUTES.verify, { state: { email } })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') setServerErrors(error.fieldErrors())
      else setFailure(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <OnboardingLayout step={ONBOARDING_STEPS.signup} formSide="left" align="center" assurance="detailed">
      <PageHeading
        eyebrow="Account registration"
        title="Create your account"
        description="Set up your ClinicOS account to begin configuring your clinic."
      />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 pt-[22px]">
        <FormMessage>{failure}</FormMessage>
        <TextField
          label="Full name"
          hint="Primary Administrator"
          name="fullName"
          autoComplete="name"
          placeholder="Enter your full name"
          value={values.fullName}
          onChange={handleChangeField}
          error={errors.fullName}
          muted
        />
        <TextField
          label="Work email"
          hint={
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-600" />
              Instant OTP verification
            </span>
          }
          type="email"
          name="email"
          autoComplete="email"
          placeholder="name@clinic.com"
          endIcon={icons.atSign}
          value={values.email}
          onChange={handleChangeField}
          error={errors.email}
          muted
        />
        <PasswordField
          label="Password"
          hint={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
          name="password"
          autoComplete="new-password"
          placeholder="Create a Password"
          value={values.password}
          onChange={handleChangeField}
          error={errors.password}
          muted
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={pending}
          className="mt-3 h-[50px]"
          trailing={<img src={icons.arrowLong} alt="" />}
        >
          {pending ? 'Creating account…' : 'Continue'}
        </Button>

        <p className="text-center text-[13.5px] leading-[20px] text-slate-500">
          Already have an account?{' '}
          <TextLink to={ROUTES.signin} tone="emerald" className="font-semibold">
            Sign in
          </TextLink>
        </p>
      </form>
    </OnboardingLayout>
  )
}
