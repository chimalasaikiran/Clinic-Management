import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { InfoNote, RadioCard } from '../../../components/workspace/controls'
import Drawer from '../../../components/workspace/Drawer'
import { TextInput } from '../../../components/workspace/FormControls'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import { allocatedToInvoice, autoAllocate, invoiceBalance, invoiceStatus, invoiceTotals, lineAmounts } from '../billing'
import { Check, KeyValueRows, OptionSelect, TextArea } from '../components/parts'
import Timeline from '../components/Timeline'
import { CHARGE_CATALOG, PAYMENT_CHANNELS } from '../data/catalog'
import { TODAY, formatDate, formatINR, formatTime } from '../format'
import { validateInvoice, validatePayment } from '../validation'

function Section({ title, aside, children }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <h3 className="mb-3 flex items-center justify-between text-xs font-semibold tracking-wide text-brand uppercase">{title}{aside && <span className="font-normal text-outline normal-case">{aside}</span>}</h3>
      {children}
    </section>
  )
}

const PAYERS = [
  { id: 'Self-Pay / Patient Direct', title: 'Self-Pay / Patient Direct', detail: 'Patient settles legal debt directly via cash, UPI, or card.' },
  { id: 'Corporate Sponsor', title: 'Corporate Sponsor (CCL Req)', detail: 'Billed to corporate coalfields ltd MOU credit account.' },
  { id: 'Insurance / TPA Policy', title: 'Insurance / TPA Policy', detail: 'Star Health pre-auth claim against the sanctioned limit.' },
]

const STATUS_TONE = { 'Paid in Full': 'success', 'Partially Paid': 'warning', Issued: 'neutral' }

