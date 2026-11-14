import { useState } from 'react'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { ROUTES } from '../../../config/routes'
import { cn } from '../../../lib/cn'
import { Check } from '../../patients/components/parts'
import GrowthFrame, { GrowthFooter } from '../components/GrowthFrame'
import { GROWTH_BRANCH } from '../constants'
import { useGrowth } from '../context/growthContext'

const GATES = ['Content fixed and re-approved', 'Channel authorization verified', 'Eligibility, consent and suppression re-checked', 'Send state reconciled with the provider']

export default function DeliveryFailuresPage() {
  const { data } = useGrowth()
  const [selectedId, setSelectedId] = useState('SIM-UNKNOWN')
  const [query, setQuery] = useState('')
  const [outcome, setOutcome] = useState('')
  const [gates, setGates] = useState({})
  const needle = query.trim().toLowerCase()
  const rows = data.scenarios.filter((entry) => (!outcome || entry.id === outcome) && (!needle || `${entry.id} ${entry.messageId}`.toLowerCase().includes(needle)))
  const selected = data.scenarios.find((entry) => entry.id === selectedId) ?? rows[0]
  const passed = selected ? GATES.every((gate) => gates[`${selected.id}-${gate}`]) : false

  return (
    <GrowthFrame back={{ to: ROUTES.workflows, label: 'Retention workflows · GO27 · Restore filters & scroll' }} crumb="Owner Panel / Growth OS / Delivery Failures & Retry" code="GO-26" title="Delivery Failures & Retry" description="Separate rejection, unknown transport outcome and receipt-read errors before considering a retry." badge={<StatusPill tone="warning">Failure scenarios</StatusPill>} context={[`Record branch · ${GROWTH_BRANCH.name} · ${GROWTH_BRANCH.code}`, 'Scenario states · Selected scenario kept when you return to the workflow or history']} sample="Sample data · Live role, branch permissions and integrations are not verified">
      <Banner tone="warning" title="Failure scenarios · no production sends" className="mb-4">These are isolated validation scenarios, not real attempts by the inactive WF-REM201. Live queue: not queried — channel setup verification required. No real recipient, provider response, execution result or successful retry is asserted.</Banner>
      <p className="mb-6 flex flex-wrap items-center gap-3"><StatusPill tone="brand">SCENARIOS ✓</StatusPill><StatusPill>Live queue · setup required</StatusPill><ActionButton to={ROUTES.channels}>Channel / auth setup → GO25</ActionButton></p>

      <Section title="Scenario queue" aside="Message attempt / reconciliation ledger contract" className="mb-6">
        <div className="mb-4 grid gap-4 sm:grid-cols-3"><FilterField label="Branch" value="" disabled options={[['', GROWTH_BRANCH.name]]} /><FilterField label="Scenario" value={outcome} onChange={setOutcome} options={[['', 'All scenario states'], ...data.scenarios.map((entry) => [entry.id, entry.id])]} /><SearchBox value={query} onChange={setQuery} label="Search scenarios" placeholder="Scenario or message ID" className="self-end" /></div>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Scenario / related message', 'First error · safe reason', 'Current evidence', 'Retry eligibility', 'Source'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{rows.map((entry) => <tr key={entry.id} className={cn('border-t border-slate-100 align-top', selected?.id === entry.id && 'bg-teal-50/50')}><td className="px-6 py-4"><button type="button" onClick={() => setSelectedId(entry.id)} className="text-left font-semibold text-brand hover:underline">{entry.id}<br />{entry.messageId} · {entry.target}</button></td><td className="px-6 py-4">{entry.error}<br /><span className="text-outline">No returned error time supplied</span></td><td className="px-6 py-4">{entry.evidence.split(' · ').map((part) => <span key={part} className="block">{part}</span>)}</td><td className="px-6 py-4">{entry.retry}</td><td className="px-6 py-4">WF-REM201 validation scenario<br /><span className="text-outline">MT-REM01 v1</span></td></tr>)}</tbody></table>
          {rows.length === 0 && <p className="px-6 py-8 text-center text-sm text-on-surface-variant">No scenarios match these filters.</p>}</div>
        <p className="mt-3 text-[11px] text-outline">All rows: WhatsApp proposed · {GROWTH_BRANCH.name} · masked synthetic recipient only. No actual run. The queue count is scenario content, not production failure volume.</p>
      </Section>

      {selected && (
        <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
          <Section title={`${selected.messageId} · ${selected.error.replace('Illustrated ', '').toLowerCase()}`} aside="Scenario only">
            <Banner tone="warning" title={selected.id === 'SIM-UNKNOWN' ? 'Delivery outcome unknown — reconcile before retry' : 'Review the cause before any retry'}>{selected.evidence}. {selected.retry}.</Banner>
            <dl className="mt-4 space-y-3 text-xs"><div><dt className="text-outline">Scenario</dt><dd className="font-semibold">{selected.id} · {selected.target}</dd></div><div><dt className="text-outline">What is established</dt><dd>{selected.id === 'SIM-UNKNOWN' ? 'Neither failure nor provider acceptance. Do not resend.' : selected.id === 'SIM-REFRESH' ? 'Only a status read failed; the send state is unknown.' : 'A rejection scenario; nothing was delivered.'}</dd></div></dl>
          </Section>
          <Section title="Retry selected · review gates" aside={`${selected.messageId} only`}>
            <div className="space-y-3">{GATES.map((gate) => <Check key={gate} checked={Boolean(gates[`${selected.id}-${gate}`])} onChange={(event) => setGates((current) => ({ ...current, [`${selected.id}-${gate}`]: event.target.checked }))} label={gate} />)}</div>
            <ActionButton className="mt-4" disabled title="No live channel is verified, and a scenario cannot be resent">{selected.id === 'SIM-REFRESH' ? 'Retry status read' : 'Retry send'}</ActionButton>
            <p className="mt-3 text-[11px] leading-4 text-outline">{passed ? 'All gates ticked for review. Retry still needs a verified live channel; scenarios are never resent.' : 'Retry is blocked until every gate passes and a live channel is verified. A blind retry is never offered.'}</p>
          </Section>
        </div>
      )}
      <GrowthFooter code="GO-26" back={{ to: ROUTES.workflows, label: 'Retention workflows · GO27' }} />
    </GrowthFrame>
  )
}
