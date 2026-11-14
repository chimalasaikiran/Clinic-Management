import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { Check, TextArea } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCHES, GROWTH_TODAY, LEAD_STAGES } from '../constants'
import { useGrowth } from '../context/growthContext'
import { validateSegment } from '../growthLogic'

const CHANNELS = ['Paid-search audience', 'WhatsApp / SMS', 'SMS / Email', 'Email / WhatsApp']
const INTERESTS = ['Recorded preventive screening inquiry interest', 'Recorded general dental inquiry interest', 'Recorded follow-up preference', 'Recorded wellness inquiry interest']
const LIFECYCLE = LEAD_STAGES.slice(0, 4)

export default function SegmentFormPage() {
  const { segmentId } = useParams()
  const { data } = useGrowth()
  const segment = segmentId ? data.segments.find((entry) => entry.id === segmentId) : null
  if (segmentId && !segment) {
    return (
      <GrowthFrame back={{ to: ROUTES.audiences, label: 'Back to Audience Management' }} crumb="Owner Panel / Growth OS / Audiences" code="GO-10A" title="Segment not found">
        <Banner tone="warning" title="No segment matches this link">Open Audience Management to find the definition.</Banner>
      </GrowthFrame>
    )
  }
  return <SegmentForm key={segmentId ?? 'new'} segment={segment} />
}

