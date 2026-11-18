import { Download, Printer } from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { allocatedToInvoice, invoiceBalance, invoiceStatus, invoiceTotals, lineAmounts, paymentUnallocated } from '../../patients/billing'
import { useBilling } from '../context/useBilling'
import { MissingRecord } from '../../inventory/components/DetailFrame'
import { formatDate, formatINR, formatTime } from '../../patients/format'
import BillingFrame, { Card, Note } from '../components/BillingFrame'
import { isOverdue } from '../registerLogic'

const TONE = { 'Partially Paid': 'warning', 'Paid in Full': 'success', Issued: 'info' }
const Fact = ({ label, value }) => <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-xs last:border-0"><dt className="text-outline">{label}</dt><dd className="text-right font-medium">{value}</dd></div>

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams()
  const { records, getPatient, orgName } = useBilling()
  const location = useLocation()
  const invoice = records.invoices.find((entry) => entry.id === invoiceId)
  if (!invoice) return <MissingRecord what="invoice" backTo={ROUTES.billingInvoices} backLabel="Back to the invoice register" />

  const patient = getPatient(invoice.patientId)
  const totals = invoiceTotals(invoice.lines)
  const status = invoiceStatus(invoice, records.payments)
  const balance = invoiceBalance(invoice, records.payments)
  const paid = allocatedToInvoice(invoice.id, records.payments)
  const overdue = isOverdue(invoice, records.payments)
  const payments = records.payments.filter((payment) => payment.allocations.some((allocation) => allocation.invoiceId === invoice.id))
  const unallocated = payments.reduce((sum, payment) => sum + paymentUnallocated(payment, records.refunds), 0)
  const charges = records.charges.filter((charge) => charge.invoiceId === invoice.id)
  const back = `${ROUTES.billingInvoices}${location.state?.search ?? ''}`
  const billingTab = pathFor(ROUTES.patientBilling, { patientId: invoice.patientId })

  const download = () => exportCsv(`${invoice.id}.csv`, [['Code', 'Service', 'Qty', 'Unit price', 'Discount %', 'GST %', 'Amount'], ...invoice.lines.map((line) => [line.code, line.name, line.qty, line.price, line.discountPct, line.gstPct, lineAmounts(line).total]), ['', 'Total', '', '', '', '', totals.total]])

  return (
    <BillingFrame back={{ to: back, label: 'Invoice Register' }} crumb={`Billing & Finance / Invoices / ${invoice.id}`} code="BF-08 / Billing & Finance" title={invoice.id} description={`${invoice.title} · ${formatDate(invoice.date)}, ${formatTime(invoice.time)} IST`} scope={false}
      actions={<><ActionButton icon={Download} onClick={download}>Download</ActionButton><ActionButton icon={Printer} onClick={() => window.print()}>Print</ActionButton>{balance > 0 && <ActionButton variant="primary" to={billingTab} state={{ recordPayment: true }}>Record Payment</ActionButton>}</>}>
      <p className="mb-5 flex flex-wrap items-center gap-2 text-xs"><StatusPill tone={TONE[status]}>{status}</StatusPill><StatusPill>Protected financial record</StatusPill><span className="text-outline">Record Payment requires payment-create permission · payment and allocation remain separate records.</span></p>

      <div className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card title="Invoice context" aside={`${orgName} · INR (₹)`}>
            <div className="grid gap-x-8 sm:grid-cols-2"><dl><Fact label="Patient" value={<Link to={pathFor(ROUTES.patientHub, { patientId: invoice.patientId })} className="text-brand hover:underline">{patient?.name} · {patient?.mrn}</Link>} /><Fact label="Invoice payer" value={invoice.payer ?? 'Not recorded'} /><Fact label="Due date" value={invoice.dueDate ? formatDate(invoice.dueDate) : 'Not recorded'} /></dl><dl><Fact label="Branch" value={invoice.branch ?? invoice.location} /><Fact label="Encounter" value={invoice.encounterId && invoice.encounterId !== '—' ? <Link to={pathFor(ROUTES.encounter, { patientId: invoice.patientId, encounterId: invoice.encounterId })} className="text-brand hover:underline">{invoice.encounterId}</Link> : 'Not linked'} /><Fact label="Document" value={invoice.kind ?? 'Invoice'} /></dl></div>
          </Card>

          <Card title="Invoice line items" aside={`${invoice.lines.length} line${invoice.lines.length === 1 ? '' : 's'}`}>
            <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Service / linked charge', 'Qty', 'Unit price', 'Discount', 'Tax', 'Amount'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
              <tbody>{invoice.lines.map((line) => { const amounts = lineAmounts(line); return <tr key={line.code} className="border-t border-slate-100"><td className="px-6 py-3"><strong>{line.name}</strong><br /><span className="text-outline">{line.code} · {line.note}</span></td><td className="px-6 py-3">{line.qty}</td><td className="px-6 py-3">{formatINR(line.price, 2)}</td><td className="px-6 py-3">{line.discountPct ? `${line.discountPct}%` : '—'}</td><td className="px-6 py-3">{line.gstPct ? `${line.gstPct}% · ${formatINR(amounts.tax, 2)}` : 'Exempt'}</td><td className="px-6 py-3 text-right font-semibold">{formatINR(amounts.total, 2)}</td></tr> })}</tbody>
            </table></div>
          </Card>

          <Card title="Payment, allocation & receipt references" aside="Separate, linked records">
            {payments.length === 0 && <p className="text-sm text-on-surface-variant">No payment has been allocated to this invoice yet.</p>}
            {payments.map((payment) => {
              const allocated = payment.allocations.filter((entry) => entry.invoiceId === invoice.id).reduce((sum, entry) => sum + entry.amount, 0)
              return (
                <div key={payment.id} className="mb-4 border-b border-slate-100 pb-4 last:mb-0 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-4 text-xs"><div><Link to={billingTab} className="font-semibold text-brand hover:underline">{payment.id} ↗</Link><p className="text-outline">{formatDate(payment.date)} · {formatTime(payment.time)} IST</p><p>{payment.instrument}</p><StatusPill tone="success">Settled &amp; recorded</StatusPill></div><dl className="min-w-56"><Fact label="Payment received" value={formatINR(payment.amount)} /><Fact label="Allocated to this invoice" value={formatINR(allocated)} /><Fact label="Unallocated remainder" value={formatINR(paymentUnallocated(payment, records.refunds))} /></dl></div>
                  {payment.receiptId && <p className="mt-2 text-xs"><span className="font-mono font-semibold">{payment.receiptId}</span> · Receipt</p>}
                </div>
              )
            })}
          </Card>

          <Card title="Audit history & source activity" aside="Available records only">
            <ol className="flex flex-col gap-3 text-xs">
              <li className="grid gap-1 sm:grid-cols-[10rem_1fr]"><span className="text-outline">{formatDate(invoice.date)} · {formatTime(invoice.time)} IST</span><span><strong>Invoice issued · {invoice.id}</strong><br />{formatINR(totals.total, 2)} · {invoice.cashier ?? 'Billing desk'}</span></li>
              {payments.map((payment) => <li key={payment.id} className="grid gap-1 sm:grid-cols-[10rem_1fr]"><span className="text-outline">{formatDate(payment.date)} · {formatTime(payment.time)} IST</span><span><strong>Payment allocated · {payment.id}</strong><br />{formatINR(payment.allocations.filter((entry) => entry.invoiceId === invoice.id).reduce((sum, entry) => sum + entry.amount, 0), 2)} applied to this invoice</span></li>)}
            </ol>
          </Card>
        </div>

        <div className="flex flex-col gap-5 self-start">
          <Card title="Financial breakdown" aside="From the invoice lines">
            <dl><Fact label="Subtotal" value={formatINR(totals.gross, 2)} /><Fact label="Discounts" value={totals.discount ? `−${formatINR(totals.discount, 2)}` : '—'} /><Fact label="Tax (CGST + SGST)" value={totals.tax ? formatINR(totals.tax, 2) : 'Exempt'} /></dl>
            <p className="mt-3 flex items-baseline justify-between border-t border-slate-200 pt-3"><span className="text-xs font-semibold">Invoice total</span><span className="text-2xl font-semibold">{formatINR(totals.total, 2)}</span></p>
            <p className="mt-1 flex justify-between text-xs"><span className="text-outline">Paid / allocated amount</span><span className="font-semibold">{formatINR(paid, 2)}</span></p>
            <div className={`mt-4 rounded-md p-4 ${balance > 0 ? 'bg-amber-50' : 'bg-emerald-50'}`}><p className="text-xs font-semibold text-amber-900">{balance > 0 ? 'Outstanding balance' : 'Settled'}</p><p className="text-3xl font-semibold">{formatINR(balance, 2)}</p><p className="text-[11px] text-on-surface-variant">{invoice.dueDate ? `Due ${formatDate(invoice.dueDate)}${overdue ? ' · overdue' : ''}` : 'Due date not recorded'}</p></div>
          </Card>
          {unallocated > 0 && balance > 0 && <Note tone="brand" title={`${formatINR(unallocated)} remains unallocated`}>This payment remainder is not paid on this invoice and is not auto-applied. Open the patient’s billing record to allocate it; this does not record another payment or issue a refund.</Note>}
          <Card title="Linked charges" aside={charges.length ? 'Verified' : 'None'}>
            {charges.length === 0 ? <p className="text-xs text-on-surface-variant">No charges are linked to this invoice.</p> : charges.map((charge) => <p key={charge.id} className="mb-2 text-xs"><strong className="font-mono">{charge.id}</strong> · {charge.title}</p>)}
          </Card>
          <Card title="Protected record"><p className="text-xs text-on-surface-variant">Finalized lines, tax, dates and totals cannot be silently changed. Corrections and refunds need distinct, authorized records and an audit history.</p></Card>
        </div>
      </div>
      <p className="mt-5 text-[11px] text-outline">Back → Invoice Register with filters and search retained. Charge ≠ Invoice ≠ Payment ≠ Receipt ≠ Allocation ≠ Refund.</p>
    </BillingFrame>
  )
}
