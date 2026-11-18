import { useState } from 'react'
import { AlertTriangle, Plus, ReceiptText } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { FilterSelect, InfoNote, SearchBox } from '../../../components/workspace/controls'
import { Cell, Row, Table, TableFooter } from '../../../components/workspace/DataTable'
import StatusPill from '../../../components/workspace/StatusPill'
import { cn } from '../../../lib/cn'
import BillingProvider from '../../billing/context/BillingProvider'
import { useBilling } from '../../billing/context/useBilling'
import { PAYMENT_CHANNELS } from '../../billing/constants'
import { allRefunds, refundBalance } from '../../billing/financeLogic'
import { addDays } from '../../appointments/logic'
import { buildLedger, invoiceBalance, ledgerSummary } from '../billing'
import EmptyState from '../components/EmptyState'
import { usePatient } from '../context/usePatient'
import { CreateInvoiceDrawer, InvoiceDetailDrawer, RecordPaymentDrawer } from '../drawers/BillingDrawers'
import { AllocateDrawer, PaymentDetailDrawer, ReceiptDrawer, RefundDrawer } from '../drawers/PaymentDrawers'
import { formatDate, formatINR, formatTime, localToday } from '../format'
import { byNewest } from '../selectors'

const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'invoice', label: 'Invoices', kinds: ['invoice'] },
  { id: 'payment', label: 'Payments', kinds: ['payment'] },
  { id: 'charge', label: 'Charges', kinds: ['charge'] },
  { id: 'receipt', label: 'Receipts' },
  { id: 'refund', label: 'Refunds', kinds: ['refund'] },
]

const BADGE_STYLE = { invoice: 'bg-amber-100 text-amber-900', payment: 'bg-teal-100 text-brand', charge: 'bg-slate-200 text-slate-700', refund: 'bg-violet-100 text-violet-800' }

// The patient's own ledger, loaded from the billing API for this patient only.
export default function BillingTab() {
  const { patientId } = usePatient()
  return (
    <BillingProvider patientId={patientId} inline>
      <PatientLedger />
    </BillingProvider>
  )
}

