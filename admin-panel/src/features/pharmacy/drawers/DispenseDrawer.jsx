import { useState } from 'react'
import { CheckCircle2, Lock, ShieldAlert } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, Toggle } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { Check } from '../../patients/components/parts'
import StatusPill from '../../../components/workspace/StatusPill'
import { daysBetween } from '../../patients/format'
import { NOW } from '../../inventory/constants'
import { itemById } from '../../inventory/data/items'
import { formatDate, money } from '../../inventory/format'
import { interlocks, planLines, remainingOf } from '../dispensing'
import { slaLabel } from '../selectors'

const PRIORITY_TONE = { STAT: 'danger', ROUTINE: 'neutral', STATUTORY: 'warning' }

// Pharmacist verification screen: safety interlocks, FEFO batch allocation per medicine and the dispense action.
export default function DispenseDrawer({ rx, batches, onClose, onDispense }) {
  const [quantities, setQuantities] = useState(() => Object.fromEntries(rx.lines.map((line) => [line.id, String(remainingOf(line))])))
  const [splitting, setSplitting] = useState(false)
  const [consent, setConsent] = useState({ register: false, otp: false })
  const [reminders, setReminders] = useState(true)
  const [error, setError] = useState('')

  const parsed = Object.fromEntries(Object.entries(quantities).map(([id, value]) => [id, Number(value) || 0]))
  const plans = planLines(rx, batches, parsed)
  const checks = interlocks(rx, consent)
  const total = plans.reduce((sum, entry) => sum + entry.picks.reduce((inner, pick) => inner + pick.qty * (itemById(entry.line.itemId)?.price ?? 0), 0), 0)
  const h1 = rx.schedule === 'H1'
  const ready = checks.every((entry) => entry.ok)
  const lineCount = plans.filter((entry) => entry.wanted > 0).length

  const authorize = () => {
    const outcome = onDispense({ rxId: rx.id, quantities: parsed, consent, reminders })
    if (outcome.error) return setError(outcome.error)
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`Pharmacy dispensary · Clinical dispense & verify`}
      title="Dispense & Verify Medication"
      description="Mandatory two-way verification: prescribed clinical regimen vs physical inventory GTIN."
      width="max-w-3xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ActionButton onClick={onClose}>Cancel / Discard Draft</ActionButton>
          <ActionButton variant="primary" icon={ready ? CheckCircle2 : Lock} onClick={authorize}>Authorize &amp; Complete Dispensing</ActionButton>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={PRIORITY_TONE[rx.priority]}>{rx.priority} priority · {slaLabel(rx)}</StatusPill>
          <StatusPill tone="warning">{rx.status === 'Partially dispensed' ? 'Partially dispensed' : `Awaiting verification (${rx.lines.reduce((sum, line) => sum + (line.dispensed ? 1 : 0), 0)}/${rx.lines.length} dispensed)`}</StatusPill>
        </div>

        <dl className="grid gap-4 rounded-md border border-slate-200 bg-surface-lowest p-4 text-xs sm:grid-cols-3">
          <div><dt className="text-[10px] tracking-wide text-outline uppercase">Patient details</dt><dd className="mt-1 font-semibold">{rx.patient.name} <span className="font-normal text-outline">{rx.patient.age}{rx.patient.gender}</span></dd><dd className="font-mono text-outline">{rx.patient.uhid}</dd>{rx.patient.abha && <dd className="text-outline">ABHA: {rx.patient.abha}</dd>}</div>
          <div><dt className="text-[10px] tracking-wide text-outline uppercase">Attending prescriber</dt><dd className="mt-1 font-semibold">{rx.prescriber}</dd><dd className="text-outline">{rx.department}{rx.chamber ? ` · ${rx.chamber}` : ''}</dd></div>
          <div><dt className="text-[10px] tracking-wide text-outline uppercase">Encounter / Token</dt><dd className="mt-1 font-mono font-semibold">{rx.encounter ? `${rx.encounter} · ` : ''}#{rx.id}</dd><dd className="text-outline">{rx.followUp || rx.payer}</dd></div>
        </dl>

        {rx.hold && (
          <InfoNote tone="warning" icon={ShieldAlert}>
            <p className="font-semibold">On hold: {rx.hold}</p>
            {h1 && (
              <div className="mt-2 flex flex-col gap-1.5">
                <Check checked={consent.otp} onChange={(event) => setConsent((current) => ({ ...current, otp: event.target.checked }))} label="Patient OTP consent captured" />
                <Check checked={consent.register} onChange={(event) => setConsent((current) => ({ ...current, register: event.target.checked }))} label="Schedule H1 statutory register entry made" />
              </div>
            )}
          </InfoNote>
        )}

        <section className="rounded-md border border-slate-200 p-4">
          <h3 className="mb-3 flex items-center justify-between text-sm font-semibold">Clinical prescription summary <StatusPill tone="success">Source of truth</StatusPill></h3>
          <p className="text-xs"><span className="text-outline">Confirmed ICD-10: </span>{rx.diagnoses.length ? rx.diagnoses.join(' · ') : 'Not recorded in the prescription source'}</p>
          <p className="mt-1 text-xs"><span className="text-outline">Patient vitals: </span>{rx.vitals || 'Not recorded'}</p>
          <p className="mt-1 text-xs"><span className="text-outline">Coverage: </span>{rx.coverage}</p>
        </section>

        <section>
          <h3 className="mb-2 flex items-center justify-between text-sm font-semibold">Mandatory safety verification interlocks <StatusPill tone={ready ? 'success' : 'danger'}>{checks.filter((entry) => entry.ok).length} of {checks.length} verified &amp; cleared</StatusPill></h3>
          <ul className="flex flex-col gap-2">
            {checks.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 rounded-md border border-slate-200 p-3 text-xs">
                <span className="flex gap-2"><CheckCircle2 className={`mt-0.5 size-3.5 shrink-0 ${entry.ok ? 'text-emerald-600' : 'text-danger'}`} aria-hidden="true" /><span><strong className="block text-[13px]">{entry.title}</strong><span className="text-on-surface-variant">{entry.detail}</span></span></span>
                <StatusPill tone={entry.ok ? 'success' : 'danger'}>{entry.badge}</StatusPill>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Medication verification &amp; fulfillment matrix</h3>
            <button type="button" onClick={() => setSplitting((current) => !current)} className="text-xs font-semibold text-brand hover:underline">{splitting ? 'Dispense in full' : 'Dispense Partial / Split Batch'}</button>
          </div>
          <ul className="flex flex-col gap-3">
            {plans.map(({ line, picks, short, wanted, free }, index) => {
              const remaining = remainingOf(line)
              const fulfilled = picks.reduce((sum, pick) => sum + pick.qty, 0)
              return (
                <li key={line.id} className="rounded-md border border-emerald-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold"><span className="mr-2 rounded bg-black px-1.5 py-0.5 text-[10px] text-white">Rx{index + 1}</span>{line.name}</p>
                    <StatusPill tone={remaining === 0 ? 'neutral' : short ? 'danger' : 'success'}>{remaining === 0 ? 'Already dispensed' : short ? `Short by ${short}` : 'Verified & scanned'}</StatusPill>
                  </div>
                  <p className="mt-1 text-[11px] text-outline">{itemById(line.itemId)?.brand ?? line.timing} · {line.timing}</p>
                  {remaining > 0 && (
                    <div className="mt-3 grid gap-3 rounded-md bg-surface-lowest p-3 text-xs sm:grid-cols-4">
                      {picks.length === 0 ? <p className="sm:col-span-4 text-danger">No dispensable batch is in stock (available {free}).</p> : picks.map((pick) => (
                        <div key={pick.batchId} className="sm:col-span-4 grid gap-3 sm:grid-cols-4">
                          <div><p className="text-[10px] tracking-wide text-outline uppercase">Allocated batch</p><p className="font-mono font-semibold">{pick.batchNo}</p></div>
                          <div><p className="text-[10px] tracking-wide text-outline uppercase">Dispensary bay</p><p className="font-semibold">{pick.bin}</p></div>
                          <div><p className="text-[10px] tracking-wide text-outline uppercase">FEFO expiry</p><p className="font-semibold">{formatDate(pick.expiry)} <span className="font-normal text-outline">({daysBetween(NOW.date, pick.expiry)}d)</span></p></div>
                          <div><p className="text-[10px] tracking-wide text-outline uppercase">Fulfillment qty</p><p className="font-semibold">{pick.qty} / {wanted} {line.unit}</p></div>
                        </div>
                      ))}
                    </div>
                  )}
                  {remaining > 0 && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100"><div className="h-full bg-brand" style={{ width: `${remaining ? Math.round((fulfilled / remaining) * 100) : 0}%` }} /></div>
                      {splitting && (
                        <label className="flex items-center gap-1.5 text-xs">
                          <span>Dispense now</span>
                          <input type="number" min="0" max={remaining} aria-label={`Dispense quantity for ${line.name}`} value={quantities[line.id]} onChange={(event) => setQuantities((current) => ({ ...current, [line.id]: event.target.value }))} className="w-20 rounded border border-slate-200 px-2 py-1 outline-none focus:border-brand" />
                          <span className="text-outline">of {remaining}</span>
                        </label>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="rounded-md border border-slate-200 p-4 text-xs">
          <h3 className="mb-3 flex items-center justify-between text-sm font-semibold">Physical staging &amp; dispatch summary <span className="text-[10px] font-normal text-outline">{lineCount} of {plans.length} lines this dispense</span></h3>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-outline">Dispensing ledger review</dt><dd className="font-semibold">Gross {money(total)}</dd></div>
            <div><dt className="text-outline">Coverage</dt><dd className="font-semibold">{rx.coverage}</dd></div>
          </dl>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <span>Send automated medication reminders via WhatsApp</span>
            <Toggle checked={reminders} onChange={setReminders} label="Send automated medication reminders via WhatsApp" />
          </div>
        </section>
        {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
      </div>
    </Drawer>
  )
}
