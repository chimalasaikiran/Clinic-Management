import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { icons } from '../../../assets/icons'
import PageHeading from '../../../components/ui/PageHeading'
import SectionLabel from '../../../components/ui/SectionLabel'
import SelectableCard from '../../../components/ui/SelectableCard'
import SelectField from '../../../components/ui/SelectField'
import TextField from '../../../components/ui/TextField'
import TextLink from '../../../components/ui/TextLink'
import { ROUTES } from '../../../config/routes'
import { CheckOption, FieldError, Notice, StepActions } from '../components/InsuranceKit'
import InsuranceLayout from '../components/InsuranceLayout'
import { useInsuranceSetup } from '../context/useInsuranceSetup'
import { BILLING_METHODS } from '../data/options'
import { validateAcceptance, validateUnlistedPartner } from '../validation'

const toggle = (list, id) => (list.includes(id) ? list.filter((value) => value !== id) : [...list, id])

export default function AcceptancePage() {
  const navigate = useNavigate()
  const { draft, partners, update, addPartner, saveAcceptance, ready, error } = useInsuranceSetup()
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState('')
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [adding, setAdding] = useState(false)
  const [unlisted, setUnlisted] = useState({ name: '', type: '' })
  const [unlistedErrors, setUnlistedErrors] = useState({})
  const errors = submitted ? validateAcceptance(draft) : {}

  const search = query.trim().toLowerCase()
  const shown = partners.filter((partner) => !search || partner.name.toLowerCase().includes(search))
  const accepting = draft.acceptance === 'yes'

  const handleAdd = () => {
    const found = validateUnlistedPartner(unlisted, partners.map((partner) => partner.name))
    setUnlistedErrors(found)
    if (Object.keys(found).length) return
    addPartner(unlisted.name, unlisted.type)
    setUnlisted({ name: '', type: '' })
    setAdding(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitted(true)
    setFailure('')
    if (Object.keys(validateAcceptance(draft)).length) return
    setPending(true)
    try {
      await saveAcceptance()
      navigate(accepting ? ROUTES.insuranceAgreement : ROUTES.dashboard)
    } catch (failed) {
      setFailure(failed.message)
      setPending(false)
    }
  }

  if (!ready) {
    return (
      <InsuranceLayout step={1}>
        <PageHeading title="How will your clinic accept insurance?" description={error ? error.message : 'Loading your insurance setup…'} />
      </InsuranceLayout>
    )
  }

  return (
    <InsuranceLayout step={1}>
      <PageHeading title="How will your clinic accept insurance?" description="Choose how your organization handles insurance, then add the insurers or TPAs you work with." />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-7 pt-7">
        <section className="flex flex-col gap-3">
          <SectionLabel title="Insurance acceptance" tag="Required" />
          <div role="radiogroup" aria-label="Insurance acceptance" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <SelectableCard title="Yes, accept insurance" description="Configure partners now" indicator selected={accepting} onClick={() => update({ acceptance: 'yes' })} />
            <SelectableCard title="Not at the moment" description="Set this up later" indicator selected={draft.acceptance === 'no'} onClick={() => update({ acceptance: 'no' })} />
          </div>
          <FieldError>{errors.acceptance}</FieldError>
          {accepting && (
            <div className="flex flex-wrap gap-5">
              {BILLING_METHODS.map((method) => (
                <CheckOption key={method.id} checked={draft.methods.includes(method.id)} onChange={() => update({ methods: toggle(draft.methods, method.id) })}>
                  {method.label}
                </CheckOption>
              ))}
            </div>
          )}
          <FieldError>{errors.methods}</FieldError>
        </section>

        {accepting && (
          <section className="flex flex-col gap-3">
            <SectionLabel title="Insurers & TPAs" tag={`${draft.partnerIds.length} selected`} />
            <p className="text-xs leading-[18px] text-slate-500">Select at least one partner. Selection alone does not establish an empanelment or a cashless agreement.</p>
            <TextField type="search" aria-label="Search insurer or TPA" placeholder="Search insurer or TPA by name" startIcon={icons.search} value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="flex flex-col gap-2.5">
              {shown.map((partner) => (
                <SelectableCard
                  key={partner.id}
                  role="checkbox"
                  title={partner.name}
                  description={`${partner.type} · ${partner.unlisted ? 'Added by you' : 'India'}`}
                  icon={partner.type === 'TPA' ? icons.hubBuilding : icons.shieldCheck}
                  indicator
                  selected={draft.partnerIds.includes(partner.id)}
                  onClick={() => update({ partnerIds: toggle(draft.partnerIds, partner.id) })}
                />
              ))}
              {!shown.length && <p className="text-xs text-slate-500">No partner matches “{query}”. Add it as an unlisted partner below.</p>}
            </div>
            <FieldError>{errors.partners}</FieldError>

            {adding ? (
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
                <TextField label="Partner name" required value={unlisted.name} onChange={(event) => setUnlisted((current) => ({ ...current, name: event.target.value }))} error={unlistedErrors.name} />
                <SelectField label="Partner type" required placeholder="Choose type" options={['Insurer', 'TPA']} value={unlisted.type} onChange={(event) => setUnlisted((current) => ({ ...current, type: event.target.value }))} error={unlistedErrors.type} />
                <div className="flex gap-4 text-xs font-semibold">
                  <TextLink tone="teal" onClick={handleAdd}>
                    Add partner
                  </TextLink>
                  <TextLink onClick={() => setAdding(false)}>Cancel</TextLink>
                </div>
              </div>
            ) : (
              <TextLink tone="teal" onClick={() => setAdding(true)} className="self-start text-xs font-semibold">
                + Add an unlisted partner
              </TextLink>
            )}
          </section>
        )}

        <Notice title="For your clinic, not a patient policy">
          Add organization-level agreements and branch coverage next. No patient policy number or personal insurance details are required.
        </Notice>

        <FieldError>{failure}</FieldError>
        <StepActions
          pending={pending}
          submitLabel={pending ? 'Saving…' : draft.acceptance === 'no' ? 'Save and return to workspace' : 'Continue to agreement details'}
          back={
            <TextLink to={ROUTES.dashboard}>
              <img src={icons.arrowLeft} alt="" />
              Back to workspace
            </TextLink>
          }
          secondary={
            <TextLink tone="teal" to={ROUTES.dashboard}>
              Skip for now
            </TextLink>
          }
        />
      </form>
    </InsuranceLayout>
  )
}