function SegmentForm({ segment }) {
  const { add, update, newId } = useGrowth()
  const navigate = useNavigate()
  const { state } = useLocation()
  const [values, setValues] = useState({ name: segment?.name ?? '', purpose: segment?.purpose ?? '', branch: segment?.branch ?? GROWTH_BRANCHES[0], channel: segment?.channel ?? CHANNELS[0], interest: segment?.interest ?? INTERESTS[0], lifecycle: segment?.lifecycle ?? [], reason: '', criteria: false, scope: false })
  const [attempted, setAttempted] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const errors = attempted ? validateSegment(values) : {}
  const changed = segment && values.lifecycle.join() !== segment.lifecycle.join()
  const blocked = Boolean(segment) && (!values.scope || (changed && (!values.criteria || !values.reason.trim())))
  const backPath = `${ROUTES.audiences}${state?.search ?? ''}`
  const set = (name, value) => { setValues((current) => ({ ...current, [name]: value })); setDirty(true) }
  const toggle = (stage) => set('lifecycle', values.lifecycle.includes(stage) ? values.lifecycle.filter((entry) => entry !== stage) : [...values.lifecycle, stage])

  const save = () => {
    setAttempted(true)
    if (Object.keys(validateSegment(values)).length || blocked) return
    const fields = { name: values.name.trim(), purpose: values.purpose.trim(), branch: values.branch, channel: values.channel, interest: values.interest, lifecycle: values.lifecycle, updated: GROWTH_TODAY }
    if (segment) update('segments', segment.id, (current) => ({ ...fields, version: changed ? current.version + 1 : current.version, versions: changed ? [...current.versions, { v: current.version + 1, note: `Lifecycle ${current.lifecycle.join(' / ')} → ${values.lifecycle.join(' / ')}. Reason: ${values.reason.trim()}` }] : current.versions }))
    else add('segments', { id: newId('SEG', 'segments', 3).replace(/^SEG(\d{3})$/, 'SEG$1'), status: 'Draft', version: 1, criteria: `${values.interest}; lead lifecycle ${values.lifecycle.join(', ')}`, versions: [{ v: 1, note: 'Draft definition created.' }], ...fields })
    navigate(backPath, { state })
  }

  return (
    <GrowthFrame back={{ to: backPath, label: 'Back to Audience Management · GO10' }} crumb={`Owner Panel / Growth OS / Audiences / ${segment ? `${segment.id} / Edit definition` : 'New segment'}`} code="GO-10A" title="Create/Edit Audience Segment" description={segment ? `Edit ${segment.id} · Review a definition change without calculating eligibility or activating an audience.` : 'Create a segment definition. Saving does not query patients or activate an audience.'} context={['Audience list origin · Aura Health · All locations (3)', 'Search, branch, definition, lifecycle and channel filters are kept when you return']}>
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Segment information" aside={segment ? `${segment.id} · * Required` : '* Required'}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><TextInput label="Segment name" required value={values.name} onChange={(event) => set('name', event.target.value)} error={errors.name} /></div>
              <div className="sm:col-span-2"><TextInput label="Purpose" required value={values.purpose} onChange={(event) => set('purpose', event.target.value)} error={errors.purpose} hint="Inquiry interest only · no diagnosis inference or sensitive condition targeting" /></div>
              <SelectInput label="Record branch" required value={values.branch} onChange={(event) => set('branch', event.target.value)} options={GROWTH_BRANCHES} hint="Not the global all-location scope" />
              <SelectInput label="Proposed channel" required value={values.channel} onChange={(event) => set('channel', event.target.value)} options={CHANNELS} hint="Consent + integration pending; not eligible" />
              <div className="sm:col-span-2"><SelectInput label="Permitted inquiry interest" required value={values.interest} onChange={(event) => set('interest', event.target.value)} options={INTERESTS} hint="Only permitted recorded interest; no inferred health conditions" /></div>
            </div>
            <fieldset className="mt-4"><legend className="text-xs font-medium text-on-surface-variant">Lead lifecycle * · Choose at least one</legend><div className="mt-2 flex flex-wrap gap-2">{LIFECYCLE.map((stage) => <label key={stage} className={cn('flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium', values.lifecycle.includes(stage) ? 'border-brand bg-teal-50 text-brand' : 'border-slate-300')}><input type="checkbox" checked={values.lifecycle.includes(stage)} onChange={() => toggle(stage)} className="accent-[#006a61]" />{stage}</label>)}</div>{errors.lifecycle && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.lifecycle}</p>}{segment && <p className="mt-2 text-[11px] text-outline">Saved v{segment.version}: {segment.lifecycle.join(' / ')}</p>}</fieldset>
          </Section>
          <Section title="Inclusion & exclusion criteria" aside="Rules, not results">
            <Banner tone="brand" title="Include · all rules required">{values.branch} inquiry scope AND {values.interest.toLowerCase()} AND known adult age eligibility. Never infer adulthood when age is unknown.</Banner>
            <Banner tone="warning" title="Exclude · always overrides inclusion" className="mt-3">Unknown age or consent; withdrawn consent; opt-outs; DND; suppressed identities; disallowed channel or purpose preferences.</Banner>
          </Section>
          <Section title="Channel, consent & contact safeguards" aside="Pre-activation checks"><ul className="space-y-3 text-xs leading-5 text-on-surface-variant"><li><strong className="text-on-surface">Consent requirement</strong> · Current channel-specific consent for the proposed purpose · not verified</li><li><strong className="text-on-surface">Contact preferences</strong> · Respect permitted channel, purpose, frequency and contact time</li><li><strong className="text-on-surface">Opt-outs / DND / suppression</strong> · Check before any activation; suppression takes precedence</li></ul><Banner tone="warning" title="INTEGRATION DEPENDENT · no connector or consent verified" className="mt-4">Saving this definition does not establish channel eligibility. Eligibility is not calculated and is not a zero count.</Banner></Section>
        </div>
        <div className="space-y-6">
          <Section title="Review before save" aside="Not confirmed">
            {changed ? <><p className="text-xs">Lead lifecycle · saved → proposed</p><p className="text-[13px] font-semibold">{segment.lifecycle.join(' / ')} → {values.lifecycle.join(' / ') || 'none'}</p><div className="mt-3"><TextArea label="Change reason" required rows={2} value={values.reason} onChange={(event) => set('reason', event.target.value)} /></div><div className="mt-3"><Check checked={values.criteria} onChange={(event) => set('criteria', event.target.checked)} label="I confirm the old → new criteria and reason." /></div></> : <p className="text-xs text-on-surface-variant">{segment ? 'No criteria change proposed.' : 'A new definition starts as Draft v1.'}</p>}
            {segment && <div className="mt-3"><Check checked={values.scope} onChange={(event) => set('scope', event.target.checked)} label="Verify definition-write and branch scope" /></div>}
            <Banner title="Validation ≠ eligibility" className="mt-4">Required fields are checked for structure only. Eligibility evaluation has not been requested.</Banner>
          </Section>
          {segment && <Section title="Version history" aside="Append only"><ul className="space-y-2 text-xs">{segment.versions.map((version) => <li key={version.v}><strong>v{version.v}</strong> · {version.note}</li>)}{changed && <li className="text-amber-700"><strong>v{segment.version + 1}</strong> · Unsaved proposal</li>}</ul></Section>}
          {leaving && <Banner tone="warning" title="Discard the proposed changes?" action={<div className="flex gap-2"><ActionButton onClick={() => setLeaving(false)}>Keep editing</ActionButton><ActionButton variant="danger" onClick={() => navigate(backPath)}>Discard proposal</ActionButton></div>}>Discard restores the saved definition and returns to the audience list.</Banner>}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">Save definition only</strong>No eligibility query, activation or export happens on save.</p>
        <ActionButton onClick={() => (dirty ? setLeaving(true) : navigate(backPath))}>Cancel</ActionButton>
        <ActionButton variant="brand" disabled={blocked} onClick={save}>Save definition</ActionButton>
      </div>
      <GrowthFooter code="GO-10A" back={{ to: backPath, label: 'Back to Audience Management · All list context retained' }} />
    </GrowthFrame>
  )
}
