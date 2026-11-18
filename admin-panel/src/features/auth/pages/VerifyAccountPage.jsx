import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import Button from '../../../components/ui/Button'
import OtpInput from '../../../components/ui/OtpInput'
import PageHeading from '../../../components/ui/PageHeading'
import TextField from '../../../components/ui/TextField'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import { isBlank, isEmail } from '../../../lib/validators'
import OnboardingLayout from '../../onboarding/components/OnboardingLayout'
import { ONBOARDING_STEPS } from '../../onboarding/data/onboardingSteps'
import { authApi } from '../api'
import FormMessage from '../components/FormMessage'
import { landingPath } from '../landing'
import { useAuth } from '../context/useAuth'
import { OTP_LENGTH, validateOtp } from '../validation'

const RESEND_COOLDOWN_SECONDS = 60

export default function VerifyAccountPage() {
  const navigate = useNavigate()
  const auth = useAuth()
  const knownEmail = useLocation().state?.email ?? (auth.status === 'unverified' ? auth.user.email : '')
  const [email, setEmail] = useState(knownEmail)
  const [code, setCode] = useState(() => Array(OTP_LENGTH).fill(''))
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [failure, setFailure] = useState('')
  const [notice, setNotice] = useState('')
  const [cooldown, setCooldown] = useState(0)

  const emailError = submitted && !knownEmail ? (isBlank(email) ? 'Enter your work email.' : !isEmail(email) ? 'Enter a valid email address.' : '') : ''
  const errors = submitted ? { ...validateOtp(code), ...(codeError && { code: codeError }) } : {}

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const changeCode = (next) => {
    setCodeError('')
    setCode(next)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    setNotice('')
    if (Object.keys(validateOtp(code)).length > 0 || (!knownEmail && (isBlank(email) || !isEmail(email)))) return

    setPending(true)
    try {
      const address = email.trim().toLowerCase()
      await authApi.confirmEmail(address, code.join(''))
      if (auth.status === 'unverified') navigate(landingPath(await auth.refresh()), { replace: true })
      else navigate(ROUTES.signin, { replace: true, state: { email: address, notice: 'Email verified. Sign in to continue setting up your clinic.' } })
    } catch (error) {
      if (error.code === 'CODE_INVALID' || error.code === 'VALIDATION_FAILED') setCodeError(error.message)
      else setFailure(error.message)
    } finally {
      setPending(false)
    }
  }

  const resend = async () => {
    setFailure('')
    if (!knownEmail && (isBlank(email) || !isEmail(email))) {
      setSubmitted(true)
      return
    }
    try {
      await authApi.resendVerification(email.trim().toLowerCase())
      setNotice('If this email is waiting for verification, a new code is on its way.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      setFailure(error.message)
      if (error.retryAfter) setCooldown(error.retryAfter)
    }
  }

  return (
    <OnboardingLayout step={ONBOARDING_STEPS.verify} formSide="right" assurance="detailed">
      <PageHeading
        eyebrow="Account verification"
        title="Verify your account"
        description="Confirm your contact details to continue setting up your clinic."
      />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[27px] pt-6">
        <FormMessage>{failure}</FormMessage>
        <FormMessage tone="success">{notice}</FormMessage>

        {!knownEmail && (
          <TextField
            label="Work email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="name@clinic.com"
            endIcon={icons.atSign}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={emailError}
            muted
          />
        )}

        <div className="flex flex-col pb-[5px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-slate-800">Verification code</span>
            <TextLink to={ROUTES.signup} tone="teal" className="text-[12.5px] font-medium">
              Change email
            </TextLink>
          </div>
          <p className="pt-[5px] text-[13px] leading-[19.5px] text-slate-600">
            Enter the {OTP_LENGTH}-digit code sent to{' '}
            <span className="font-semibold text-slate-800">{knownEmail || 'your email'}</span>
          </p>

          <div className="pt-3.5">
            <OtpInput value={code} onChange={changeCode} invalid={Boolean(errors.code)} />
          </div>
          {errors.code && (
            <p role="alert" className="pt-2 text-xs leading-4 text-rose-600">
              {errors.code}
            </p>
          )}

          <p className="pt-3 text-[13px] leading-[19.5px] text-slate-500">
            Didn't receive the code?{' '}
            {cooldown > 0 ? (
              <span className="font-medium text-slate-400">Resend in {cooldown}s</span>
            ) : (
              <TextLink tone="teal" underline className="font-medium" onClick={resend}>
                Resend code
              </TextLink>
            )}
          </p>
        </div>

        <Button type="submit" size="lg" fullWidth disabled={pending} trailing={<img src={icons.arrowLong} alt="" />}>
          {pending ? 'Verifying…' : 'Verify & continue'}
        </Button>

        <div className="flex justify-center">
          <TextLink to={ROUTES.signup} className="text-[13.5px] leading-[20.25px] font-medium">
            ← Back to sign up
          </TextLink>
        </div>
      </form>
    </OnboardingLayout>
  )
}
