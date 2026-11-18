import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import Button from '../../../components/ui/Button'
import OtpInput from '../../../components/ui/OtpInput'
import PageHeading from '../../../components/ui/PageHeading'
import PasswordField from '../../../components/ui/PasswordField'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import { MIN_PASSWORD_LENGTH } from '../../../lib/validators'
import OnboardingLayout from '../../onboarding/components/OnboardingLayout'
import { authApi } from '../api'
import FormMessage from '../components/FormMessage'
import { OTP_LENGTH, validatePasswordReset } from '../validation'

const RESEND_COOLDOWN_SECONDS = 60

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const email = useLocation().state?.email
  const [code, setCode] = useState(() => Array(OTP_LENGTH).fill(''))
  const [password, setPassword] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [failure, setFailure] = useState('')
  const [notice, setNotice] = useState('')
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS)
  const errors = submitted ? { ...serverErrors, ...validatePasswordReset({ code, password }) } : {}

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  // The email comes from the previous step; without it start again.
  if (!email) return <Navigate to={ROUTES.forgotPassword} replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    setNotice('')
    if (Object.keys(validatePasswordReset({ code, password })).length > 0) return

    setPending(true)
    try {
      await authApi.confirmPasswordReset(email, code.join(''), password)
      navigate(ROUTES.signin, { replace: true, state: { email, notice: 'Password updated. Sign in with your new password.' } })
    } catch (error) {
      if (error.code === 'CODE_INVALID') setServerErrors({ code: error.message })
      else if (error.code === 'VALIDATION_FAILED') setServerErrors(error.fieldErrors())
      else setFailure(error.message)
    } finally {
      setPending(false)
    }
  }

  const resend = async () => {
    setFailure('')
    try {
      await authApi.requestPasswordReset(email)
      setNotice('If this email has an account, a new code is on its way.')
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (error) {
      setFailure(error.message)
      if (error.retryAfter) setCooldown(error.retryAfter)
    }
  }

  return (
    <OnboardingLayout formSide="left" align="center">
      <PageHeading eyebrow="Account recovery" title="Choose a new password" description="Enter the code we emailed you and a new password." />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5 pt-[22px]">
        <FormMessage>{failure}</FormMessage>
        <FormMessage tone="success">{notice}</FormMessage>

        <div className="flex flex-col">
          <span className="text-[13px] font-medium text-slate-800">Reset code</span>
          <p className="pt-[5px] text-[13px] leading-[19.5px] text-slate-600">
            Sent to <span className="font-semibold text-slate-800">{email}</span>
          </p>
          <div className="pt-3.5">
            <OtpInput
              value={code}
              onChange={(next) => {
                setServerErrors((current) => ({ ...current, code: undefined }))
                setCode(next)
              }}
              invalid={Boolean(errors.code)}
            />
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

        <PasswordField
          label="New password"
          hint={`Minimum ${MIN_PASSWORD_LENGTH} characters`}
          name="password"
          autoComplete="new-password"
          placeholder="Create a new password"
          value={password}
          onChange={(event) => {
            setServerErrors((current) => ({ ...current, password: undefined }))
            setPassword(event.target.value)
          }}
          error={errors.password}
          muted
        />

        <Button type="submit" size="lg" fullWidth disabled={pending} className="mt-3 h-[50px]" trailing={<img src={icons.arrowLong} alt="" />}>
          {pending ? 'Updating password…' : 'Update password'}
        </Button>

        <p className="text-center text-[13.5px] leading-[20px] text-slate-500">
          <TextLink to={ROUTES.signin} tone="emerald" className="font-semibold">
            Back to sign in
          </TextLink>
        </p>
      </form>
    </OnboardingLayout>
  )
}