function PatientLedger() {
  const { patient, patientId, mine } = usePatient()
  const billing = useBilling()
  const { records, services, config, restricted, orgName } = billing
  const [view, setView] = useState('overview')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [branch, setBranch] = useState('')
  const location = useLocation()
  const [drawer, setDrawer] = useState(location.state?.recordPayment ? { type: 'record' } : null)
  const [notice, setNotice] = useState('')
  const [dismissed, setDismissed] = useState(false)

  const invoices = records.invoices
  const payments = records.payments
  const refunds = records.refunds
  const charges = records.charges
  // Held amounts of pending and approved refunds count against the credit, as the API counts them.
  const refundBook = allRefunds(records, billing.refundRequests)
  const encounter = mine('encounters').find((entry) => entry.status === 'In Progress')
  const channels = PAYMENT_CHANNELS.filter((entry) => config.methods[entry.group]).map((entry) => entry.channel)
  const catalogue = services
    .filter((service) => service.status === 'Active' && service.branches[patient.branchId] && service.tax !== 'Not configured')
    .map((service) => ({ serviceId: service.id, code: service.code, name: service.name, note: service.category, price: service.branches[patient.branchId].price ?? service.price, gstPct: service.gstRate, type: service.category === 'Consumables & Supplies' ? 'consumable' : 'service' }))
    .filter((entry) => entry.price > 0)
  const summary = ledgerSummary({ invoices, payments, refunds })
  const ledger = buildLedger({ invoices, payments, refunds, charges })
  const receipts = payments.map((payment) => ({ kind: 'receipt', id: payment.receiptId, date: payment.date, time: payment.time, badge: 'REC', title: `Receipt voucher for ${payment.id}`, context: payment.context, location: payment.desk, branch: payment.payer, amount: payment.amount, status: 'Settled', tone: 'success', objectNote: 'Sealed & signed', amountNote: payment.instrument, paymentId: payment.id })).sort(byNewest)
  const unbilled = charges.filter((charge) => charge.status === 'Unbilled')
  const openInvoices = invoices.map((invoice) => ({ invoiceId: invoice.id, title: invoice.title, balance: invoiceBalance(invoice, payments), dueDate: invoice.dueDate })).filter((entry) => entry.balance > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const creditPayment = payments.find((payment) => refundBalance(payment, refundBook).remaining > 0)
  const insurancePaid = payments.filter((payment) => payment.payer === 'Insurance / TPA').reduce((sum, payment) => sum + payment.amount, 0)
  const hasInsurance = insurancePaid > 0

  const needle = query.trim().toLowerCase()
  const active = VIEWS.find((entry) => entry.id === view)
  const source = view === 'receipt' ? receipts : ledger.filter((row) => view === 'overview' || active.kinds.includes(row.kind))
  const rows = source.filter((row) => (!needle || `${row.id} ${row.title} ${row.context}`.toLowerCase().includes(needle)) && (!status || row.status === status) && (!branch || row.branch === branch || row.location === branch))
  const countFor = (entry) => (entry.id === 'overview' ? undefined : entry.id === 'receipt' ? receipts.length : ledger.filter((row) => entry.kinds.includes(row.kind)).length)

  const invoice = drawer?.type === 'invoice' ? invoices.find((entry) => entry.id === drawer.id) : null
  const payment = ['payment', 'allocate', 'receipt', 'refund'].includes(drawer?.type) ? payments.find((entry) => entry.id === drawer.id) : null
  const close = () => setDrawer(null)

  const uuidOf = (list, id) => list.find((entry) => entry.id === id)?.uuid

  // Each action goes to the API; the ledger reloads afterwards. Errors reach the drawer, which shows them.
  const createInvoice = async ({ chargeIds, items, payer, publicNote, internalNote }) => {
    const created = await billing.createInvoice({
      patientId, encounterId: encounter?.id ?? null, payer, model: config.model, invoiceDate: localToday(), dueDate: addDays(localToday(), 7), discountPct: null,
      chargeIds: chargeIds.map((id) => uuidOf(charges, id)), items, publicNote, internalNote,
    })
    setNotice(`Invoice ${created.reference} issued.`)
  }

  const recordPayment = async ({ amount, channel, reference, payer, narration, allocations }) => {
    const created = await billing.recordPayment({
      patientId, amount, channel, payer, purpose: allocations.length ? 'charges' : 'advance', txnReference: reference || null, narration,
      allocations: allocations.map((entry) => ({ invoiceId: uuidOf(invoices, entry.invoiceId), amount: entry.amount })),
    })
    setNotice(`Payment ${created.reference} of ${formatINR(amount, 2)} recorded${allocations.length ? ' and allocated' : ' as an unallocated advance'}.`)
  }

  const allocate = async (paymentId, plan) => {
    for (const entry of plan) await billing.allocate(uuidOf(payments, paymentId), { invoiceId: uuidOf(invoices, entry.invoiceId), amount: entry.amount })
    setNotice(`Allocated ${formatINR(plan.reduce((sum, entry) => sum + entry.amount, 0), 2)} from ${paymentId}.`)
  }

  const refund = async (paymentId, { amount, reason, justification, memo, releases }) => {
    const created = await billing.requestRefund({ paymentId: uuidOf(payments, paymentId), amount, reason, method: 'Original payment method', internalReference: memo || paymentId, notes: justification, releasesAllocations: releases })
    setNotice(`Refund request ${created.reference} of ${formatINR(amount, 2)} submitted for approval against ${paymentId}.`)
  }

  const act = (row) => {
    if (row.kind === 'invoice') return [['View', () => setDrawer({ type: 'invoice', id: row.id })], ...(row.status !== 'Paid in Full' && creditPayment ? [['Allocate', () => setDrawer({ type: 'allocate', id: creditPayment.id }), true]] : [])]
    if (row.kind === 'payment') return [['View', () => setDrawer({ type: 'payment', id: row.id })], ...(refundBalance(payments.find((entry) => entry.id === row.id), refundBook).remaining > 0 && openInvoices.length ? [['Allocate', () => setDrawer({ type: 'allocate', id: row.id }), true]] : []), ['Receipt', () => setDrawer({ type: 'receipt', id: row.id })]]
    if (row.kind === 'receipt') return [['View', () => setDrawer({ type: 'receipt', id: row.paymentId })]]
    if (row.kind === 'refund') return [['View', () => setDrawer({ type: 'payment', id: refunds.find((entry) => entry.id === row.id).paymentId })]]
    const charge = charges.find((entry) => entry.id === row.id)
    return charge.invoiceId ? [['Linked Inv', () => setDrawer({ type: 'invoice', id: charge.invoiceId })]] : [['Invoice', () => setDrawer({ type: 'create' }), true]]
  }

  if (restricted) {
    return (
      <div>
        <h2 className="mb-1 text-2xl font-bold">Billing</h2>
        <EmptyState icon={ReceiptText} title="Billing is not part of your role">Charges, invoices and payments are shown to people with a finance permission.</EmptyState>
      </div>
    )
  }

  if (!invoices.length && !payments.length && !charges.length) {
    return (
      <div>
        <h2 className="mb-1 text-2xl font-bold">Billing</h2>
        <p className="mb-4 text-sm text-on-surface-variant">View charges, invoices, payments, receipts, allocations, and refunds for this patient.</p>
        <EmptyState icon={ReceiptText} title="No financial activity yet" action={<ActionButton variant="primary" icon={Plus} onClick={() => setDrawer({ type: 'create' })}>Create invoice</ActionButton>}>Charges, invoices and payments for {patient.name} will appear in this ledger.</EmptyState>
        <CreateInvoiceDrawer open={drawer?.type === 'create'} onClose={close} patient={patient} encounter={encounter} charges={unbilled} catalogue={catalogue} onCreate={createInvoice} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-2xl font-bold">Billing </h2><p className="text-sm text-on-surface-variant">View charges, invoices, payments, receipts, allocations, and refunds for this patient. Each is a separate record.</p></div>
        <div className="flex gap-2"><ActionButton onClick={() => window.print()}>Batch Statement (PDF)</ActionButton><ActionButton onClick={() => setDrawer({ type: 'record' })}>Record payment</ActionButton><ActionButton variant="primary" icon={Plus} onClick={() => setDrawer({ type: 'create' })}>Create invoice</ActionButton></div>
      </div>
      {notice && <InfoNote tone="brand" className="mb-4"><span role="status">{notice}</span></InfoNote>}

      <dl className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {[
          ['Outstanding', formatINR(summary.outstanding), summary.nextDue ? `Due ${formatDate(summary.nextDue)}` : 'Nothing due', summary.outstanding ? 'text-amber-700' : 'text-brand'],
          ['Total invoiced', formatINR(summary.invoiced), `Across ${invoices.length} lifetime invoices`],
          ['Total paid', formatINR(summary.paid), 'Net of refunds'],
          ['Unallocated', formatINR(summary.unallocated), summary.unallocated ? 'Credit available' : 'No credit held'],
          ['Refunded', formatINR(summary.refunded), `${refunds.length} refund${refunds.length === 1 ? '' : 's'}`, 'text-violet-700'],
          ...(hasInsurance ? [['Insurance settled', formatINR(insurancePaid), 'Received from insurer / TPA']] : []),
        ].map(([label, value, hint, tone]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-4"><dt className="text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</dt><dd className={cn('mt-3 text-2xl font-bold', tone)}>{value}</dd><p className="text-[11px] text-on-surface-variant">{hint}</p></div>)}
      </dl>

      {!dismissed && summary.outstanding > 0 && summary.unallocated > 0 && openInvoices[0] && creditPayment && (
        <section className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold"><AlertTriangle className="size-4 text-amber-600" aria-hidden="true" />Action Required · Invoice Due &amp; Unallocated Payment Available <StatusPill tone="warning">Urgent</StatusPill></p>
          <p className="mt-1 text-xs">Invoice <strong className="font-mono">#{openInvoices[0].invoiceId}</strong> has <strong>{formatINR(openInvoices[0].balance)}</strong> outstanding (due {formatDate(openInvoices[0].dueDate)}). An unallocated payment of <strong>{formatINR(refundBalance(creditPayment, refundBook).remaining)}</strong> ({creditPayment.id}) is available to apply immediately.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => setDismissed(true)} className="text-xs font-medium underline">Dismiss Alert</button><ActionButton size="sm" onClick={() => setDrawer({ type: 'invoice', id: openInvoices[0].invoiceId })}>View Invoice #{openInvoices[0].invoiceId}</ActionButton><ActionButton size="sm" variant="brand" onClick={() => setDrawer({ type: 'allocate', id: creditPayment.id })}>Allocate {formatINR(refundBalance(creditPayment, refundBook).remaining)} to Invoice →</ActionButton></div>
        </section>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-3">
          <div role="tablist" aria-label="Ledger view" className="flex flex-wrap gap-1">
            {VIEWS.map((entry) => <button key={entry.id} type="button" role="tab" aria-selected={view === entry.id} onClick={() => setView(entry.id)} className={cn('rounded-md px-3 py-1.5 text-xs font-medium', view === entry.id ? 'bg-black text-white' : 'text-on-surface-variant hover:bg-surface-low')}>{entry.label}{countFor(entry) !== undefined && <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 text-[10px] text-slate-700">{countFor(entry)}</span>}</button>)}
          </div>
          <p className="mt-2 text-[10px] font-semibold tracking-wide text-outline uppercase">Ledger: charge → invoice → payment → allocation → receipt</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <SearchBox value={query} onChange={setQuery} label="Search ledger" placeholder="Search by invoice #, payment ID, receipt #, charge ID, service…" className="w-80 max-w-full" />
          <FilterSelect label="Branch" value={branch} onChange={setBranch} allLabel="All Branches" options={[...new Set(ledger.map((row) => row.branch).filter(Boolean))]} />
          <FilterSelect label="Status" value={status} onChange={setStatus} allLabel="All Statuses" options={[...new Set(source.map((row) => row.status))]} />
        </div>
        <Table headings={['Date & time', 'Ledger object', 'Service & context', 'Location', 'Financials', 'Status', 'Actions']} minWidth={1060} empty={rows.length ? null : 'No ledger records match the current filters.'}>
          {rows.map((row) => (
            <Row key={`${row.kind}-${row.id}`}>
              <Cell><p className="font-semibold">{formatDate(row.date)}</p><p className="font-mono text-[11px] text-outline">{formatTime(row.time)} IST</p></Cell>
              <Cell><p className="flex items-center gap-2"><span className={cn('rounded px-1.5 py-0.5 font-mono text-[10px] font-bold', BADGE_STYLE[row.kind] ?? 'bg-slate-200')}>{row.badge}</span><span className="font-mono text-xs font-semibold">#{row.id}</span></p><p className="text-[11px] text-on-surface-variant">{row.objectNote}</p></Cell>
              <Cell><p className="max-w-64 font-medium">{row.title}</p><p className="font-mono text-[10px] text-brand">{row.context}</p></Cell>
              <Cell><p>{row.location}</p><p className="text-[11px] text-on-surface-variant">{row.branch}</p></Cell>
              <Cell className="text-right"><p className="font-semibold">{formatINR(row.amount)}</p><p className="text-[11px] text-on-surface-variant">{row.amountNote}</p></Cell>
              <Cell><StatusPill tone={row.tone}>{row.status}</StatusPill></Cell>
              <Cell><span className="flex flex-wrap gap-1.5">{act(row).map(([label, onClick, primary]) => <ActionButton key={label} size="sm" variant={primary ? 'brand' : 'secondary'} onClick={onClick} aria-label={`${label} ${row.id}`}>{label}</ActionButton>)}</span></Cell>
            </Row>
          ))}
        </Table>
        <TableFooter summary={`Showing ${rows.length} of ${source.length} ledger records`}><span>Total ledger transactions: {invoices.length} invoices, {payments.length} payments, {charges.length} charges, {refunds.length} refunds</span></TableFooter>
      </div>

      <CreateInvoiceDrawer open={drawer?.type === 'create'} onClose={close} patient={patient} encounter={encounter} charges={unbilled} catalogue={catalogue} onCreate={createInvoice} />
      <RecordPaymentDrawer key={channels.join('|')} open={drawer?.type === 'record'} onClose={close} patient={patient} openInvoices={openInvoices} unallocated={summary.unallocated} channels={channels} onRecord={recordPayment} />
      {drawer?.type === 'invoice' && <InvoiceDetailDrawer invoice={invoice} patient={patient} payments={payments} unallocated={summary.unallocated} onClose={close} onAllocate={() => creditPayment && setDrawer({ type: 'allocate', id: creditPayment.id })} onRecordPayment={() => setDrawer({ type: 'record' })} />}
      {drawer?.type === 'payment' && <PaymentDetailDrawer payment={payment ?? payments.find((entry) => entry.id === drawer.id)} patient={patient} refunds={refunds} onClose={close} onAllocate={() => setDrawer({ type: 'allocate', id: drawer.id })} onReceipt={() => setDrawer({ type: 'receipt', id: drawer.id })} onRefund={() => setDrawer({ type: 'refund', id: drawer.id })} />}
      {drawer?.type === 'allocate' && <AllocateDrawer key={drawer.id} payment={payment} patient={patient} refunds={refundBook} openInvoices={openInvoices} onClose={close} onConfirm={allocate} />}
      {drawer?.type === 'receipt' && <ReceiptDrawer payment={payment} patient={patient} orgName={orgName} onClose={close} onBack={() => setDrawer({ type: 'payment', id: drawer.id })} />}
      {drawer?.type === 'refund' && <RefundDrawer key={drawer.id} payment={payment} patient={patient} refunds={refundBook} onClose={close} onConfirm={refund} />}
    </div>
  )
}
