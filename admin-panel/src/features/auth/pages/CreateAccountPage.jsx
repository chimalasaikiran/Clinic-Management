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
import { MIN_PASSWORD_LENGTH } from '../../../lib/validators'
import OnboardingLayout from '../../onboarding/components/OnboardingLayout'
import { ONBOARDING_STEPS } from '../../onboarding/data/onboardingSteps'
import { validateAccount } from '../validation'

export default function CreateAccountPage() {
  const navigate = useNavigate()
  const [values, handleChange] = useFormFields({ fullName: '', email: '', password: '' })
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateAccount(values) : {}

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateAccount(values)).length > 0) return
    navigate(ROUTES.verify, { state: { email: values.email.trim() } })
  }

  return (
    <OnboardingLayout step={ONBOARDING_STEPS.signup} formSide="left" align="center" assurance="detailed">
      <PageHeading
        eyebrow="Account registration"
        title="Create your account"
        description="Set up your ClinicOS account to begin configuring your clinic."
      />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 pt-[22px]">
        <TextField
          label="Full name"
          hint="Primary Administrator"
          name="fullName"
          autoComplete="name"
          placeholder="Enter your full name"
          value={values.fullName}
          onChange={handleChange}
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
          onChange={handleChange}
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
          onChange={handleChange}
          error={errors.password}
          muted
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          className="mt-3 h-[50px]"
          trailing={<img src={icons.arrowLong} alt="" />}
        >
          Continue
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
