import { useState } from 'react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { Check, TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { contentApi } from '../contentApi'
import { PROFILE_CATEGORIES } from '../contentView'
import { day, when } from '../format'
import { clinicNow, stampOf } from '../leadsView'
import { useLeadContext } from '../useLeads'

const REQUIRED = [['businessName', 'Business name'], ['street', 'Street address'], ['city', 'City'], ['state', 'State'], ['postalCode', 'PIN code'], ['primaryCategory', 'Primary category']]
const FIELDS = ['businessName', 'street', 'city', 'state', 'postalCode', 'description', 'primaryCategory', 'secondaryCategory', 'phone', 'websiteUrl', 'reviewUrl', 'googleLocation']

export default function BusinessProfilePage() {
  const context = useLeadContext()
  const [branchId, setBranchId] = useState(context.branchId || context.branches[0]?.id || '')
  const chosen = branchId || context.branches[0]?.id || ''
  const resource = useApiResource(() => (chosen ? contentApi.profile(chosen) : Promise.resolve(null)), `profile:${chosen}`)

  return (
    <GrowthFrame back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} crumb="Owner Panel / Growth OS / Business Profile" code="GO-15" title="Business Profile & Locations" description="Keep each branch’s public details, review link and special hours, and publish them to its Google Business Profile." context={[context.line, 'Saving stores ClinicOS values; syncing publishes them to Google']} today={context.today} sample="Live records · Synced to Google only when you choose to">
      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="min-w-72 flex-1"><SelectInput label="Branch" value={chosen} onChange={(event) => setBranchId(event.target.value)} options={context.branches.map((branch) => ({ value: branch.id, label: branch.name }))} hint="Branches your role covers" /></div>
        <ActionButton to={ROUTES.reviews}>Reviews → GO16</ActionButton><ActionButton to={ROUTES.reviewRequests}>Review requests → GO18</ActionButton>
      </div>
      {!resource.data ? <LoadingState label="Loading the profile…" error={resource.error} onRetry={resource.reload} /> : <ProfileForm key={`${chosen}:${resource.data.profile.version}`} data={resource.data} reload={resource.reload} />}
      <GrowthFooter code="GO-15" back={{ to: ROUTES.growth, label: 'Growth OS · Owner overview' }} />
    </GrowthFrame>
  )
}