export function CreateInvoiceDrawer({ open, onClose, patient, encounter, charges, onCreate }) {
  const [tab, setTab] = useState('charges')
  const [lines, setLines] = useState([])
  const [payer, setPayer] = useState(PAYERS[0].id)
  const [notes, setNotes] = useState({ publicNote: '', internalNote: '' })
  const [submitted, setSubmitted] = useState(false)
  const totals = invoiceTotals(lines)
  const errors = submitted ? validateInvoice({ lines }) : {}

  const finish = () => {
    setTab('charges')
    setLines([])
    setPayer(PAYERS[0].id)
    setNotes({ publicNote: '', internalNote: '' })
    setSubmitted(false)
    onClose()
  }
  const chargeLine = (charge) => ({ ...charge.lines[0], chargeId: charge.id })
  const toggleCharge = (charge) => setLines((current) => (current.some((line) => line.chargeId === charge.id) ? current.filter((line) => line.chargeId !== charge.id) : [...current, chargeLine(charge)]))
  const addCatalog = (entry) => setLines((current) => (current.some((line) => line.code === entry.code && !line.chargeId) ? current.map((line) => (line.code === entry.code && !line.chargeId ? { ...line, qty: line.qty + 1 } : line)) : [...current, { code: entry.code, name: entry.name, note: entry.note, qty: 1, price: entry.price, discountPct: entry.discountPct, gstPct: entry.gstPct }]))
  const removeLine = (index) => setLines((current) => current.filter((_, position) => position !== index))

  const submit = () => {
    setSubmitted(true)
    if (Object.keys(validateInvoice({ lines })).length) return
    onCreate({ lines: lines.map((line) => Object.fromEntries(Object.entries(line).filter(([key]) => key !== 'chargeId'))), chargeIds: lines.filter((line) => line.chargeId).map((line) => line.chargeId), payer, ...notes })
    finish()
  }

  const catalog = CHARGE_CATALOG.filter((entry) => (tab === 'catalog' ? entry.type === 'service' : entry.type === 'consumable'))

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Draft · uncommitted · session lock active"
      title="Create Invoice"
      description={`${patient.name} · MRN ${patient.mrn} · ${patient.branch}`}
      width="max-w-3xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={finish}>Cancel (Esc)</ActionButton><div className="flex items-center gap-4"><span className="text-right text-[10px] text-outline">NET PAYABLE<br /><strong className="text-base text-on-surface">{formatINR(totals.total, 2)}</strong></span><ActionButton variant="primary" onClick={submit}>Review &amp; Issue Invoice →</ActionButton></div></div>}
    >
      <div className="flex flex-col gap-4 p-5">
        <Section title="Linked clinical encounter" aside={encounter?.id ?? 'No open encounter'}>
          <p className="text-sm font-semibold">{encounter ? `${encounter.type} · ${encounter.doctor}` : 'Standalone invoice'}</p>
          <div role="tablist" aria-label="Billable source" className="mt-3 grid grid-cols-3 border-b border-slate-200 text-center text-xs">
            {[['charges', `Unbilled Charges (${charges.length} Available)`], ['catalog', 'Service Catalogue'], ['consumables', 'Consumables / Supplies']].map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('border-b-2 px-2 py-2', tab === id ? 'border-brand font-semibold text-brand' : 'border-transparent text-on-surface-variant')}>{label}</button>)}
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {tab === 'charges' && charges.map((charge) => <li key={charge.id}><Check checked={lines.some((line) => line.chargeId === charge.id)} onChange={() => toggleCharge(charge)} label={`${charge.title} — ${formatINR(lineAmounts(charge.lines[0]).total, 2)}`} /></li>)}
            {tab === 'charges' && charges.length === 0 && <li className="text-xs text-on-surface-variant">There are no unbilled charges for this patient.</li>}
            {tab !== 'charges' && catalog.map((entry) => <li key={entry.code} className="flex items-center justify-between gap-3 rounded border border-slate-200 px-3 py-2 text-xs"><span><strong>{entry.name}</strong><br /><span className="text-on-surface-variant">{entry.note} · {formatINR(entry.price, 2)}</span></span><ActionButton size="sm" onClick={() => addCatalog(entry)} aria-label={`Add ${entry.name}`}>+ Add</ActionButton></li>)}
          </ul>
        </Section>

        <Section title="Structured line items schedule" aside={`${lines.length} line items staged`}>
          {lines.length === 0 ? <p className="text-xs text-on-surface-variant">No lines added yet.</p> : (
            <table className="w-full text-left text-xs">
              <thead className="text-[10px] tracking-wide text-outline uppercase"><tr><th className="pb-2">Code & description</th><th className="pb-2">Qty</th><th className="pb-2">Price (₹)</th><th className="pb-2">Disc</th><th className="pb-2">GST</th><th className="pb-2 text-right">Total (₹)</th><th /></tr></thead>
              <tbody>{lines.map((line, index) => <tr key={`${line.code}-${index}`} className="border-t border-slate-100 align-top"><td className="py-2"><span className="font-mono text-brand">{line.code}</span><br />{line.name}</td><td className="py-2">{line.qty}</td><td className="py-2 font-mono">{line.price.toFixed(2)}</td><td className="py-2">{line.discountPct}%</td><td className="py-2">{line.gstPct ? `${line.gstPct}%` : 'Exempt'}</td><td className="py-2 text-right font-mono font-semibold">{lineAmounts(line).total.toFixed(2)}</td><td className="py-2 pl-2"><button type="button" aria-label={`Remove ${line.name}`} onClick={() => removeLine(index)}><Trash2 className="size-3.5 text-outline" aria-hidden="true" /></button></td></tr>)}</tbody>
            </table>
          )}
          {errors.lines && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.lines}</p>}
        </Section>

        <Section title="Payer responsibility & terms" aside="Accounting debtor">
          <div role="radiogroup" aria-label="Payer" className="grid gap-2 sm:grid-cols-3">{PAYERS.map((entry) => <RadioCard key={entry.id} name="payer" value={entry.id} checked={payer === entry.id} onChange={() => setPayer(entry.id)} title={entry.title} detail={entry.detail} />)}</div>
          <InfoNote tone="brand" className="mt-3"><strong>Statutory distinction:</strong> invoice issuance establishes patient legal liability under Indian commercial code. Payment receipt and cashbook settlement are executed via separate cashier ledger transactions.</InfoNote>
        </Section>

        <Section title="Billing remarks & documentation">
          <div className="grid gap-3 sm:grid-cols-2"><TextArea label="Invoice public notes (printed on tax invoice PDF)" rows={2} value={notes.publicNote} onChange={(event) => setNotes((current) => ({ ...current, publicNote: event.target.value }))} /><TextArea label="Internal finance audit remark (staff confidential)" rows={2} value={notes.internalNote} onChange={(event) => setNotes((current) => ({ ...current, internalNote: event.target.value }))} /></div>
        </Section>

        <Section title="Financial ledger calculation summary" aside="Currency: INR (₹)">
          <KeyValueRows rows={[['Gross billable subtotal', formatINR(totals.gross, 2)], ['Consumables discount', `-${formatINR(totals.discount, 2)}`], ['Clinical healthcare services (0% GST exempt)', formatINR(totals.exemptBase, 2)], ['Taxable medical supplies base', formatINR(totals.taxableBase, 2)], ['CGST', `+${formatINR(totals.cgst, 2)}`], ['SGST', `+${formatINR(totals.sgst, 2)}`]]} />
          <p className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 text-lg font-bold">Net total payable <span>{formatINR(totals.total, 2)}</span></p>
        </Section>
      </div>
    </Drawer>
  )
}

