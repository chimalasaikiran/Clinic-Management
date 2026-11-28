import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { useApiResource } from '../../../hooks/useApiResource'
import { cn } from '../../../lib/cn'
import { useAuth } from '../../auth/context/useAuth'
import LoadingState from '../../patients/components/LoadingState'
import { Check, TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { campaignsApi } from '../campaignsApi'
import { AUDIENCE_INCLUDE, AUDIENCE_STAGES, AUDIENCE_STATUSES, blankRules, formToRules, GENDERS, LEAD_SOURCES, rulesToForm } from '../campaignsView'
import { when } from '../format'
import { stampOf } from '../leadsView'
import { CHANNELS } from '../messagingView'
import { useLeadContext } from '../useLeads'

const COUNT_DELAY_MS = 400

export default function SegmentFormPage() {
  const { segmentId } = useParams()
  const audience = useApiResource(() => (segmentId ? campaignsApi.audience(segmentId) : Promise.resolve(null)), `audience-form:${segmentId ?? 'new'}`)
  if (segmentId && audience.error?.status === 404) {
    return (
      <GrowthFrame back={{ to: ROUTES.audiences, label: 'Back to Audience Management' }} crumb="Owner Panel / Growth OS / Audiences" title="Segment not found" sample="Live records">
        <Banner tone="warning" title="No segment matches this link">Open Audience Management to find the definition.</Banner>
      </GrowthFrame>
    )
  }
  if (segmentId && !audience.data) {
    return (
      <GrowthFrame back={{ to: ROUTES.audiences, label: 'Back to Audience Management' }} crumb="Owner Panel / Growth OS / Audiences" title="Create/Edit Audience Segment" sample="Live records">
        <LoadingState label="Loading the segment…" error={audience.error} onRetry={audience.reload} />
      </GrowthFrame>
    )
  }
  return <SegmentForm key={segmentId ?? 'new'} segment={audience.data} />
}

function SegmentForm({ segment }) {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { organisation } = useAuth()
  const context = useLeadContext()
  const orgWide = organisation?.branchScope === 'all'
  const [values, setValues] = useState({ name: segment?.name ?? '', purpose: segment?.purpose ?? '', branchId: segment ? segment.branch?.id ?? '' : context.branchId || (orgWide ? '' : context.branches[0]?.id ?? ''), status: segment?.status ?? 'draft', reason: '', confirmed: false })
  const [rules, setRules] = useState(segment ? rulesToForm(segment.rules) : blankRules())
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const apiRules = formToRules(rules)
  const changed = segment && JSON.stringify(formToRules(rulesToForm(segment.rules))) !== JSON.stringify(apiRules)
  const blocked = changed && (!values.confirmed || !values.reason.trim())
  const backPath = `${ROUTES.audiences}${state?.search ?? ''}`
  const set = (name, value) => { setValues((current) => ({ ...current, [name]: value })); setDirty(true) }
  const setRule = (name, value) => { setRules((current) => ({ ...current, [name]: value })); setDirty(true) }
  const toggle = (name, id) => setRule(name, rules[name].includes(id) ? rules[name].filter((entry) => entry !== id) : [...rules[name], id])
  const count = useLiveCount(values.branchId || null, apiRules)
  const leads = rules.include !== 'patients'
  const patients = rules.include !== 'leads'

  const save = async () => {
    const local = {}
    if (!values.name.trim()) local.name = 'Enter a segment name.'
    if (!values.purpose.trim()) local.purpose = 'Enter the purpose.'
    if (leads && !rules.leadStages.length) local['rules.leadStages'] = 'Choose at least one lead stage before saving.'
    setErrors(local)
    if (Object.keys(local).length || blocked) return
    setSaving(true)
    setMessage(null)
    const body = { name: values.name.trim(), purpose: values.purpose.trim(), branchId: values.branchId || null, status: values.status, rules: apiRules }
    try {
      if (segment) await campaignsApi.updateAudience(segment.id, { ...body, changeNote: changed ? values.reason.trim() : null, version: segment.version })
      else await campaignsApi.createAudience(body)
      navigate(backPath, { state })
    } catch (error) {
      setErrors(error.fieldErrors?.() ?? {})
      setMessage(error.message)
      setSaving(false)
    }
  }

  const number = (name, label, hint) => <TextInput label={label} inputMode="numeric" value={rules[name]} onChange={(event) => setRule(name, event.target.value.replace(/\D/g, ''))} error={errors[`rules.${name}`]} hint={hint} />

  return (
    <GrowthFrame back={{ to: backPath, label: 'Back to Audience Management' }} crumb={`Owner Panel / Growth OS / Audiences / ${segment ? `${segment.code} / Edit definition` : 'New segment'}`} title="Create/Edit Audience Segment" description={segment ? `Edit ${segment.code} · Changing who is included needs a reason and is kept in the history.` : 'Create a segment from rules over leads and patients. Saving sends nothing.'} context={[context.line, 'Search and filters are kept when you return']} today={context.today} sample="Live records · The size updates from current records as you edit">
      {message && <Banner tone="danger" title="Not saved" className="mb-6">{message}</Banner>}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Segment information" aside={segment ? `${segment.code} · * Required` : '* Required'}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><TextInput label="Segment name" required value={values.name} onChange={(event) => set('name', event.target.value)} error={errors.name} /></div>
              <div className="sm:col-span-2"><TextInput label="Purpose" required value={values.purpose} onChange={(event) => set('purpose', event.target.value)} error={errors.purpose} hint="What the audience is for · never a diagnosis or condition" /></div>
              <SelectInput label="Record branch" required value={values.branchId} onChange={(event) => set('branchId', event.target.value)} options={[...(orgWide ? [{ value: '', label: 'All branches' }] : []), ...context.branches.map((branch) => ({ value: branch.id, label: branch.name }))]} error={errors.branchId} hint="Leads by their branch, patients by their home branch" />
              <SelectInput label="Who to include" required value={rules.include} onChange={(event) => setRule('include', event.target.value)} options={Object.entries(AUDIENCE_INCLUDE).map(([value, label]) => ({ value, label }))} />
              <SelectInput label="Definition status" required value={values.status} onChange={(event) => set('status', event.target.value)} options={Object.entries(AUDIENCE_STATUSES).filter(([value]) => segment || value !== 'archived').map(([value, label]) => ({ value, label }))} hint="Only Ready segments can be sent to" />
            </div>
            {leads && <fieldset className="mt-4"><legend className="text-xs font-medium text-on-surface-variant">Lead lifecycle * · Choose at least one</legend><div className="mt-2 flex flex-wrap gap-2">{Object.entries(AUDIENCE_STAGES).map(([id, label]) => <label key={id} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium', rules.leadStages.includes(id) ? 'border-brand bg-teal-50 text-brand' : 'border-slate-300')}><input type="checkbox" checked={rules.leadStages.includes(id)} onChange={() => toggle('leadStages', id)} className="accent-[#006a61]" />{label}</label>)}</div>{errors['rules.leadStages'] && <p role="alert" className="mt-2 text-xs text-rose-600">{errors['rules.leadStages']}</p>}{segment && <p className="mt-2 text-[11px] text-outline">Saved v{segment.version}: {segment.description.join('; ')}</p>}</fieldset>}
          </Section>
          <Section title="Inclusion & exclusion criteria" aside="Rules, counted live">
            {leads && (
              <div className="mb-5">
                <p className="mb-2 text-[10px] font-semibold tracking-wide text-brand uppercase">Leads</p>
                <fieldset className="mb-4"><legend className="text-xs font-medium text-on-surface-variant">Source · any if none chosen</legend><div className="mt-2 flex flex-wrap gap-2">{Object.entries(LEAD_SOURCES).map(([id, label]) => <label key={id} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium', rules.leadSources.includes(id) ? 'border-brand bg-teal-50 text-brand' : 'border-slate-300')}><input type="checkbox" checked={rules.leadSources.includes(id)} onChange={() => toggle('leadSources', id)} className="accent-[#006a61]" />{label}</label>)}</div></fieldset>
                <div className="grid gap-4 sm:grid-cols-2"><TextInput label="Interest contains" value={rules.leadInterest} onChange={(event) => setRule('leadInterest', event.target.value)} hint="Matches the interest recorded on the lead" />{number('leadCreatedWithinDays', 'Recorded within (days)', 'Empty for any time')}</div>
              </div>
            )}
            {patients && (
              <div className="mb-5">
                <p className="mb-2 text-[10px] font-semibold tracking-wide text-brand uppercase">Patients · active records only</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  {number('patientVisitedWithinDays', 'Visited within (days)', 'A completed visit in this period')}
                  {number('patientNotVisitedForDays', 'No visit for (days)', 'Has visited before, but not in this period')}
                  {number('patientMinAge', 'Minimum age')}
                  {number('patientMaxAge', 'Maximum age')}
                  <SelectInput label="Gender" value={rules.patientGender} onChange={(event) => setRule('patientGender', event.target.value)} options={[{ value: '', label: 'Any' }, ...Object.entries(GENDERS).map(([value, label]) => ({ value, label }))]} />
                </div>
              </div>
            )}
            <Banner tone="warning" title="Exclude · always overrides inclusion">Opted-out contacts, people without recorded permission for marketing, inactive patient records and closed leads are never messaged.</Banner>
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Live size" aside="Current records">
            {leads && !rules.leadStages.length ? <p className="text-xs text-outline">Choose at least one lead stage to count the audience.</p> : !count.data ? <LoadingState label="Counting…" error={count.error} /> : (
              <>
                <p className="text-[13px] font-semibold">{count.data.leads} leads · {count.data.patients} patients</p>
                <ul className="mt-3 space-y-1 text-xs">{Object.entries(count.data.channels).map(([channel, reach]) => <li key={channel} className="flex justify-between"><span>{CHANNELS[channel]}</span><span><strong className="text-brand">{reach.reachable}</strong> can be reached · {reach.optedOut} opted out</span></li>)}</ul>
              </>
            )}
          </Section>
          <Section title="Review before save" aside={changed ? 'Rules changed' : 'Not confirmed'}>
            {changed ? <><p className="text-xs">Saved → proposed</p><p className="text-[13px] font-semibold">{segment.description.join('; ')} → {count.data?.description.join('; ') ?? '…'}</p><div className="mt-3"><TextArea label="Change reason" required rows={2} value={values.reason} onChange={(event) => set('reason', event.target.value)} error={errors.changeNote} /></div><div className="mt-3"><Check checked={values.confirmed} onChange={(event) => set('confirmed', event.target.checked)} label="I confirm the old → new criteria and reason." /></div></> : <p className="text-xs text-on-surface-variant">{segment ? 'No change to who is included.' : 'A new definition starts at version 1.'}</p>}
            <Banner title="Saving sends nothing" className="mt-4">Broadcasts are sent from a campaign, after a confirmation showing exactly who will be reached.</Banner>
          </Section>
          {segment && <Section title="Version history" aside="Append only"><ul className="space-y-2 text-xs">{segment.versions.map((version) => <li key={version.version}><strong>v{version.version}</strong> · {version.changeNote} <span className="text-outline">· {version.actor} · {when(stampOf(version.createdAt))}</span></li>)}{changed && <li className="text-amber-700"><strong>Next version</strong> · Unsaved proposal</li>}</ul></Section>}
          {leaving && <Banner tone="warning" title="Discard the proposed changes?" action={<div className="flex gap-2"><ActionButton onClick={() => setLeaving(false)}>Keep editing</ActionButton><ActionButton variant="danger" onClick={() => navigate(backPath)}>Discard proposal</ActionButton></div>}>Discard keeps the saved definition and returns to the audience list.</Banner>}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">Save definition only</strong>Nothing is sent or exported on save.</p>
        <ActionButton onClick={() => (dirty ? setLeaving(true) : navigate(backPath))}>Cancel</ActionButton>
        <ActionButton variant="brand" disabled={blocked || saving} onClick={save}>{saving ? 'Saving…' : 'Save definition'}</ActionButton>
      </div>
      <GrowthFooter back={{ to: backPath, label: 'Back to Audience Management · All list context retained' }} />
    </GrowthFrame>
  )
}

// Counts the rules a moment after the last change, so typing does not send a request per key.
function useLiveCount(branchId, rules) {
  const key = JSON.stringify({ branchId, rules })
  const [settled, setSettled] = useState(key)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(key), COUNT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [key])
  const valid = rules.include === 'patients' || rules.leadStages.length > 0
  return useApiResource(() => (valid ? campaignsApi.countAudience(JSON.parse(settled)) : Promise.resolve(null)), `count:${settled}:${valid}`)
}
