import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import Button from '../../../components/ui/Button'
import PageHeading from '../../../components/ui/PageHeading'
import TextField from '../../../components/ui/TextField'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import { isBlank, isEmail } from '../../../lib/validators'
import OnboardingLayout from '../../onboarding/components/OnboardingLayout'
import { authApi } from '../api'
import FormMessage from '../components/FormMessage'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState(useLocation().state?.email ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState('')
  const error = submitted ? (isBlank(email) ? 'Enter your work email.' : !isEmail(email) ? 'Enter a valid email address.' : '') : ''

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    if (isBlank(email) || !isEmail(email)) return

    setPending(true)
    try {
      const address = email.trim().toLowerCase()
      await authApi.requestPasswordReset(address)
      navigate(ROUTES.resetPassword, { state: { email: address } })
    } catch (requestError) {
      setFailure(requestError.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <OnboardingLayout formSide="left" align="center">
      <PageHeading
        eyebrow="Account recovery"
        title="Reset your password"
        description="Enter your work email. If it belongs to a ClinicOS account, we will email you a 6-digit reset code."
      />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 pt-[22px]">
        <FormMessage>{failure}</FormMessage>
        <TextField
          label="Work email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="name@clinic.com"
          endIcon={icons.atSign}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={error}
          muted
        />

        <Button type="submit" size="lg" fullWidth disabled={pending} className="mt-3 h-[50px]" trailing={<img src={icons.arrowLong} alt="" />}>
          {pending ? 'Sending code…' : 'Send reset code'}
        </Button>

        <p className="text-center text-[13.5px] leading-[20px] text-slate-500">
          Remembered it?{' '}
          <TextLink to={ROUTES.signin} tone="emerald" className="font-semibold">
            Back to sign in
          </TextLink>
        </p>
      </form>
    </OnboardingLayout>
  )
}
