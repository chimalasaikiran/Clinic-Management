import { Link } from 'react-router-dom'
import { Banner, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { useBilling } from '../../billing/context/useBilling'
import { allRefunds } from '../../billing/financeLogic'
import { RECEIPT_CONFLICTS } from '../../billing/data/financeSeed'
import { usePatientRecords } from '../../patients/context/usePatientRecords'
import { formatDate, formatINR } from '../../patients/format'
import ReportsFrame from '../components/ReportsFrame'
import { REPORT_PERIOD } from '../data/sampleReports'
import { financialFigures } from '../reportsLogic'

const BAR = { Pending: 'bg-amber-700', Approved: 'bg-slate-500', Failed: 'bg-red-700', Rejected: 'bg-slate-400', Processed: 'bg-brand' }
const NOTE = { Pending: 'Pending · no returned-cash claim', Approved: 'Approved · not processed', Failed: 'Failed · not returned', Rejected: 'Rejected · excluded from refund totals', Processed: 'Completed-status · processing date not supplied' }

export default function FinancialReportPage() {
  const { records } = usePatientRecords()
  const { refundRequests } = useBilling()
  const refunds = allRefunds(records, refundRequests)
  const figures = financialFigures(records, refunds, REPORT_PERIOD)
  const largest = Math.max(...figures.refundStatus.map((entry) => entry.amount), 1)
  const invoice = figures.billed.invoices[0]
  const payment = figures.collected.payments[0]
  const conflicts = records.payments.filter((entry) => RECEIPT_CONFLICTS.includes(entry.receiptId) && figures.collected.payments.includes(entry))
  const money = (value) => formatINR(value)

  return (
    <ReportsFrame code="RPT-03" title="Financial" description="Billed value, collections and source balances — independently scoped evidence in INR (₹)." back={{ to: ROUTES.reports, label: '← Back to Overview · RPT-01' }}>
      <Banner tone="warning" title="Billed ≠ collected ≠ recognized revenue" className="mb-6">{figures.billed.invoices.length} invoice, {figures.collected.payments.length} payment and selected refund requests are independent record sets, not a reconciled organization ledger. Receipts and allocations are not additional collections. No net collections or profit is inferred.</Banner>
      <dl className="mb-6 grid gap-4 sm:grid-cols-4">{[['Billed invoice value', money(figures.billed.amount), `${figures.billed.invoices.map((entry) => entry.id).join(', ') || 'No invoice'} · issued ${invoice ? formatDate(invoice.date) : '—'} · not recognized revenue`], ['Collected payment', money(figures.collected.amount), `${figures.collected.payments.map((entry) => entry.id).join(', ') || 'No payment'} · collected ${payment ? formatDate(payment.date) : '—'} · ${figures.collected.payments.length} payment${figures.collected.payments.length === 1 ? '' : 's'}`], ['Source outstanding', money(figures.outstanding.amount), 'Invoice balance after allocations. Snapshot as-of not verified; not October flow or aging.'], ['Completed-status requests', money(figures.completedRefunds), 'Requests created in range with completed status; not period cash outflow.']].map(([label, value, hint]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-5"><dt className="text-[13px]">{label}</dt><dd className="mt-2 text-[32px] leading-9 font-semibold">{value}</dd><p className="mt-2 text-xs leading-4 text-outline">{hint}</p></div>)}</dl>
      <Banner tone="brand" title="Recognized revenue: not calculated — no revenue-recognition ledger supplied" className="mb-6">Payment status “settled” and refund status “completed” are source record statuses, not live-verified results. Refund processing timestamps are not supplied.</Banner>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
        <Section title="Refund request status" aside="">
          <p className="-mt-3 mb-5 text-xs text-outline">{figures.refundsCreated.length} request{figures.refundsCreated.length === 1 ? '' : 's'} created {REPORT_PERIOD.label}</p>
          <ul className="space-y-4">{figures.refundStatus.map(({ status, amount, count }) => <li key={status} className="grid grid-cols-[72px_1fr_72px] items-center gap-3 text-xs"><span>{status}</span><span className="h-3 rounded-sm bg-slate-100"><span className={`block h-full rounded-sm ${BAR[status]}`} style={{ width: `${(amount / largest) * 100}%` }} /></span><span className="text-right font-semibold" title={`${count} request${count === 1 ? '' : 's'}`}>{money(amount)}</span></li>)}</ul>
          <p className="mt-4 text-[11px] leading-4 text-outline">Status distribution, not money returned. Approved is not processed; failed was not returned; rejected {money(figures.refundStatus.find((entry) => entry.status === 'Rejected').amount)} is excluded from refund totals. Do not sum requested amounts as cash outflow.</p>
        </Section>
        <Section title="Auditable source records" aside="">
          <p className="-mt-3 mb-4 text-xs text-outline">Source evidence · detail permissions are separate</p>
          <div className="space-y-4 text-xs leading-5 text-on-surface-variant">
            {payment && <p><Link to={pathFor(ROUTES.billingPayment, { paymentId: payment.id })} className="font-semibold text-brand hover:underline">{payment.id} ↗ · {money(payment.amount)}</Link><br />{formatDate(payment.date)} · {payment.instrument.replace(/\s*\(.*\)$/, '')} · {payment.desk}. Settled source status only.</p>}
            {invoice && <p><Link to={pathFor(ROUTES.billingInvoice, { invoiceId: invoice.id })} className="font-semibold text-brand hover:underline">{invoice.id} ↗ · billed {money(figures.billed.amount)}</Link><br />Issued {formatDate(invoice.date)}. Source outstanding {money(figures.outstanding.amount)} after allocation; do not subtract the payment instead.</p>}
            {conflicts.map((entry) => <Banner key={entry.id} tone="warning" title="Receipt / encounter conflicts">{entry.receiptId} amount is not verified; issue status unknown. Excluded from additional collections.</Banner>)}
          </div>
        </Section>
      </div>

      <Section title="Refund-created cohort · source audit" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">Created date determines selection · branch mapping not supplied</p>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Refund / created date', 'Payment reference', 'Requested INR', 'Source status / treatment'].map((heading) => <th key={heading} scope="col" className="px-6 py-2.5">{heading}</th>)}</tr></thead>
          <tbody>{figures.refundsCreated.sort((a, b) => b.date.localeCompare(a.date)).map((refund) => <tr key={refund.id} className="border-t border-slate-100"><td className="px-6 py-3"><Link to={pathFor(ROUTES.billingRefund, { refundId: refund.id })} className="font-semibold hover:underline">{refund.id}</Link><br />{formatDate(refund.date)}</td><td className="px-6 py-3">{refund.paymentId}</td><td className="px-6 py-3">{money(refund.amount)}</td><td className="px-6 py-3">{NOTE[refund.status]}</td></tr>)}</tbody></table></div>
        {figures.excludedRefunds.map((refund) => <Banner key={refund.id} tone="warning" title={`Excluded from this period: ${refund.id} · ${money(refund.amount)}`} className="mt-4">Created {formatDate(refund.date)} · {refund.paymentId} · completed source status. It is excluded from the selected creation cohort and not added to the {money(figures.completedRefunds)} metric.</Banner>)}
        <Link to={ROUTES.billingRefunds} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Open Refund Register ↗ · preserve selected creation-date scope</Link>
      </Section>

      <Section title="Branch comparison · coverage, not a ranking" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">All permitted locations selected does not mean complete organization coverage</p>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Branch / source bucket', 'Collections', 'Billed / outstanding', 'Refund coverage'].map((heading) => <th key={heading} scope="col" className="px-6 py-2.5">{heading}</th>)}</tr></thead>
          <tbody>
            <tr className="border-t border-slate-100 align-top"><td className="px-6 py-3 font-semibold">{payment?.desk ?? 'Main Surgical Pavilion'}</td><td className="px-6 py-3">{money(figures.collected.amount)} · {figures.collected.payments.length} payment<br /><span className="text-outline">Collection date {payment ? formatDate(payment.date) : '—'}</span></td><td className="px-6 py-3">Invoice branch not verified — not assigned here</td><td className="px-6 py-3">Refund branches not verified — not assigned here</td></tr>
            <tr className="border-t border-slate-100 align-top"><td className="px-6 py-3 font-semibold">Other permitted branches</td><td className="px-6 py-3">No branch-mapped source records — not zero</td><td className="px-6 py-3">No branch-mapped source records — not zero</td><td className="px-6 py-3">No branch-mapped source records — not zero</td></tr>
            <tr className="border-t border-slate-100 align-top"><td className="px-6 py-3 font-semibold">Unmapped source records<br /><span className="font-normal text-outline">Not an additional branch</span></td><td className="px-6 py-3">No additional collection record supplied</td><td className="px-6 py-3">{money(figures.billed.amount)} billed / {money(figures.outstanding.amount)} outstanding<br /><span className="text-outline">One invoice; as-of not verified</span></td><td className="px-6 py-3">{money(figures.completedRefunds)} completed-status request created in range; branch unverified</td></tr>
          </tbody></table></div>
        <p className="mt-3 text-[11px] text-outline">Known branch applies only to the payment. Invoice balance is a source snapshot, not a receivable movement or aging measure. No organization total or branch revenue comparison is calculated.</p>
      </Section>
    </ReportsFrame>
  )
}
