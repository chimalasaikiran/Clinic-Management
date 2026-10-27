import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../../components/ui/Button'
import FileUploadField from '../../../components/ui/FileUploadField'
import PageHeading from '../../../components/ui/PageHeading'
import PhoneField from '../../../components/ui/PhoneField'
import TextField from '../../../components/ui/TextField'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import { useFormFields } from '../../../hooks/useFormFields'
import OnboardingLayout from '../components/OnboardingLayout'
import { ONBOARDING_STEPS } from '../data/onboardingSteps'
import { validatePracticeContact } from '../validation'

export default function PracticeContactPage() {
  const navigate = useNavigate()
  const [values, handleChange] = useFormFields({ phone: '', email: '' })
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validatePracticeContact(values) : {}

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validatePracticeContact(values)).length > 0) return
    navigate(ROUTES.operations)
  }

  return (
    <OnboardingLayout step={ONBOARDING_STEPS.contact} formSide="right" assurance="line">
      <PageHeading
        eyebrow="Clinic profile"
        title="Tell us about your clinic"
        description="Add a few details about your clinic so we can tailor ClinicOS to the way you work."
      />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 pt-5">
        <PhoneField
          label="Clinic phone"
          required
          name="phone"
          placeholder="Enter clinic phone number"
          value={values.phone}
          onChange={handleChange}
          error={errors.phone}
        />
        <TextField
          label="Clinic email"
          hint="Optional"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="clinic@example.com"
          value={values.email}
          onChange={handleChange}
          error={errors.email}
        />
        <FileUploadField
          label="Clinic logo"
          hint="Optional"
          title="Upload clinic brand mark or logo"
          helper="PNG, SVG, or JPG up to 5MB"
          accept="image/png,image/svg+xml,image/jpeg"
        />

        <div className="flex flex-col gap-4 pt-2">
          <Button type="submit" fullWidth trailing={<span aria-hidden="true">→</span>}>
            Continue
          </Button>
          <div className="flex justify-center">
            <TextLink to={ROUTES.clinic} className="text-xs leading-4 font-medium">
              ← Back
            </TextLink>
          </div>
        </div>
      </form>
    </OnboardingLayout>
  )
}
