import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Banner, FilterField, Section } from '../../../components/workspace/RecordKit'
import { pathFor, ROUTES } from '../../../config/routes'
import { DATE_RANGES } from '../../billing/constants'
import { useBilling } from '../../billing/context/useBilling'
import { allRefunds } from '../../billing/financeLogic'
import { invoiceBalance, invoiceTotal } from '../../patients/billing'
import { formatDate, formatINR } from '../../patients/format'
import ReportsFrame from '../components/ReportsFrame'
import { financialFigures } from '../reportsLogic'

const BAR = { Pending: 'bg-amber-700', Approved: 'bg-slate-500', Failed: 'bg-red-700', Rejected: 'bg-slate-400', Processed: 'bg-brand' }
const NOTE = { Pending: 'Pending · no money returned yet', Approved: 'Approved · not processed', Failed: 'Failed · not returned', Rejected: 'Rejected · excluded from refund totals', Processed: 'Processed · money returned' }
const sum = (rows, pick) => Math.round(rows.reduce((total, row) => total + pick(row), 0) * 100) / 100

// Billed, collected and refunded money for a period, from the organisation's finance ledger.
export default function FinancialReportPage() {
  const { records, refundRequests, branches, restricted, scopeText } = useBilling()
  const [rangeId, setRangeId] = useState(DATE_RANGES[1].id)
  const range = DATE_RANGES.find((entry) => entry.id === rangeId) ?? DATE_RANGES[1]
  const refunds = allRefunds(records, refundRequests)
  const figures = financialFigures(records, refunds, range)
  const largest = Math.max(...figures.refundStatus.map((entry) => entry.amount), 1)
  const money = (value) => formatINR(value)
  const byBranch = branches.map((branch) => {
    const payments = figures.collected.payments.filter((payment) => payment.branch === branch.name)
    const invoices = figures.billed.invoices.filter((invoice) => invoice.branch === branch.name)
    return { branch, payments, invoices, collected: sum(payments, (payment) => payment.amount), billed: sum(invoices, invoiceTotal), outstanding: sum(invoices, (invoice) => Math.max(invoiceBalance(invoice, records.payments), 0)) }
  })
  const recent = [...figures.collected.payments].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).slice(0, 3)

  return (
    <ReportsFrame
      code="RPT-03"
      title="Financial"
      description="Billed value, collections and refunds for the selected period, in INR (₹)."
      back={{ to: ROUTES.reports, label: '← Back to Overview · RPT-01' }}
      period={range}
      scopeLabel={scopeText}
      extraFilters={<FilterField label="Period" value={rangeId} onChange={setRangeId} options={DATE_RANGES.map((entry) => [entry.id, entry.label])} />}
      notes={restricted
        ? { title: 'Finance records not available to your role', text: 'Your role has no finance permission, so no billed, collected or refunded amounts are shown.' }
        : { title: 'Live finance ledger', text: 'Figures are worked out from the invoices, payments and refunds recorded for your organisation when this page was opened.' }}
    >
      <Banner tone="warning" title="Billed ≠ collected ≠ recognized revenue" className="mb-6">{figures.billed.invoices.length} invoice{figures.billed.invoices.length === 1 ? '' : 's'} and {figures.collected.payments.length} payment{figures.collected.payments.length === 1 ? '' : 's'} fall in {range.label}. Invoices are counted by issue date and payments by the day they were received; receipts and allocations are not additional collections.</Banner>
      <dl className="mb-6 grid gap-4 sm:grid-cols-4">{[
        ['Billed invoice value', money(figures.billed.amount), `${figures.billed.invoices.length} invoice${figures.billed.invoices.length === 1 ? '' : 's'} issued · not recognized revenue`],
        ['Collected payment', money(figures.collected.amount), `${figures.collected.payments.length} payment${figures.collected.payments.length === 1 ? '' : 's'} received`],
        ['Outstanding on these invoices', money(figures.outstanding.amount), 'Invoice balance after allocations, as of now; not aging.'],
        ['Refunds processed', money(figures.completedRefunds), 'Requests raised in the period that have been processed.'],
      ].map(([label, value, hint]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-5"><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd><p className="mt-2 text-[11px] text-outline">{hint}</p></div>)}</dl>
      <Banner tone="brand" title="Recognized revenue: not calculated — no revenue-recognition ledger" className="mb-6">Collections are money received; they are not revenue earned in the period.</Banner>

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
        <Section title="Refund request status" aside="">
          <p className="-mt-3 mb-5 text-xs text-outline">{figures.refundsCreated.length} request{figures.refundsCreated.length === 1 ? '' : 's'} raised in {range.label}</p>
          <ul className="space-y-4">{figures.refundStatus.map(({ status, amount, count }) => <li key={status} className="grid grid-cols-[72px_1fr_72px] items-center gap-3 text-xs"><span>{status}</span><span className="h-3 rounded-sm bg-slate-100"><span className={`block h-full rounded-sm ${BAR[status]}`} style={{ width: `${(amount / largest) * 100}%` }} /></span><span className="text-right">{money(amount)} · {count}</span></li>)}</ul>
          <p className="mt-4 text-[11px] leading-4 text-outline">Status distribution, not money returned. Approved is not processed; failed was not returned; rejected {money(figures.refundStatus.find((entry) => entry.status === 'Rejected').amount)} is excluded from refund totals.</p>
        </Section>
        <Section title="Latest collections" aside="">
          <p className="-mt-3 mb-4 text-xs text-outline">Most recent payments in the period</p>
          <div className="space-y-4 text-xs leading-5 text-on-surface-variant">
            {recent.length === 0 && <p>No payment was received in {range.label}.</p>}
            {recent.map((payment) => <p key={payment.id}><Link to={pathFor(ROUTES.billingPayment, { paymentId: payment.id })} className="font-semibold text-brand hover:underline">{payment.id} ↗ · {money(payment.amount)}</Link><br />{formatDate(payment.date)} · {payment.instrument} · {payment.desk}</p>)}
          </div>
        </Section>
      </div>

      <Section title="Refunds raised in the period" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">Selected by the date the request was raised</p>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Refund / raised', 'Payment reference', 'Requested INR', 'Status'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{[...figures.refundsCreated].sort((a, b) => b.date.localeCompare(a.date)).map((refund) => <tr key={refund.id} className="border-t border-slate-100"><td className="px-6 py-3"><Link to={pathFor(ROUTES.billingRefund, { refundId: refund.id })} className="font-semibold hover:underline">{refund.id}</Link><br />{formatDate(refund.date)}</td><td className="px-6 py-3">{refund.paymentId}</td><td className="px-6 py-3">{money(refund.amount)}</td><td className="px-6 py-3">{NOTE[refund.status]}</td></tr>)}</tbody></table>
          {figures.refundsCreated.length === 0 && <p className="px-6 py-6 text-center text-sm text-on-surface-variant">No refund was requested in this period.</p>}</div>
        <Link to={ROUTES.billingRefunds} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Open Refund Register ↗</Link>
      </Section>

      <Section title="Branch comparison · coverage, not a ranking" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">Payments by receiving branch, invoices by issuing branch</p>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Branch', 'Collections', 'Billed', 'Outstanding on those invoices'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{byBranch.map(({ branch, payments, invoices, collected, billed, outstanding }) => <tr key={branch.id} className="border-t border-slate-100 align-top"><td className="px-6 py-3 font-semibold">{branch.name}</td><td className="px-6 py-3">{money(collected)} · {payments.length} payment{payments.length === 1 ? '' : 's'}</td><td className="px-6 py-3">{money(billed)} · {invoices.length} invoice{invoices.length === 1 ? '' : 's'}</td><td className="px-6 py-3">{money(outstanding)}</td></tr>)}</tbody></table></div>
        <p className="mt-3 text-[11px] text-outline">A payment counts at the branch that received it, which can differ from the branch that issued the invoice it paid.</p>
      </Section>
    </ReportsFrame>
  )
}
