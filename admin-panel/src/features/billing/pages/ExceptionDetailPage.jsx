import { useState } from 'react'
import { Download, Paperclip, RefreshCw } from 'lucide-react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SelectInput, TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { Check, TextArea } from '../../patients/components/parts'
import { formatDate } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, GovernanceFooter, Section, TextLink } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { useBilling } from '../context/useBilling'
import { RESOLUTION_TYPES } from '../constants'
import { canResolve, reconRows } from '../financeLogic'

const TOLERANCE_MINUTES = 5
const digitsOf = (reference) => reference.replace(/\D/g, '')
const toMinutes = (time) => time.split(':').reduce((hours, minutes) => hours * 60 + Number(minutes))

function minutesNote(sourceTime, recordTime) {
  const delta = toMinutes(sourceTime) - toMinutes(recordTime)
  if (delta === 0) return 'No difference'
  return `${delta > 0 ? '+' : '−'}${Math.abs(delta)} minute${Math.abs(delta) === 1 ? '' : 's'} · ${Math.abs(delta) <= TOLERANCE_MINUTES ? 'Within' : 'Outside'} tolerance`
}

const signed = (value) => `${value < 0 ? '−' : '+'} ${money(Math.abs(value))}`

export default function ExceptionDetailPage() {
  const { exceptionId } = useParams()
  const { state } = useLocation()
  const { exceptions } = useBilling()
  const exception = exceptions.find((entry) => entry.id === exceptionId)
  const backPath = `${ROUTES.billingReconciliation}${state?.search ?? ''}`

  if (!exception) {
    return (
      <BillingFrame back={{ to: backPath, label: 'Payment Reconciliation' }} crumb="Billing & Finance / Reconciliation" code="Billing & Finance" title="Exception not found" scope={false}>
        <Banner tone="warning" title="No exception matches this link">Open Payment Reconciliation to find the record.</Banner>
      </BillingFrame>
    )
  }
  return <ExceptionView key={exceptionId} exception={exception} backPath={backPath} state={state} />
}

