import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { formatDate, formatINR, formatTime } from '../../patients/format'
import BillingFrame, { Card, Note } from '../components/BillingFrame'
import { BILLING_MODELS, DATE_RANGES } from '../constants'
import { useBilling } from '../context/useBilling'
import { billingOverview, priorityQueue, recentActivity } from '../registerLogic'

const SECTIONS = [
  ['Records', [['Charges', ROUTES.billingCharges], ['Invoices', ROUTES.billingInvoices], ['Payments', ROUTES.billingPayments], ['Receipts', ROUTES.billingReceipts], ['Refunds', ROUTES.billingRefunds]]],
  ['Finance', [['Reconciliation', ROUTES.billingReconciliation], ['Advances/Wallet', ROUTES.billingBalances], ['Settlements', ROUTES.billingSettlements], ['Finance Reports', ROUTES.billingReports]]],
  ['Setup', [['Services & Pricing', ROUTES.billingServices], ['Billing Configuration', ROUTES.billingConfig]]],
]
const TONE = { 'Partially Paid': 'warning', 'Partially allocated': 'brand', Settled: 'success', 'Paid in Full': 'success', Refunded: 'neutral', Issued: 'info' }

export default function BillingHubPage() {
  const { records, getPatient, config, refundRequests, orgName, scopeText } = useBilling()
  const [rangeId, setRangeId] = useState(DATE_RANGES[0].id)
  const [branch, setBranch] = useState('')
  const [model, setModel] = useState('')
  const range = DATE_RANGES.find((entry) => entry.id === rangeId)
  const branches = [...new Set(records.invoices.map((invoice) => invoice.branch ?? invoice.location))]
  const scoped = { ...records, invoices: records.invoices.filter((invoice) => (!branch || (invoice.branch ?? invoice.location) === branch) && (!model || invoice.model === model)) }
  const nameOf = (id) => getPatient(id)?.name ?? 'Unknown patient'
  const overview = billingOverview(scoped, range)
  const queue = priorityQueue(scoped, range, nameOf)
  const activity = recentActivity(scoped, range, nameOf)
  const invoicePath = (id) => pathFor(ROUTES.billingInvoice, { invoiceId: id })
  const paymentPath = (row) => pathFor(ROUTES.patientBilling, { patientId: row.patientId })

  return (
    <BillingFrame back={{ to: ROUTES.dashboard, label: 'Back to Owner Panel' }} crumb="Owner Panel / Billing & Finance" code="BF-01 / Organization workspace" title="Billing & Finance" description={`Review financial work across ${orgName}. Open linked records without changing settled history.`} actions={<ActionButton variant="primary" icon={Plus} to={ROUTES.billingPaymentNew}>Record payment</ActionButton>} scope={false}>
      <div className="mb-3 grid gap-4 sm:grid-cols-3">
        <label className="text-xs text-outline">Organization / branch<select aria-label="Branch" value={branch} onChange={(event) => setBranch(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-brand"><option value="">{scopeText}</option>{branches.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        <label className="text-xs text-outline">Date range · Custom<select aria-label="Date range" value={rangeId} onChange={(event) => setRangeId(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-brand">{DATE_RANGES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
        <label className="text-xs text-outline">Billing model<select aria-label="Billing model" value={model} onChange={(event) => setModel(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-brand"><option value="">All models</option>{BILLING_MODELS.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
      </div>
      <p className="mb-5 flex flex-wrap justify-between gap-2 text-[11px] text-outline"><span>Organization default model: {config.model}. The model filter narrows invoices to those issued under it.</span><span>Currency: INR (₹) · Time: IST</span></p>

      <nav aria-label="Billing sections" className="mb-6 rounded-lg border border-slate-200 bg-white p-4 text-xs">
        {SECTIONS.map(([label, links]) => (
          <p key={label} className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 last:mb-0"><span className="w-20 text-[10px] font-semibold tracking-wide text-outline uppercase">{label}</span>{links.map(([name, to]) => <Link key={name} to={to} className="font-semibold text-brand hover:underline">{name} ↗</Link>)}</p>
        ))}
      </nav>

      <Card title="Financial overview" aside={`${orgName} · ${branch || 'All locations'}`} className="mb-6">
        <dl className="grid gap-4 sm:grid-cols-4">
          {[['Collections', formatINR(overview.collections), 'Net of refunds, selected period'], ['Outstanding balances', formatINR(overview.outstanding), `${overview.invoiceCount} invoices in scope`], ['Unallocated payments', formatINR(overview.unallocated), 'Credit not applied to an invoice'], ['Refunds awaiting review', String(refundRequests.filter((refund) => refund.status === 'Pending').length), 'Pending review']].map(([label, value, hint]) => (
            <div key={label}><dt className="text-xs font-semibold">{label}</dt><dd className="mt-1 text-2xl font-semibold">{value}</dd><p className="text-[11px] text-outline">{hint}</p></div>
          ))}
        </dl>
        <p className="mt-4 rounded-md bg-surface-lowest px-3 py-2 text-[11px] text-on-surface-variant">Figures come from the invoices, payments and refunds recorded for {orgName}. Refunds count once the money has gone back.</p>
      </Card>

      <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="px-6 pt-5"><h2 className="text-base font-semibold">Priority queue</h2><p className="text-xs text-outline">Invoices with a balance and payments with credit still to apply</p></header>
        <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          {queue.length === 0 && <li className="px-6 py-6 text-sm text-on-surface-variant">Nothing is waiting on a person in this scope.</li>}
          {queue.map((row) => (
            <li key={row.id} className="grid items-center gap-3 px-6 py-4 text-xs md:grid-cols-[1.1fr_2.4fr_1fr_1fr]">
              <p className="font-semibold">{row.kind === 'invoice' ? 'Unpaid / partially paid invoices' : 'Unallocated payments'}<br /><StatusPill tone={TONE[row.status]}>{row.status}</StatusPill></p>
              <p><Link to={row.kind === 'invoice' ? invoicePath(row.id) : paymentPath(row)} className="font-semibold text-brand hover:underline">{row.id} ↗</Link> <span className="text-outline">{formatDate(row.date)} · {formatTime(row.time)} IST</span><br />{row.name} · {getPatient(row.patientId)?.mrn}<br /><span className="text-on-surface-variant">{row.branch}</span><br /><span className="text-outline">{row.note}</span></p>
              <p className="text-right"><span className="text-xl font-semibold">{formatINR(row.amount)}</span><br /><span className="text-outline">{row.kind === 'invoice' ? 'Outstanding' : 'Unallocated'}</span></p>
              <p className="text-right"><ActionButton size="sm" to={row.kind === 'invoice' ? invoicePath(row.id) : paymentPath(row)}>{row.kind === 'invoice' ? 'View invoice' : 'Review allocation'}</ActionButton></p>
            </li>
          ))}
          <li className="grid gap-3 px-6 py-3 text-xs md:grid-cols-[1.1fr_3.4fr_1fr]"><span className="font-semibold">Pending refunds</span><span className="text-on-surface-variant">{overview.pendingRefunds ? `${overview.pendingRefunds} awaiting review` : 'No refunds are awaiting review.'}</span><span className="text-right text-outline">—</span></li>
        </ul>
      </section>

      <section className="mb-6 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="flex justify-between px-6 pt-5"><div><h2 className="text-base font-semibold">Recent financial activity</h2><p className="text-xs text-outline">Records within {range.label}, newest first</p></div></header>
        <div className="overflow-x-auto"><table className="mt-3 w-full min-w-[800px] text-left text-xs">
          <thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Date & time', 'Record / status', 'Party / location', 'Amount (INR)', 'Related records'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>
            {activity.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 align-top">
                <td className="px-6 py-3">{formatDate(row.date)}<br /><span className="text-outline">{formatTime(row.time)} IST</span></td>
                <td className="px-6 py-3"><Link to={row.kind === 'invoice' ? invoicePath(row.id) : paymentPath(row)} className="font-semibold text-brand hover:underline">{row.id} ↗</Link><br />{row.label}<br /><StatusPill tone={TONE[row.status]}>{row.status}</StatusPill></td>
                <td className="px-6 py-3">{row.name} · {getPatient(row.patientId)?.mrn}</td>
                <td className="px-6 py-3 text-right text-sm font-semibold">{formatINR(row.amount)}</td>
                <td className="px-6 py-3">{row.related.map(([label, id]) => <p key={id}>{label} <span className="font-mono">{id}</span></p>)}</td>
              </tr>
            ))}
          </tbody>
        </table>{activity.length === 0 && <p className="px-6 py-8 text-center text-sm text-on-surface-variant">No financial activity in this range.</p>}</div>
      </section>
      <Note title="Distinct records. Traceable relationships.">Charge ≠ Invoice ≠ Payment ≠ Receipt ≠ Allocation ≠ Refund. Refunds, configuration changes and settlements require separate authorized records.</Note>
    </BillingFrame>
  )
}
