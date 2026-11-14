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
import OnboardingLayout from '../../onboarding/components/OnboardingLayout'
import { validateSignIn } from '../validation'

export default function SignInPage() {
  const navigate = useNavigate()
  const [values, handleChange] = useFormFields({ email: '', password: '' })
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateSignIn(values) : {}

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateSignIn(values)).length > 0) return
    navigate(ROUTES.dashboard)
  }

  return (
    <OnboardingLayout formSide="left" align="center">
      <PageHeading
        eyebrow="Welcome back"
        title="Sign in to ClinicOS"
        description="Use your work email and password to open your clinic workspace."
      />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 pt-[22px]">
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

        <Button
          type="submit"
          size="lg"
          fullWidth
          className="mt-3 h-[50px]"
          trailing={<img src={icons.arrowLong} alt="" />}
        >
          Sign in
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
