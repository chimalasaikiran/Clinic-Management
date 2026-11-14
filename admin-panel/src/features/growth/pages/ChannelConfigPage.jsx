import { useState } from 'react'
import ActionButton from '../../../components/workspace/ActionButton'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { Check } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH } from '../constants'
import { useGrowth } from '../context/growthContext'

const CHECKLIST = ['Provider account and verified branch ownership evidence', 'Least-privilege scopes from the verified adapter registry', 'Approved template snapshot and required sender configuration', 'Webhook verification, signed receipt mapping and approved test checks']
const CAPABILITIES = ['Outbound / text', 'Templates / locales', 'Delivery receipts', 'Read confirmation', 'Status lookup', 'Cancel operation']

export default function ChannelConfigPage() {
  const { data } = useGrowth()
  const [selectedId, setSelectedId] = useState(data.channels[0].id)
  const [checks, setChecks] = useState({})
  const selected = data.channels.find((entry) => entry.id === selectedId)

  return (
    <GrowthFrame back={{ to: ROUTES.workflows, label: 'Retention workflows · GO27 · Restore filters & scroll' }} crumb="Owner Panel / Growth OS / Channel Configuration" code="GO-25" title="Channel / Integration Configuration" description="Verify branch support and authorization before any channel can be selected for dispatch." badge={<StatusPill tone="warning">Setup required · no verified connection</StatusPill>} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, 'Return to the workflow editor with its unsaved proposal · Also return to message templates or delivery scenarios']} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <Banner tone="warning" title="Production support has not been verified — capabilities must come from the ClinicOS registry" className="mb-6">WhatsApp Business, SMS and Email below are proposed setup adapters, not configured channels. The ClinicOS test inbox remains an isolated demo configuration and must never be promoted into a production integration.</Banner>
      <div role="radiogroup" aria-label="Channel" className="mb-6 grid gap-4 md:grid-cols-3">{data.channels.map((channel) => (
        <button key={channel.id} type="button" role="radio" aria-checked={selectedId === channel.id} onClick={() => setSelectedId(channel.id)} className={cn('rounded-md border bg-white p-5 text-left text-xs', selectedId === channel.id ? 'border-2 border-brand' : 'border-slate-200')}>
          <p className="flex justify-between"><strong className="text-[17px]">{channel.name}</strong><span className="text-brand">{selectedId === channel.id ? 'Selected' : 'Setup option'}</span></p><StatusPill tone="warning" className="my-3">Setup required</StatusPill><p className="leading-5">{channel.note}</p><p className="mt-3 text-outline">No branch connection verified. Authorization not requested / not verified.</p>
        </button>))}</div>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Section title={`${selected.name} · setup review`} aside={GROWTH_BRANCH.code}>
          <Banner tone="warning" title="Setup required — no branch connection has been verified" className="mb-4">No provider account, ownership proof, credentials, token, scope grant, webhook evidence or returned connection time is supplied. No authorization request is pending.</Banner>
          <div className="grid gap-4 sm:grid-cols-2"><TextInput label="Branch mapping" required value={`${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`} readOnly disabled hint="Mapping evidence required" /><TextInput label="Connection administrator" required value="Role / branch access unverified" readOnly disabled hint="Owner title is not authorization" /></div>
          <div className="mt-4 space-y-3">{CHECKLIST.map((item) => <Check key={item} checked={Boolean(checks[`${selectedId}-${item}`])} onChange={(event) => setChecks((current) => ({ ...current, [`${selectedId}-${item}`]: event.target.checked }))} label={item} />)}</div>
          <div className="mt-4 flex flex-wrap gap-3"><ActionButton disabled title="Connecting needs administrator access">Connect & verify · admin gated</ActionButton><ActionButton disabled title="No current grant">Re-authorize · no current grant</ActionButton><ActionButton disabled title="Nothing is connected">Disconnect · no connection to remove</ActionButton></div>
          <p className="mt-3 text-[11px] text-outline">Ticking a checklist item records your review notes only; it does not verify a connection.</p>
        </Section>
        <Section title="Capability registry" aside="Expected contract · not queried">
          <p className="mb-3 text-xs text-on-surface-variant">Current adapter lookup: not checked. Do not infer capabilities from a channel name or provider marketing.</p>
          <div className="-mx-6 overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr><th scope="col" className="px-6 py-2.5">Capability</th><th scope="col" className="px-6 py-2.5">Current evidence</th></tr></thead><tbody>{CAPABILITIES.map((capability) => <tr key={capability} className="border-t border-slate-100"><td className="px-6 py-3 font-semibold">{capability}</td><td className="px-6 py-3 text-on-surface-variant">Not checked — adapter capability lookup required</td></tr>)}</tbody></table></div>
        </Section>
      </div>
      <GrowthFooter code="GO-25" back={{ to: ROUTES.workflows, label: 'Retention workflows · GO27' }} />
    </GrowthFrame>
  )
}
