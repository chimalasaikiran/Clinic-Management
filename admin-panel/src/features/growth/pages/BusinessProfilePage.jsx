import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH, GROWTH_BRANCHES } from '../constants'
import { useGrowth } from '../context/growthContext'
import { day } from '../format'

const CATEGORIES = ['Medical clinic', 'Dental clinic', 'Preventive healthcare clinic', 'Diagnostic centre']
const REQUIRED = [['business', 'Business name'], ['street', 'Street address'], ['city', 'City'], ['state', 'State'], ['postal', 'Postal code']]

export default function BusinessProfilePage() {
  const { data, setSingle } = useGrowth()
  const saved = data.profile
  const [values, setValues] = useState(saved)
  const [attempted, setAttempted] = useState(false)
  const [branch, setBranch] = useState(GROWTH_BRANCHES[0])
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const missing = REQUIRED.filter(([key]) => !String(values[key]).trim()).map(([, label]) => label)
  const dirtyKeys = Object.keys(values).filter((key) => values[key] !== saved[key])
  const hoursOrder = values.specialFrom && values.specialTo && values.specialTo <= values.specialFrom
  const errors = attempted ? Object.fromEntries(REQUIRED.filter(([key]) => !String(values[key]).trim()).map(([key, label]) => [key, `Enter the ${label.toLowerCase()}.`])) : {}

  const save = () => {
    setAttempted(true)
    if (missing.length || hoursOrder) return
    setSingle('profile', { ...values, specialSaved: Boolean(values.specialDate) })
  }

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} crumb="Owner Panel / Growth OS / Business Profile" code="GO-15" title="Business Profile & Locations" description="Manage ClinicOS branch details. Saving local values is separate from publishing to a provider." badge={dirtyKeys.length ? <StatusPill tone="warning">{dirtyKeys.length} unsaved change{dirtyKeys.length === 1 ? '' : 's'}</StatusPill> : null} context={[`Record branch · ${branch} · ${GROWTH_BRANCH.code}`, 'Entry: Growth OS → Business Profile · Return from review requests keeps the request-workflow token and unsaved configuration']} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-72 flex-1"><SelectInput label="Branch selector · scoped record" value={branch} onChange={(event) => setBranch(event.target.value)} options={GROWTH_BRANCHES} hint="Branch read/edit permissions must be checked on selection" /></div>
        <ActionButton to={ROUTES.reviews}>Reviews → GO16</ActionButton><ActionButton to={ROUTES.reviewRequests}>Review requests → GO18</ActionButton>
      </div>
      {values.specialDate && values.specialDate !== saved.specialDate && <Banner tone="warning" title={`Unsaved special hours · ${day(values.specialDate)}, ${values.specialFrom}–${values.specialTo}`} className="mb-6">This proposed exception is not saved or published. Regular hours are unchanged.</Banner>}

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Business details" aside="ClinicOS local · sample record">
            <StatusPill className="mb-4">Saved baseline, not persistence evidence</StatusPill>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><TextInput label="Business name" required value={values.business} onChange={(event) => set('business', event.target.value)} error={errors.business} /></div>
              <div className="sm:col-span-2"><TextInput label="Street address" required value={values.street} onChange={(event) => set('street', event.target.value)} error={errors.street} /></div>
              <TextInput label="City" required value={values.city} onChange={(event) => set('city', event.target.value)} error={errors.city} />
              <TextInput label="State" required value={values.state} onChange={(event) => set('state', event.target.value)} error={errors.state} />
              <TextInput label="Postal code" required inputMode="numeric" value={values.postal} onChange={(event) => set('postal', event.target.value)} error={errors.postal} />
              <SelectInput label="Country" required value={values.country} onChange={(event) => set('country', event.target.value)} options={['India']} />
              <div className="sm:col-span-2"><TextArea label="Business description" rows={3} value={values.description} onChange={(event) => set('description', event.target.value)} hint="Provider field length and support require a capability check" /></div>
              <SelectInput label="Primary category" required value={values.primary} onChange={(event) => set('primary', event.target.value)} options={CATEGORIES} />
              <SelectInput label="Secondary category" value={values.secondary} onChange={(event) => set('secondary', event.target.value)} options={CATEGORIES} />
            </div>
          </Section>
          <Section title="Special hours" aside="Local exception · not published">
            <div className="grid gap-4 sm:grid-cols-3"><TextInput label="Date" type="date" value={values.specialDate} onChange={(event) => set('specialDate', event.target.value)} /><TextInput label="Opens" type="time" value={values.specialFrom} onChange={(event) => set('specialFrom', event.target.value)} /><TextInput label="Closes" type="time" value={values.specialTo} onChange={(event) => set('specialTo', event.target.value)} error={hoursOrder ? 'Closing time must be after opening.' : undefined} /></div>
            <p className="mt-3 text-[11px] text-outline">{saved.specialSaved ? `Saved locally for ${day(saved.specialDate)}.` : 'No special-hours exception is saved.'} Regular hours are unchanged.</p>
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Provider-published values" aside="Separate lane">
            <p className="text-[13px] font-semibold">Google Business Profile · proposed</p><StatusPill tone="warning" className="my-3">Connection / ownership unverified</StatusPill>
            <p className="rounded-md bg-surface-low p-4 text-xs leading-5 text-on-surface-variant"><strong className="block text-[13px] text-on-surface">No provider snapshot received</strong>No registered provider identity, verified ownership or published values are supplied. Local values are not a provider snapshot.</p>
            <div className="mt-4 flex gap-3"><ActionButton disabled title="Verification needs a provider connection">Verify connection & capabilities</ActionButton><ActionButton disabled title="No connection to sync with">Sync to provider</ActionButton></div>
          </Section>
          <Section title="Local completeness"><p className={`text-[13px] font-semibold ${missing.length ? 'text-amber-700' : 'text-brand'}`}>{missing.length ? `Missing: ${missing.join(', ')}` : 'Required local fields populated; provider completeness not evaluated'}</p><p className="mt-2 text-xs text-on-surface-variant">Values are sample data. Saving local values does not publish anything.</p><p className="mt-2 text-xs"><Link to={ROUTES.reviewRequests} className="font-semibold text-brand hover:underline">Review-request workflow depends on a verified profile →</Link></p></Section>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">Save local values</strong>Saving stores ClinicOS values only. Publishing to a provider is a separate, gated action.</p>
        <ActionButton disabled={!dirtyKeys.length} onClick={() => { setValues(saved); setAttempted(false) }}>Discard changes</ActionButton>
        <ActionButton variant="brand" disabled={!dirtyKeys.length} onClick={save}>Save local values</ActionButton>
      </div>
      <GrowthFooter code="GO-15" back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} />
    </GrowthFrame>
  )
}