function ProfileForm({ data, reload }) {
  const { can } = useAuth()
  const saved = data.profile
  const initial = { ...Object.fromEntries(FIELDS.map((field) => [field, saved[field] ?? ''])), specialHours: saved.specialHours }
  const [values, setValues] = useState(initial)
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmSync, setConfirmSync] = useState(false)
  const locations = useApiResource(() => (data.googleConnected && can('growth.manage') ? contentApi.googleLocations() : Promise.resolve([])), `google-locations:${data.googleConnected}`)
  const manage = can('growth.manage')
  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const dirty = JSON.stringify(values) !== JSON.stringify(initial)
  const missing = REQUIRED.filter(([key]) => !String(values[key] ?? '').trim()).map(([, label]) => label)
  const badHours = values.specialHours.some((entry) => !entry.date || (!entry.closed && (!entry.opensAt || !entry.closesAt || entry.closesAt <= entry.opensAt)))
  const errors = { ...(attempted ? Object.fromEntries(REQUIRED.filter(([key]) => !String(values[key] ?? '').trim()).map(([key, label]) => [key, `Enter the ${label.toLowerCase()}.`])) : {}), ...serverErrors }
  const setHours = (index, patch) => set('specialHours', values.specialHours.map((entry, position) => (position === index ? { ...entry, ...patch } : entry)))

  const save = async () => {
    setAttempted(true)
    if (missing.length || badHours) return
    setBusy(true)
    setMessage(null)
    setServerErrors({})
    try {
      await contentApi.saveProfile(data.branch.id, { ...values, secondaryCategory: values.secondaryCategory || null, ...(data.saved ? { version: saved.version } : {}) })
      reload()
    } catch (error) {
      setServerErrors(error.fieldErrors?.() ?? {})
      setMessage({ tone: 'danger', title: 'Not saved', text: error.message })
      setBusy(false)
    }
  }
  const sync = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await contentApi.syncProfile(data.branch.id, saved.version)
      reload()
    } catch (error) {
      setMessage({ tone: 'danger', title: 'Not synced', text: error.message })
      setBusy(false)
    }
  }

  return (
    <>
      {message && <Banner tone={message.tone} title={message.title} className="mb-6">{message.text}</Banner>}
      {!data.saved && <Banner tone="brand" title="No profile saved for this branch yet" className="mb-6">The branch name, city and state are filled in from the branch record. Complete the rest and save.</Banner>}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Business details" aside={data.saved ? `Version ${saved.version}${saved.updatedBy ? ` · ${saved.updatedBy}` : ''}` : 'Not saved'}>
            <fieldset disabled={!manage} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><TextInput label="Business name" required value={values.businessName} onChange={(event) => set('businessName', event.target.value)} error={errors.businessName} /></div>
              <div className="sm:col-span-2"><TextInput label="Street address" required value={values.street} onChange={(event) => set('street', event.target.value)} error={errors.street} /></div>
              <TextInput label="City" required value={values.city} onChange={(event) => set('city', event.target.value)} error={errors.city} />
              <TextInput label="State" required value={values.state} onChange={(event) => set('state', event.target.value)} error={errors.state} />
              <TextInput label="PIN code" required inputMode="numeric" value={values.postalCode} onChange={(event) => set('postalCode', event.target.value.replace(/\D/g, '').slice(0, 6))} error={errors.postalCode} />
              <TextInput label="Phone" inputMode="numeric" value={values.phone} onChange={(event) => set('phone', event.target.value.replace(/\D/g, ''))} error={errors.phone} hint="Optional · the clinic’s public number" />
              <div className="sm:col-span-2"><TextArea label="Business description" rows={3} value={values.description} onChange={(event) => set('description', event.target.value)} error={errors.description} hint={`${values.description.length} / 750 · published to Google when you sync`} /></div>
              <SelectInput label="Primary category" required value={values.primaryCategory} onChange={(event) => set('primaryCategory', event.target.value)} options={[{ value: '', label: 'Choose a category' }, ...PROFILE_CATEGORIES.map((entry) => ({ value: entry, label: entry }))]} error={errors.primaryCategory} />
              <SelectInput label="Secondary category" value={values.secondaryCategory} onChange={(event) => set('secondaryCategory', event.target.value)} options={[{ value: '', label: 'None' }, ...PROFILE_CATEGORIES.map((entry) => ({ value: entry, label: entry }))]} />
              <div className="sm:col-span-2"><TextInput label="Website" value={values.websiteUrl} onChange={(event) => set('websiteUrl', event.target.value)} error={errors.websiteUrl} hint="Optional · https://" /></div>
              <div className="sm:col-span-2"><TextInput label="Public review link" value={values.reviewUrl} onChange={(event) => set('reviewUrl', event.target.value)} error={errors.reviewUrl} hint="Google’s “Ask for reviews” link · used by review requests (GO18)" /></div>
            </fieldset>
          </Section>
          <Section title="Special hours" aside="Days that differ from the usual hours">
            {values.specialHours.length === 0 && <p className="mb-3 text-xs text-outline">No special hours from today on.</p>}
            <ul className="space-y-3">{values.specialHours.map((entry, index) => (
              <li key={index} className="grid items-end gap-3 sm:grid-cols-[1fr_110px_110px_auto_auto]">
                <TextInput label="Date" type="date" min={clinicNow().date} disabled={!manage} value={entry.date} onChange={(event) => setHours(index, { date: event.target.value })} />
                <TextInput label="Opens" type="time" disabled={!manage || entry.closed} value={entry.opensAt ?? ''} onChange={(event) => setHours(index, { opensAt: event.target.value })} />
                <TextInput label="Closes" type="time" disabled={!manage || entry.closed} value={entry.closesAt ?? ''} onChange={(event) => setHours(index, { closesAt: event.target.value })} error={!entry.closed && entry.opensAt && entry.closesAt && entry.closesAt <= entry.opensAt ? 'After opening' : undefined} />
                <Check checked={entry.closed} disabled={!manage} onChange={(event) => setHours(index, { closed: event.target.checked, ...(event.target.checked ? { opensAt: null, closesAt: null } : {}) })} label="Closed" />
                {manage && <ActionButton onClick={() => set('specialHours', values.specialHours.filter((_, position) => position !== index))}>Remove</ActionButton>}
              </li>))}</ul>
            {manage && <ActionButton className="mt-3" onClick={() => set('specialHours', [...values.specialHours, { date: '', closed: false, opensAt: '10:00', closesAt: '14:00' }])}>+ Add a day</ActionButton>}
            {badHours && attempted && <p role="alert" className="mt-2 text-xs text-rose-600">Each day needs a date and either opening and closing times or “Closed”.</p>}
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Google Business Profile" aside={data.googleConnected ? 'Connected' : 'Not connected'}>
            <StatusPill tone={data.googleConnected ? 'success' : 'warning'}>{data.googleConnected ? 'Account connected' : 'Connect on the Channels screen'}</StatusPill>
            {data.googleConnected && manage && (
              <div className="mt-4"><SelectInput label="Google location for this branch" value={values.googleLocation} onChange={(event) => set('googleLocation', event.target.value)} options={[{ value: '', label: locations.data ? 'Not linked' : 'Loading locations…' }, ...(locations.data ?? []).map((location) => ({ value: location.name, label: `${location.title} · ${location.name}` }))]} error={errors.googleLocation || locations.error?.message} hint="Reviews and syncing use this location" /></div>
            )}
            <p className="mt-3 text-xs leading-5 text-on-surface-variant">{saved.syncedAt ? `Last synced ${when(stampOf(saved.syncedAt))}.` : 'Not synced yet.'} {saved.reviewsSyncedAt ? `Reviews fetched ${when(stampOf(saved.reviewsSyncedAt))}.` : ''}</p>
            {saved.syncError && <Banner tone="danger" title="Last Google call failed" className="mt-3">{saved.syncError}</Banner>}
            {manage && data.saved && saved.googleLocation && data.googleConnected && (
              <div className="mt-4 rounded-md bg-surface-low p-3 text-xs">
                <p className="font-semibold">Sync to Google</p><p className="mt-1">Publishes the saved description and {saved.specialHours.length} special-hours day{saved.specialHours.length === 1 ? '' : 's'} to {saved.googleLocation}.</p>
                <div className="mt-3"><Check checked={confirmSync} onChange={(event) => setConfirmSync(event.target.checked)} label="I confirm these details are correct for the public listing." /></div>
                <ActionButton className="mt-3" variant="brand" disabled={busy || dirty || !confirmSync} title={dirty ? 'Save the changes first' : undefined} onClick={sync}>Sync to Google</ActionButton>
                {dirty && <p className="mt-2 text-amber-700">Save your changes before syncing.</p>}
              </div>
            )}
          </Section>
          <Section title="Completeness"><p className={`text-[13px] font-semibold ${missing.length ? 'text-amber-700' : 'text-brand'}`}>{missing.length ? `Missing: ${missing.join(', ')}` : 'Required details filled'}</p><p className="mt-2 text-xs text-on-surface-variant">{values.reviewUrl ? 'Review requests can use this branch’s link.' : 'Without a review link, review requests for this branch are skipped.'}</p><p className="mt-2 text-xs"><Link to={ROUTES.reviewRequests} className="font-semibold text-brand hover:underline">Review-request workflow →</Link></p>{saved.specialHours[0] && <p className="mt-2 text-[11px] text-outline">Next special day: {day(saved.specialHours[0].date)}</p>}</Section>
        </div>
      </div>
      {manage && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
          <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">Save ClinicOS values</strong>Saving does not publish anything. Sync to Google is a separate, confirmed step.</p>
          <ActionButton disabled={!dirty || busy} onClick={() => { setValues(initial); setAttempted(false) }}>Discard changes</ActionButton>
          <ActionButton variant="brand" disabled={(!dirty && data.saved) || busy} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</ActionButton>
        </div>
      )}
    </>
  )
}