export function InvoiceDetailDrawer({ invoice, patient, payments, unallocated, onClose, onAllocate, onRecordPayment }) {
  if (!invoice) return null
  const totals = invoiceTotals(invoice.lines)
  const paid = allocatedToInvoice(invoice.id, payments)
  const balance = invoiceBalance(invoice, payments)
  const status = invoiceStatus(invoice, payments)
  const related = payments.filter((payment) => payment.allocations.some((allocation) => allocation.invoiceId === invoice.id))
  const events = [
    ...related.map((payment) => ({ time: `${formatDate(payment.date)}, ${formatTime(payment.time)}`, title: `Payment ${payment.id} allocated`, detail: `${formatINR(payment.allocations.find((entry) => entry.invoiceId === invoice.id).amount)} applied · ${payment.cashier}` })),
    { time: `${formatDate(invoice.date)}, ${formatTime(invoice.time)}`, title: 'Invoice issued & sealed', detail: `${invoice.kind} · ${invoice.cashier}` },
  ]

  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Financial record · invoice details · GST tax invoice"
      title={`#${invoice.id}`}
      description={`${status} · ${formatINR(balance)} outstanding`}
      width="max-w-3xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={onClose}>Close (Esc)</ActionButton><div className="flex gap-2"><ActionButton onClick={() => window.print()}>Print / PDF</ActionButton>{balance > 0 && <ActionButton variant="brand" onClick={onRecordPayment}>Record Payment / Settle Balance</ActionButton>}</div></div>}
    >
      <div className="flex flex-col gap-4 p-5">
        <StatusPill tone={STATUS_TONE[status]}>{status}{balance > 0 && ` · ${formatINR(balance)} Outstanding`}</StatusPill>
        <dl className="grid gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-md border border-slate-200 p-3"><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Patient identifier</dt><dd className="font-semibold">{patient.name} · {patient.age} Yrs</dd><dd className="font-mono text-on-surface-variant">MRN: {patient.mrn}</dd></div>
          <div className="rounded-md border border-slate-200 p-3"><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">Facility & service location</dt><dd className="font-semibold">{invoice.branch}</dd><dd className="text-on-surface-variant">Issued {formatDate(invoice.date)}, {formatTime(invoice.time)} IST</dd></div>
        </dl>
        <div className="grid gap-3 sm:grid-cols-4">
          {[['Net total', formatINR(totals.total, 2), ''], ['Allocated / paid', formatINR(paid, 2), 'text-brand'], ['Balance due', formatINR(balance, 2), balance ? 'text-danger' : 'text-brand'], ['GST total', formatINR(totals.tax, 2), '']].map(([label, value, tone]) => <div key={label} className="rounded-md border border-slate-200 p-3"><p className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</p><p className={cn('text-lg font-bold', tone)}>{value}</p></div>)}
        </div>
        {unallocated > 0 && balance > 0 && (
          <InfoNote tone="warning"><strong>Available unallocated deposit detected.</strong> The patient has {formatINR(unallocated)} of unallocated credit. Applying it reduces this invoice&apos;s balance.<div className="mt-2"><ActionButton size="sm" variant="brand" onClick={onAllocate}>Allocate available credit to this invoice</ActionButton></div></InfoNote>
        )}
        <Section title="Itemized clinical schedule" aside={`${invoice.lines.length} services`}>
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] tracking-wide text-outline uppercase"><tr><th className="pb-2">#</th><th className="pb-2">Service & clinical details</th><th className="pb-2">Qty</th><th className="pb-2">Unit price</th><th className="pb-2">Tax</th><th className="pb-2 text-right">Line total</th></tr></thead>
            <tbody>{invoice.lines.map((line, index) => <tr key={`${line.code}-${index}`} className="border-t border-slate-100 align-top"><td className="py-2">{String(index + 1).padStart(2, '0')}</td><td className="py-2"><span className="font-semibold">{line.name}</span><br /><span className="font-mono text-[10px] text-on-surface-variant">{line.code} · {line.note}</span></td><td className="py-2">{line.qty}</td><td className="py-2 font-mono">{formatINR(line.price, 2)}</td><td className="py-2">{line.gstPct ? `${line.gstPct}%` : '0% Exempt'}</td><td className="py-2 text-right font-mono font-semibold">{formatINR(lineAmounts(line).total, 2)}</td></tr>)}</tbody>
          </table>
          <KeyValueRows className="mt-3 border-t border-slate-100 pt-3" rows={[['Gross subtotal', formatINR(totals.gross, 2)], ['Tax invoice total', formatINR(totals.total, 2)], ['Less allocated payments', `-${formatINR(paid, 2)}`]]} />
          <p className="mt-2 flex items-center justify-between rounded bg-red-50 px-3 py-2 text-base font-bold">Balance due: <span>{formatINR(balance, 2)}</span></p>
        </Section>
        <Section title="Billing & payer specifications"><KeyValueRows rows={[['Payer responsibility', invoice.payer], ['Linked clinical encounter', invoice.encounterId], ['Creator & cashier station', invoice.cashier], ['Payment terms', `Net 7 days · due ${formatDate(invoice.dueDate)}`]]} />{invoice.publicNote && <p className="mt-3 rounded bg-surface-low p-3 text-xs"><strong>Public invoice note (printed):</strong> {invoice.publicNote}</p>}</Section>
        <Section title="Statutory audit trail & ledger log"><Timeline events={events} /></Section>
      </div>
    </Drawer>
  )
}

