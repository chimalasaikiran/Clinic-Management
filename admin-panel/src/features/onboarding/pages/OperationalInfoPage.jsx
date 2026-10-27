import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import Button from '../../../components/ui/Button'
import PageHeading from '../../../components/ui/PageHeading'
import SectionLabel from '../../../components/ui/SectionLabel'
import SelectableCard from '../../../components/ui/SelectableCard'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import OnboardingLayout from '../components/OnboardingLayout'
import { CLINIC_CLASSIFICATIONS, OPERATING_STRUCTURES } from '../data/clinicOptions'
import { ONBOARDING_STEPS } from '../data/onboardingSteps'
import { validateOperatingModel } from '../validation'

export default function OperationalInfoPage() {
  const navigate = useNavigate()
  const [classification, setClassification] = useState('')
  const [structure, setStructure] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateOperatingModel({ classification, structure }) : {}

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateOperatingModel({ classification, structure })).length > 0) return
    navigate(ROUTES.specialties)
  }

  return (
    <OnboardingLayout step={ONBOARDING_STEPS.operations} formSide="left">
      <PageHeading
        title="What type of clinic are you setting up?"
        description="Define your primary clinical classification and practice operating hierarchy to calibrate clinical workflows, department routing, and role-based access."
      />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-7 pt-6">
        <section className="flex flex-col gap-3">
          <SectionLabel title="Clinic classification" required tag="Select one architecture" />
          <div role="radiogroup" aria-label="Clinic classification" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {CLINIC_CLASSIFICATIONS.map((option) => (
              <SelectableCard
                key={option.id}
                title={option.title}
                tag={option.tag}
                description={option.description}
                icon={option.wide ? icons.hubBuilding : undefined}
                selected={classification === option.id}
                onClick={() => setClassification(option.id)}
                className={cn(option.wide && 'items-center sm:col-span-2')}
              />
            ))}
          </div>
          {errors.classification && (
            <p role="alert" className="text-xs leading-4 text-rose-600">
              {errors.classification}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <SectionLabel title="Operational structure & hierarchy" tag="Workflow calibration" />
          <div role="radiogroup" aria-label="Operational structure" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {OPERATING_STRUCTURES.map((option) => (
              <SelectableCard
                key={option.id}
                title={option.title}
                description={option.description}
                indicator
                selected={structure === option.id}
                onClick={() => setStructure(option.id)}
              />
            ))}
          </div>
          {errors.structure && (
            <p role="alert" className="text-xs leading-4 text-rose-600">
              {errors.structure}
            </p>
          )}
        </section>

        <p className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-100/60 px-[17px] py-[11px] text-xs leading-4 font-medium text-slate-700 shadow-sm">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white">
            <img src={icons.shieldInfo} alt="" />
          </span>
          ABDM Health Facility Registry (HFR) auto-maps specialty taxonomies upon confirmation.
        </p>

        <div className="flex flex-col gap-3.5 border-t border-slate-200/70 pt-5">
          <Button type="submit" fullWidth trailing={<img src={icons.arrowRight} alt="" />}>
            Continue to Clinical Specialties
          </Button>
          <div className="flex justify-center">
            <TextLink to={ROUTES.contact} className="py-1 text-xs leading-4 font-semibold">
              <img src={icons.arrowLeft} alt="" />
              Back to practice contact
            </TextLink>
          </div>
        </div>
      </form>
    </OnboardingLayout>
  )
}