function ExceptionView({ exception, backPath, state }) {
  const navigate = useNavigate()
  const { exceptions, statementLines, records, getPatient, reviewException, resolveException } = useBilling()
  const row = reconRows({ lines: statementLines, exceptions, payments: records.payments }).find((entry) => entry.line.id === exception.lineId)
  const { line, payment, difference } = row
  const resolved = exception.status === 'Resolved'
  const [form, setForm] = useState({ type: RESOLUTION_TYPES[0], note: '', evidence: exception.evidence, confirmed: false })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const patient = payment ? getPatient(payment.patientId) : null
  const ready = canResolve({ evidenceAttached: Boolean(form.evidence), confirmed: form.confirmed, note: form.note })
  const set = (name, value) => setForm((current) => ({ ...current, [name]: value }))

  const act = async (change) => {
    setSaving(true)
    setError('')
    try {
      await change()
    } catch (failure) {
      setError(failure.message)
    } finally {
      setSaving(false)
    }
  }
  const startReview = () => act(() => reviewException(exception.uuid, exception.version))
  const resolve = () => act(() => resolveException(exception.uuid, { resolutionType: form.type, note: form.note.trim(), evidence: form.evidence.trim(), version: exception.version }))
  const exportAudit = () => exportCsv(`${exception.id}-audit.csv`, [['Date / time', 'Actor', 'Event', 'Detail'], ...exception.audit])

  const comparison = [
    ['Amount', money(line.amount), payment ? money(payment.amount) : '—', difference === 0 ? 'No difference' : `${signed(difference)} · ${resolved ? 'Resolved' : 'Unresolved'}`, difference !== 0 && !resolved],
    ['Date / time (IST)', line.time === '—' ? formatDate(line.date) : `${formatDate(line.date)} · ${line.time}`, payment?.date ? `${formatDate(payment.date)} · ${payment.time}` : '—', payment?.time && line.time !== '—' ? minutesNote(line.time, payment.time) : 'Not comparable', false],
    ['Reference', line.reference, payment?.reference ?? '—', payment?.reference ? (digitsOf(payment.reference) === digitsOf(line.reference) ? 'No difference' : 'Check reference') : 'Not comparable', false],
  ]

  return (
    <BillingFrame back={{ to: backPath, label: 'Payment Reconciliation' }} crumb={`Billing & Finance / Reconciliation / ${exception.id}`} code="Billing & Finance" title="Reconciliation Exception Details" description="Review a source-to-record difference. Resolution documents the reconciliation outcome; it never edits the financial source." actions={<ActionButton onClick={() => navigate(backPath)}>Back to reconciliation</ActionButton>} scope={false}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-md border border-slate-200 bg-white p-5">
        <div><p className="flex flex-wrap items-center gap-2"><span className="text-xl font-semibold">{exception.id}</span><StatusPill tone={resolved ? 'success' : 'warning'}>{exception.status}</StatusPill><StatusPill tone={resolved ? 'brand' : 'danger'}>{resolved ? 'Resolved' : 'Unmatched'}</StatusPill></p><p className="mt-2 text-xs text-outline">{exception.kind} · Detected {exception.detected} · Owner: {exception.owner}</p></div>
        <div className="text-right"><p className="text-[10px] tracking-wide text-outline uppercase">Source − ClinicOS</p><p className={`text-[28px] font-semibold ${difference ? 'text-danger' : ''}`}>{signed(difference)}</p></div>
      </div>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_464px]">
        <div className="space-y-6">
          <section className="rounded-md border border-slate-200 bg-white">
            <header className="border-b border-slate-200 p-5"><h2 className="text-[17px] font-semibold">Side-by-side comparison</h2><p className="mt-1 text-xs text-outline">{payment ? 'Same reference and payer · Amount basis requires evidence.' : 'No ClinicOS record is linked to this source line.'}</p></header>
            <div className="grid divide-slate-200 sm:grid-cols-2 sm:divide-x">
              <div className="p-5 text-xs"><p className="mb-3 text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase">Source · {line.source}</p><p className="text-base font-semibold text-brand">{line.reference}</p><StatusPill className="my-3">Imported · Read-only</StatusPill><p className="text-[32px] font-semibold">{money(line.amount)}</p><p className="mt-1 text-outline">Reported source amount · Basis not confirmed</p>
                <dl className="mt-4 space-y-3"><div className="flex justify-between gap-3"><dt className="text-outline">Transaction date</dt><dd className="font-medium">{formatDate(line.date)} · {line.time} IST</dd></div><div className="flex justify-between gap-3"><dt className="text-outline">Import batch</dt><dd className="font-medium">{exception.batch} · 21 Oct, 10:35</dd></div></dl>
                <p className="mt-4 text-[11px] text-outline">Source payload preserved. Import completed successfully; not a gateway processing failure.</p></div>
              <div className="border-t border-slate-200 p-5 text-xs sm:border-t-0"><p className="mb-3 text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase">ClinicOS · Payment record</p>
                {payment ? <><TextLink to={pathFor(ROUTES.billingPayment, { paymentId: line.paymentId })} className="text-base">{line.paymentId} ↗</TextLink><StatusPill tone="success" className="my-3 block w-fit">Settled & verified · Read-only</StatusPill><p className="text-[32px] font-semibold">{money(payment.amount)}</p><p className="mt-1 text-outline">Recorded gross payment received</p>
                  <dl className="mt-4 space-y-3"><div className="flex justify-between gap-3"><dt className="text-outline">Payer</dt><dd className="font-medium">{patient?.name ?? 'Patient'}{patient?.mrn && ` · ${patient.mrn}`}</dd></div>{payment.branch && <div className="flex justify-between gap-3"><dt className="text-outline">Branch</dt><dd className="font-medium">{payment.branch}</dd></div>}</dl>
                  <p className="mt-4 text-[11px] text-outline">Reconciliation does not alter this payment or its allocations.</p></>
                  : <p className="text-[13px] font-semibold">No linked record</p>}</div>
            </div>
          </section>

          <Section title="Explicit differences" aside="Differences are source values minus ClinicOS values.">
            <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Field', 'Source', 'ClinicOS', 'Difference'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
              <tbody>{comparison.map(([field, source, clinicos, diff, bad]) => <tr key={field} className="border-t border-slate-100"><td className="px-6 py-3.5">{field}</td><td className="px-6 py-3.5">{source}</td><td className="px-6 py-3.5">{clinicos}</td><td className={`px-6 py-3.5 ${bad ? 'text-danger' : ''}`}>{diff}</td></tr>)}</tbody></table></div>
            <Banner tone="warning" title={`Exception reason · ${exception.kind}`} className="mt-4">{exception.reason}</Banner>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Resolve exception" aside="">
            <p className="-mt-3 mb-4 text-xs text-outline">{exception.owner === 'Unassigned' ? 'Not yet assigned' : `Owner · ${exception.owner}`}</p>
            {exception.status === 'Open' && <div className="mb-4"><ActionButton disabled={saving} onClick={startReview}>Start review (assign to me)</ActionButton></div>}
            {resolved ? (
              <div className="text-xs leading-5"><StatusPill tone="success">Resolved</StatusPill><p className="mt-3 text-[13px] font-semibold">{exception.resolution.type}</p><p className="mt-1 text-on-surface-variant">{exception.resolution.note}</p><p className="mt-2 text-outline"><Paperclip className="mr-1 inline size-3" aria-hidden="true" />{exception.resolution.evidence}</p></div>
            ) : (
              <div className="space-y-4">
                <SelectInput label="Resolution type" required value={form.type} onChange={(event) => set('type', event.target.value)} options={RESOLUTION_TYPES} />
                <TextArea label="Resolution note" required rows={3} value={form.note} onChange={(event) => set('note', event.target.value)} />
                <TextInput label="Supporting evidence" required value={form.evidence} onChange={(event) => set('evidence', event.target.value)} hint={`The document or reference you checked, e.g. a fee report or bank advice. Source batch ${exception.batch} is linked automatically.`} />
                <Check checked={form.confirmed} onChange={(event) => set('confirmed', event.target.checked)} label={`I confirm the evidence explains ${signed(difference)}. This records a reconciliation resolution only; no payment, receipt or allocation will be edited. *`} />
                <ActionButton variant="primary" disabled={!ready || saving} onClick={resolve}>Confirm & mark resolved</ActionButton>
                {!ready && <p className="text-[11px] leading-4 text-amber-700">Blocked until a note and evidence are provided and confirmation is accepted. Amount remains unmatched.</p>}
                {error && <p role="alert" className="text-xs text-rose-600">{error}</p>}
                <ActionButton icon={RefreshCw} disabled>Retry source processing</ActionButton>
                <p className="text-[11px] leading-4 text-outline">Not retryable: import succeeded. {exception.kind === 'Amount mismatch' ? 'An amount discrepancy is not a transient sync failure.' : 'A missing record is not a transient sync failure.'}</p>
              </div>
            )}
          </Section>
          <div className="rounded-md bg-teal-50 p-5 text-xs leading-5 text-on-surface-variant"><p className="text-[13px] font-semibold text-on-surface">No financial source edits</p>If evidence shows the payment itself is wrong, refer it for an authorized correction in its originating workflow. Keep this exception open until the correction is verified.</div>
        </div>
      </div>

      <section className="mb-6 rounded-md border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="text-[17px] font-semibold">Audit trail</h2><p className="mt-1 text-xs text-outline">Append-only history · All times IST</p></div><ActionButton icon={Download} onClick={exportAudit}>Export audit</ActionButton></header>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Date / time', 'Actor', 'Event', 'Detail'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
          <tbody>{exception.audit.map(([when, actor, event, detail]) => <tr key={`${when}-${event}`} className="border-t border-slate-100"><td className="px-5 py-3.5">{when}</td><td className="px-5 py-3.5">{actor}</td><td className="px-5 py-3.5">{event}</td><td className="px-5 py-3.5 text-outline">{detail}</td></tr>)}</tbody></table></div>
      </section>
      <GovernanceFooter>Every resolution records actor, timestamp, reason, evidence and confirmation; financial source records remain unchanged. Return preserves date, source and status filters{state?.search ? ' (applied)' : ''}.</GovernanceFooter>
    </BillingFrame>
  )
}