export function RecordPaymentDrawer({ open, onClose, patient, openInvoices, unallocated, onRecord }) {
  const [values, setValues] = useState({ amount: '', channel: PAYMENT_CHANNELS[0], reference: '', payer: 'Patient Direct (Self)', narration: '', notify: true })
  const [picked, setPicked] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const outstanding = openInvoices.reduce((sum, entry) => sum + entry.balance, 0)
  const amount = Number(values.amount) || 0
  const allocated = Object.values(picked).reduce((sum, value) => sum + (Number(value) || 0), 0)
  const errors = submitted ? validatePayment({ amount: values.amount, allocated }) : {}
  const remaining = Math.max(amount - allocated, 0)

  const set = (name, value) => setValues((current) => ({ ...current, [name]: value }))
  const finish = () => {
    setValues({ amount: '', channel: PAYMENT_CHANNELS[0], reference: '', payer: 'Patient Direct (Self)', narration: '', notify: true })
    setPicked({})
    setSubmitted(false)
    onClose()
  }
  const setAmount = (next) => {
    set('amount', String(next))
    const plan = autoAllocate(Number(next), openInvoices)
    setPicked(Object.fromEntries(plan.map((entry) => [entry.invoiceId, String(entry.amount)])))
  }
  const toggleInvoice = (entry) => setPicked((current) => (entry.invoiceId in current ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== entry.invoiceId)) : { ...current, [entry.invoiceId]: String(Math.min(entry.balance, Math.max(amount - allocated, 0)) || '') }))

  const commit = (commitAllocation) => {
    setSubmitted(true)
    const allocationPlan = commitAllocation ? Object.entries(picked).filter(([, value]) => Number(value) > 0).map(([invoiceId, value]) => ({ invoiceId, amount: Number(value) })) : []
    if (Object.keys(validatePayment({ amount: values.amount, allocated: allocationPlan.reduce((sum, entry) => sum + entry.amount, 0) })).length) return
    const overpaid = allocationPlan.find((entry) => entry.amount > (openInvoices.find((invoice) => invoice.invoiceId === entry.invoiceId)?.balance ?? 0))
    if (overpaid) return
    onRecord({ amount, channel: values.channel, reference: values.reference.trim(), payer: values.payer, narration: values.narration.trim(), allocations: allocationPlan })
    finish()
  }

  return (
    <Drawer
      open={open}
      onClose={finish}
      eyebrow="Financial cashbook · payment recording"
      title="Record Payment"
      description={`${patient.name} · MRN ${patient.mrn} · New payment (uncommitted)`}
      width="max-w-3xl"
      footer={<div className="flex items-center justify-between gap-3"><ActionButton onClick={finish}>Cancel (Esc)</ActionButton><div className="flex gap-2"><ActionButton onClick={() => commit(false)}>Save as Unallocated Advance</ActionButton><ActionButton variant="primary" onClick={() => commit(true)}>Record Payment &amp; Commit Allocation ({formatINR(amount, 2)}) →</ActionButton></div></div>}
    >
      <div className="flex flex-col gap-4 p-5">
        <InfoNote><strong>Strict object separation protocol:</strong> recording a payment ingests actual collected tender into the ledger. It does not issue an official tax receipt voucher or modify clinical invoices until allocation is confirmed.</InfoNote>
        <Section title="Patient account balances (pre-payment)">
          <dl className="grid gap-3 sm:grid-cols-3">{[['Outstanding invoiced balance', formatINR(outstanding, 2)], ['Unallocated deposit credit', formatINR(unallocated, 2)], ['Net patient liability', formatINR(Math.max(outstanding - unallocated, 0), 2)]].map(([label, value]) => <div key={label} className="rounded-md border border-slate-200 p-3"><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt><dd className="text-lg font-bold">{value}</dd></div>)}</dl>
        </Section>
        <Section title="1 · Payment amount & intake terms" aside="* Required fields">
          <TextInput label="Amount received (INR)" name="amount" type="number" min="0" required prefix="₹" value={values.amount} onChange={(event) => setAmount(event.target.value)} error={errors.amount} />
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-outline">Quick fill: {outstanding > 0 && <ActionButton size="sm" onClick={() => setAmount(outstanding)}>Pay full balance {formatINR(outstanding)}</ActionButton>}<ActionButton size="sm" onClick={() => setAmount(1000)}>₹1,000</ActionButton></p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2"><TextInput label="Received date" type="date" value={TODAY} readOnly /><OptionSelect label="Payer entity & relation" value={values.payer} onChange={(event) => set('payer', event.target.value)} options={['Patient Direct (Self)', 'Family / Caregiver', 'Insurance / TPA']} /></div>
        </Section>
        <Section title="2 · Payment channel & gateway capture">
          <div role="radiogroup" aria-label="Payment channel" className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{PAYMENT_CHANNELS.map((channel) => <button key={channel} type="button" role="radio" aria-checked={values.channel === channel} onClick={() => set('channel', channel)} className={cn('rounded-md border px-2 py-3 text-xs font-medium', values.channel === channel ? 'border-2 border-brand bg-teal-50 text-brand' : 'border-slate-200')}>{channel}</button>)}</div>
          {values.channel !== 'Cash Desk' && <TextInput label="UTR / banking reference number" value={values.reference} onChange={(event) => set('reference', event.target.value)} />}
        </Section>
        <Section title="3 · Invoice allocation matrix" aside={`Allocation target: ${formatINR(amount, 2)}`}>
          {openInvoices.length === 0 ? <p className="text-xs text-on-surface-variant">There are no open invoices. The payment will be saved as an unallocated advance.</p> : (
            <ul className="flex flex-col gap-2">{openInvoices.map((entry) => (
              <li key={entry.invoiceId} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3 text-xs">
                <Check checked={entry.invoiceId in picked} onChange={() => toggleInvoice(entry)} label={`${entry.invoiceId} — ${entry.title} (outstanding ${formatINR(entry.balance, 2)})`} />
                {entry.invoiceId in picked && <label className="flex items-center gap-2">Allocate now (₹)<input aria-label={`Allocate to ${entry.invoiceId}`} type="number" min="0" value={picked[entry.invoiceId]} onChange={(event) => setPicked((current) => ({ ...current, [entry.invoiceId]: event.target.value }))} className="w-28 rounded border border-slate-300 px-2 py-1 text-right" /></label>}
              </li>
            ))}</ul>
          )}
          {errors.allocation && <p role="alert" className="mt-2 text-xs text-rose-600">{errors.allocation}</p>}
          <p className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded bg-slate-900 px-3 py-2 text-xs text-white"><span>Total payment intake {formatINR(amount, 2)}</span><span>Total allocated {formatINR(allocated, 2)}</span><span>Remaining vault credit {formatINR(remaining, 2)}</span></p>
        </Section>
        <Section title="4 · Payment narration & cashier audit note">
          <div className="grid gap-3 sm:grid-cols-2"><TextArea label="Public payment narration (prints on receipt voucher)" rows={2} value={values.narration} onChange={(event) => set('narration', event.target.value)} /></div>
          <div className="mt-3"><Check checked={values.notify} onChange={(event) => set('notify', event.target.checked)} label={`Trigger automated SMS & WhatsApp notification to patient (${patient.mobile}) upon transaction commitment`} /></div>
        </Section>
      </div>
    </Drawer>
  )
}
