import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import Button from '../../../components/ui/Button'
import { controlClass } from '../../../components/ui/fieldStyles'
import PageHeading from '../../../components/ui/PageHeading'
import SectionLabel from '../../../components/ui/SectionLabel'
import SelectableCard from '../../../components/ui/SelectableCard'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { isBlank } from '../../../lib/validators'
import OnboardingLayout from '../components/OnboardingLayout'
import { ONBOARDING_STEPS } from '../data/onboardingSteps'
import { SPECIALTIES } from '../data/specialties'
import { validateSpecialties } from '../validation'

function IconButton({ icon, label, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="rounded-lg p-1.5 transition-colors hover:bg-slate-100"
      {...props}
    >
      <img src={icon} alt="" />
    </button>
  )
}

function DepartmentForm({ onAdd, onCancel }) {
  const [name, setName] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()
    if (isBlank(name)) return
    onAdd(name.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <input
        autoFocus
        aria-label="Department name"
        placeholder="Department or clinical wing name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className={cn(controlClass, 'h-10 min-w-0 flex-1 px-3')}
      />
      <Button type="submit" className="min-h-10 px-4 py-2" disabled={isBlank(name)}>
        Add
      </Button>
      <TextLink onClick={onCancel} className="px-2 text-xs leading-4 font-semibold">
        Cancel
      </TextLink>
    </form>
  )
}

export default function ClinicalSpecialtiesPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState([])
  const [query, setQuery] = useState('')
  const [departments, setDepartments] = useState([])
  const [addingDepartment, setAddingDepartment] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validateSpecialties(selected) : {}

  const visibleSpecialties = SPECIALTIES.filter((specialty) =>
    `${specialty.name} ${specialty.focus}`.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const toggleSpecialty = (id) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))

  const addDepartment = (name) => {
    setDepartments((current) => [...current, { id: crypto.randomUUID(), name }])
    setAddingDepartment(false)
  }

  const removeDepartment = (id) => setDepartments((current) => current.filter((item) => item.id !== id))

  const handleSubmit = (event) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validateSpecialties(selected)).length > 0) return
    navigate(ROUTES.complete)
  }

  return (
    <OnboardingLayout step={ONBOARDING_STEPS.specialties} formSide="right" assurance="line">
      <PageHeading
        title="What specialties does your clinic offer?"
        description="Select the clinical specialties available at this facility to configure consultation modules, electronic prescription dictionaries, and ABDM encounter classifications. You can add or modify these at any time."
      />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col pt-7">
        <section className="flex flex-col gap-4 pt-1">
          <SectionLabel title="Clinical specialties" required tag="Multi-select enabled" bordered={false} />

          <div className="relative">
            <img src={icons.search} alt="" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2" />
            <input
              type="search"
              aria-label="Search specialties"
              placeholder="Search specialties (e.g. Cardiology, Orthopedics, Pediatrics)..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={cn(controlClass, 'h-12 truncate pr-16 pl-10 shadow-sm')}
            />
            <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-slate-200 bg-slate-100 px-[7px] py-[3px] font-sans text-[10px] leading-[15px] text-slate-400">
              ⌘K
            </kbd>
          </div>

          <div role="group" aria-label="Clinical specialties" className="grid grid-cols-2 gap-2.5 pt-1 sm:grid-cols-3">
            {visibleSpecialties.map((specialty) => (
              <SelectableCard
                key={specialty.id}
                role="checkbox"
                title={specialty.name}
                description={specialty.focus}
                indicator
                compact
                selected={selected.includes(specialty.id)}
                onClick={() => toggleSpecialty(specialty.id)}
                className="items-center"
              />
            ))}
            <button
              type="button"
              className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 bg-white/70 p-3.5 text-left transition hover:border-slate-400"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-xs leading-4 font-semibold text-slate-700">+ Other Specialty</span>
                <span className="text-[10px] leading-[15px] text-slate-400">Custom ABDM Code</span>
              </span>
              <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-slate-100">
                <img src={icons.plusSmall} alt="" />
              </span>
            </button>
          </div>
          {errors.specialties && (
            <p role="alert" className="text-xs leading-4 text-rose-600">
              {errors.specialties}
            </p>
          )}
        </section>

        <section className="mt-7 flex flex-col gap-4 border-t border-slate-200/80 pt-[13px]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm leading-5 font-bold tracking-[-0.35px] text-ink">
                  How would you like to organize your clinic?
                </h2>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] leading-[15px] font-bold tracking-[0.5px] text-slate-500 uppercase">
                  Optional
                </span>
              </div>
              <p className="text-xs leading-4 text-slate-500">
                Add departments if your clinic uses them to organize clinical teams, nursing wings, or billing
                sub-units.
              </p>
            </div>
          </div>

          {departments.map((department) => (
            <div
              key={department.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-[15px]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-slate-50">
                  <img src={icons.department} alt="" />
                </span>
                <div className="flex min-w-0 flex-col gap-px">
                  <span className="truncate text-xs leading-4 font-bold text-ink">{department.name}</span>
                  <span className="text-[11px] leading-[16.5px] text-slate-500">Clinical Division</span>
                </div>
              </div>
              <IconButton
                icon={icons.trash}
                label={`Delete ${department.name}`}
                onClick={() => removeDepartment(department.id)}
              />
            </div>
          ))}

          {addingDepartment ? (
            <DepartmentForm onAdd={addDepartment} onCancel={() => setAddingDepartment(false)} />
          ) : (
            <button
              type="button"
              onClick={() => setAddingDepartment(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white/60 px-[17px] py-[11px] text-xs leading-4 font-semibold text-slate-700 transition hover:border-slate-400"
            >
              <img src={icons.plus} alt="" />
              Add another department or clinical wing
            </button>
          )}
        </section>

        <div className="flex flex-col gap-4 pt-7">
          <Button type="submit" fullWidth trailing={<img src={icons.arrowRight} alt="" />}>
            Complete Practice Setup & Launch Workspace
          </Button>
          <div className="flex justify-center">
            <TextLink to={ROUTES.operations} className="text-xs leading-4 font-medium">
              <img src={icons.arrowLeft} alt="" />
              Back to operating model
            </TextLink>
          </div>
        </div>
      </form>
    </OnboardingLayout>
  )
}
