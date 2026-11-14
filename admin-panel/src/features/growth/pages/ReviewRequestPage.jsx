import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { Check } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { CHANNEL_FORMATS, GROWTH_BRANCH } from '../constants'
import { useGrowth } from '../context/growthContext'

const TRIGGERS = ['Operational encounter completion event, excluding cancelled records', 'Appointment marked completed, excluding no-shows', 'Visit closed at the front desk']
const READINESS = [['persisted', 'Persisted version & scoped access'], ['profile', 'Verified business profile and public review link'], ['template', 'Approved message template for the channel'], ['consent', 'Verified channel consent, preferences and suppression']]

export default function ReviewRequestPage() {
  const { data, setSingle } = useGrowth()
  const navigate = useNavigate()
  const saved = data.reviewRequest
  const [values, setValues] = useState(saved)
  const [checks, setChecks] = useState({ persisted: false, profile: false, template: false, consent: false })
  const [message, setMessage] = useState('')
  const template = data.messageTemplates.find((entry) => entry.id === values.template)
  const dirty = Object.keys(values).some((key) => values[key] !== saved[key])
  const delayError = !(Number(values.delay) >= 0) || values.delay === '' ? 'Enter the delay in hours.' : undefined
  const set = (name, value) => { setValues((current) => ({ ...current, [name]: value })); setMessage('') }

  const saveDraft = () => {
    if (delayError) return
    setSingle('reviewRequest', { ...values, version: saved.version + (dirty ? 1 : 0) })
    setMessage(`Draft saved as v${saved.version + (dirty ? 1 : 0)}. The workflow stays Disabled; nothing is sent.`)
  }

  return (
    <GrowthFrame back={{ to: ROUTES.reviews, label: 'Back to reviews · GO16 · Filters & scroll retained' }} crumb="Owner Panel / Growth OS / Review Requests" code="GO-18" title="Review Request Workflow" description="Configure optional, honest feedback requests. Saving, activation, sending and delivery confirmation are separate." badge={<StatusPill tone="warning">Disabled · draft edit</StatusPill>} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, 'Return keeps the request-workflow token and unsaved configuration']} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <Banner tone="warning" title={`${values.id} · saved baseline v${saved.version} is ${saved.status}`} className="mb-6">Owner {values.owner} · {GROWTH_BRANCH.name}. This is draft configuration, not activation evidence. No recipients are evaluated and no sends occur.</Banner>
      {message && <Banner tone="brand" title={message} className="mb-6" />}
      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Section title="Trigger & schedule" aside={`${values.id} · * Required`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput label="Branch" required value={`${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`} readOnly disabled hint="Per-record branch; the global shell stays All locations (3)" />
              <TextInput label="Owner" required value={values.owner} readOnly disabled />
              <div className="sm:col-span-2"><SelectInput label="Proposed trigger · integration dependent" required value={values.trigger} onChange={(event) => set('trigger', event.target.value)} options={TRIGGERS} hint="Only if supported by a verified event source. No clinical content is exposed to the provider." /></div>
              <TextInput label="Delay after verified event (hours)" required inputMode="numeric" value={values.delay} onChange={(event) => set('delay', event.target.value.replace(/\D/g, ''))} error={delayError} />
              <TextInput label="Timezone" required value={values.timezone} readOnly disabled />
            </div>
            <Banner tone="brand" title="Audience-neutral trigger · no review gating" className="mt-4">Do not select only positive experiences, pre-screen sentiment or exclude complaint escalations. Public review and private contact options are offered equally; no incentives.</Banner>
          </Section>
          <Section title="Channel & approved template" aside="Integration dependent">
            <div className="grid gap-4 sm:grid-cols-2"><SelectInput label="Primary channel · proposed" required value={values.channel} onChange={(event) => set('channel', event.target.value)} options={CHANNEL_FORMATS} hint="Provider/channel authorization unverified" /><SelectInput label="SMS fallback" value={values.fallback} onChange={(event) => set('fallback', event.target.value)} options={['OFF', 'ON']} hint="Requires separate consent and configuration" /><div className="sm:col-span-2"><SelectInput label="Approved-template selector" required value={values.template} onChange={(event) => set('template', event.target.value)} options={data.messageTemplates.filter((entry) => entry.category === 'Review request').map((entry) => entry.id)} hint="No approved template is verified for this channel — approval required" /></div></div>
          </Section>
        </div>
        <div className="space-y-6">
          <Section title="Message preview" aside="No recipient">
            <div className="rounded-2xl bg-surface-low p-4"><p className="text-sm font-semibold">Aura Health</p><p className="text-[11px] text-outline">{values.channel} proposed · {template?.id ?? 'No template'} v{template?.version ?? 1}</p><p className="mt-3 rounded-xl bg-white p-4 text-sm leading-6">{template?.body ?? 'Select a template to preview.'}<span className="mt-3 block text-amber-700">Review link not verified — connect and verify the branch profile before sending.</span></p></div>
            <p className="mt-3 text-[11px] text-outline">No recipient, phone number, consent, timestamp or delivery tick is shown. Draft text needs template approval.</p>
          </Section>
          <Section title="Activation readiness" aside="Blocked">
            <div className="space-y-3">{READINESS.map(([key, label]) => <Check key={key} checked={checks[key]} onChange={(event) => setChecks((current) => ({ ...current, [key]: event.target.checked }))} label={label} />)}</div>
            <ActionButton className="mt-4" disabled title="Activation needs a verified channel connection and approved template">Activate workflow</ActionButton>
            <p className="mt-2 text-[11px] text-outline">Activation stays blocked until a channel connection is verified. Ticking a readiness item does not enable sending.</p>
          </Section>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-slate-200 bg-white px-5 py-4">
        <p className="min-w-60 flex-1 text-xs text-outline"><strong className="block text-[13px] text-on-surface">Save draft configuration</strong>Saving stores configuration only. The workflow remains Disabled.</p>
        <ActionButton onClick={() => navigate(ROUTES.businessProfile)}>Business profile · GO15</ActionButton>
        <ActionButton variant="brand" disabled={!dirty} onClick={saveDraft}>Save draft</ActionButton>
      </div>
      <GrowthFooter code="GO-18" back={{ to: ROUTES.reviews, label: 'Back to reviews · GO16' }} />
    </GrowthFrame>
  )
}
