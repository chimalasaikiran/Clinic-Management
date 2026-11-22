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
import FormMessage from '../../auth/components/FormMessage'
import { configApi } from '../../configuration/api'
import { ONBOARDING_STEPS } from '../data/onboardingSteps'
import { validatePracticeContact } from '../validation'

export default function PracticeContactPage() {
  const navigate = useNavigate()
  const [values, handleChange] = useFormFields({ phone: '', email: '' })
  const [logo, setLogo] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState('')
  const errors = submitted ? validatePracticeContact(values) : {}

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    if (Object.keys(validatePracticeContact(values)).length > 0) return
    setPending(true)
    try {
      await configApi.saveContact({ phone: values.phone.trim(), email: values.email.trim() })
      if (logo) await configApi.uploadLogo(logo)
      navigate(ROUTES.operations)
    } catch (error) {
      setFailure(error.message)
      setPending(false)
    }
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
          helper="PNG, JPG or WebP up to 5MB"
          accept="image/png,image/jpeg,image/webp"
          onFileChange={setLogo}
        />
        <FormMessage>{failure}</FormMessage>

        <div className="flex flex-col gap-4 pt-2">
          <Button type="submit" fullWidth disabled={pending} trailing={<span aria-hidden="true">→</span>}>
            {pending ? 'Saving…' : 'Continue'}
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
