import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import Button from '../../../components/ui/Button'
import ChoiceChip from '../../../components/ui/ChoiceChip'
import PageHeading from '../../../components/ui/PageHeading'
import SelectField from '../../../components/ui/SelectField'
import TextField from '../../../components/ui/TextField'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import { useFormFields } from '../../../hooks/useFormFields'
import { cn } from '../../../lib/cn'
import OnboardingLayout from '../components/OnboardingLayout'
import { FACILITY_TYPES } from '../data/clinicOptions'
import { INDIAN_REGIONS } from '../data/indianRegions'
import { ONBOARDING_STEPS } from '../data/onboardingSteps'
import { validateClinicProfile } from '../validation'

function MonoHint({ children, accent = false }) {
  return (
    <span
      className={cn(
        'flex items-center gap-1 font-mono text-[10px] leading-[15px] font-medium tracking-[0.5px] uppercase',
        accent ? 'text-teal-600' : 'text-slate-400',
      )}
    >
      {accent && <span className="size-1 rounded-full bg-teal-600" />}
      {children}
    </span>
  )
}

export default function ClinicProfilePage() {
  const navigate = useNavigate()
  const [values, handleChange, setValues] = useFormFields({
    clinicName: '',
    location: '',
    city: '',
    state: '',
    facilityType: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateClinicProfile(values) : {}

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateClinicProfile(values)).length > 0) return
    navigate(ROUTES.contact)
  }

  return (
    <OnboardingLayout step={ONBOARDING_STEPS.clinic} formSide="left">
      <PageHeading
        eyebrow="Organization profile"
        title="Create your clinic"
        description="Establish your core practice identity and location to calibrate your ClinicOS administrative environment."
      />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-[27px] pt-6">
        <TextField
          label="Clinic / Organization Name"
          hint={<MonoHint>Legal or trade name</MonoHint>}
          name="clinicName"
          autoComplete="organization"
          placeholder="e.g. Apex Health Institute or Dr. Arora Clinic"
          value={values.clinicName}
          onChange={handleChange}
          error={errors.clinicName}
        />
        <TextField
          label="Primary Location / Campus"
          hint={<MonoHint accent>Geo-intelligence</MonoHint>}
          name="location"
          autoComplete="street-address"
          placeholder="Search healthcare hub, medical zone, or street address..."
          startIcon={icons.fieldPin}
          value={values.location}
          onChange={handleChange}
          error={errors.location}
        />
        <div className="flex flex-col gap-3.5">
          <TextField
            label="City"
            name="city"
            autoComplete="address-level2"
            placeholder="e.g. Bengaluru"
            startIcon={icons.fieldBuilding}
            value={values.city}
            onChange={handleChange}
            error={errors.city}
          />
          <SelectField
            label="State / Territory"
            name="state"
            placeholder="Select state / UT"
            options={INDIAN_REGIONS}
            value={values.state}
            onChange={handleChange}
            error={errors.state}
          />
        </div>

        <fieldset className="flex flex-col gap-2 pt-1 pb-2">
          <legend className="mb-2 font-mono text-[11px] leading-[16.5px] font-semibold tracking-[0.55px] text-slate-500 uppercase">
            Facility classification
          </legend>
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {FACILITY_TYPES.map((type) => (
              <ChoiceChip
                key={type}
                selected={values.facilityType === type}
                onClick={() => setValues((current) => ({ ...current, facilityType: type }))}
              >
                {type}
              </ChoiceChip>
            ))}
          </div>
          {errors.facilityType && (
            <p role="alert" className="text-xs leading-4 text-rose-600">
              {errors.facilityType}
            </p>
          )}
        </fieldset>

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
