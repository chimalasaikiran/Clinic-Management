import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import Button from '../../../components/ui/Button'
import OtpInput from '../../../components/ui/OtpInput'
import PageHeading from '../../../components/ui/PageHeading'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import OnboardingLayout from '../../onboarding/components/OnboardingLayout'
import { ONBOARDING_STEPS } from '../../onboarding/data/onboardingSteps'
import { OTP_LENGTH, validateOtp } from '../validation'

export default function VerifyAccountPage() {
  const navigate = useNavigate()
  const email = useLocation().state?.email
  const [code, setCode] = useState(() => Array(OTP_LENGTH).fill(''))
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateOtp(code) : {}

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateOtp(code)).length > 0) return
    navigate(ROUTES.clinic)
  }

  return (
    <OnboardingLayout step={ONBOARDING_STEPS.verify} formSide="right" assurance="detailed">
      <PageHeading
        eyebrow="Account verification"
        title="Verify your account"
        description="Confirm your contact details to continue setting up your clinic."
      />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[27px] pt-6">
        <div className="flex flex-col pb-[5px]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[13px] font-medium text-slate-800">Verification code</span>
            <TextLink to={ROUTES.signup} tone="teal" className="text-[12.5px] font-medium">
              Change email
            </TextLink>
          </div>
          <p className="pt-[5px] text-[13px] leading-[19.5px] text-slate-600">
            Enter the {OTP_LENGTH}-digit code sent to{' '}
            <span className="font-semibold text-slate-800">{email ?? 'your email'}</span>
          </p>

          <div className="pt-3.5">
            <OtpInput value={code} onChange={setCode} invalid={Boolean(errors.code)} />
          </div>
          {errors.code && (
            <p role="alert" className="pt-2 text-xs leading-4 text-rose-600">
              {errors.code}
            </p>
          )}

          <p className="pt-3 text-[13px] leading-[19.5px] text-slate-500">
            Didn't receive the code?{' '}
            <TextLink tone="teal" underline className="font-medium">
              Resend code
            </TextLink>
          </p>
        </div>

        <Button type="submit" size="lg" fullWidth trailing={<img src={icons.arrowLong} alt="" />}>
          Verify & continue
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
