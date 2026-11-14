import { Download } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { invoiceBalance } from '../../patients/billing'
import { usePatientRecords } from '../../patients/context/usePatientRecords'
import { formatDate } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, FilterField, GovernanceFooter, MetricStrip, Section, TextLink } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { DATE_RANGES } from '../constants'
import { useBilling } from '../context/useBilling'
import { REPORT_CATALOG, REFUND_STATUSES, refundSummary, reportFigures } from '../financeLogic'
import { refundContext } from '../refundData'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'

const BAR = { Pending: 'bg-amber-700', Approved: 'bg-brand', Failed: 'bg-red-600', Processed: 'bg-brand', Rejected: 'bg-slate-400' }
const REFUND_NOTE = { Pending: 'request', Approved: 'Not processed', Failed: 'Not returned', Processed: 'Returned', Rejected: 'Excluded' }

export default function FinanceReportsPage() {
  const { records } = usePatientRecords()
  const { refundRequests } = useBilling()
  const filters = useRegisterFilters({ range: DATE_RANGES[0].id })
  const range = DATE_RANGES.find((entry) => entry.id === filters.get('range')) ?? DATE_RANGES[0]
  const { refunds } = refundContext(records, refundRequests)
  const figures = reportFigures(records, refunds, range)
  const summary = refundSummary(figures.refunds.all)
  const largest = Math.max(...REFUND_STATUSES.map((state) => summary[state].amount), 1)
  const payments = records.payments.filter((payment) => payment.date >= range.from && payment.date <= range.to)
  const available = (report) => Boolean(report.source)
  const availableCount = REPORT_CATALOG.filter(available).length

  const rows = {
    payments: [['Payment', 'Date', 'Method', 'Amount (INR)'], ...payments.map((payment) => [payment.id, payment.date, payment.channel, payment.amount])],
    invoices: [['Invoice', 'Date', 'Outstanding (INR)'], ...records.invoices.filter((invoice) => invoice.date >= range.from && invoice.date <= range.to).map((invoice) => [invoice.id, invoice.date, invoiceBalance(invoice, records.payments)])],
    refunds: [['Refund', 'Date', 'Payment', 'Amount (INR)', 'Status'], ...figures.refunds.all.map((refund) => [refund.id, refund.date, refund.paymentId, refund.amount, refund.status])],
  }
  const exportReport = (source) => exportCsv(`finance-${source}.csv`, rows[source])
  const exportSlice = () => ['payments', 'invoices', 'refunds'].forEach(exportReport)
  const amountOf = { payments: figures.collections.amount, invoices: figures.outstanding.amount, refunds: figures.refunds.amount }
  const detailOf = {
    payments: [`${figures.collections.count} verified payment${figures.collections.count === 1 ? '' : 's'}`, 'Payments in the selected period. Not organization collections.'],
    invoices: [`${figures.outstanding.count} invoice${figures.outstanding.count === 1 ? '' : 's'} with a balance`, 'Invoice balance after allocations. No complete receivables or aging ledger.'],
    refunds: [`${figures.refunds.all.length} refund records · All statuses included`, `${summary.Processed.count} processed refunds. Rejected ${money(summary.Rejected.amount)} is separately excluded from totals.`],
  }

  return (
    <BillingFrame back={{ to: ROUTES.billing, label: 'Back to Finance Workspace' }} crumb="Billing & Finance / Finance Reports" code="BF-22 / Aura Health · Billing & Finance" title="Finance Reports" description="Review available financial evidence with explicit report coverage. Source-slice values are not organization totals." actions={<ActionButton variant="brand" icon={Download} onClick={exportSlice}>Export source slice</ActionButton>} scope={false}>
      <p className="mb-5 border-b border-slate-200 pb-4 text-[11px] text-outline">Return to Finance Workspace with {range.label} · All locations (3) · Billing model: All models · Queue context retained.</p>
      <div className="mb-6 grid items-end gap-4 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1fr]">
        <FilterField label="Date range · Source dates" value={range.id} onChange={(value) => filters.change('range', value, DATE_RANGES[0].id)} options={DATE_RANGES.map((entry) => [entry.id, entry.label])} />
        <FilterField label="Organization / branch" value="" disabled options={[['', 'Aura Health · All locations (3)']]} />
        <FilterField label="Report coverage" value="" disabled options={[['', 'Source slice']]} />
        <p className="text-right text-[11px] text-outline">Currency: INR (₹) · Time: IST<br />Finance Manager · Source-slice view</p>
      </div>

      <Banner tone="warning" title="Different coverage sets · Do not combine these metrics" className="mb-6">Collections cover {figures.collections.count} payment{figures.collections.count === 1 ? '' : 's'}, outstanding covers {figures.outstanding.count} invoice{figures.outstanding.count === 1 ? '' : 's'}, and completed refunds cover {figures.refunds.count} record{figures.refunds.count === 1 ? '' : 's'} across different payments. Do not subtract these values to invent net collections. Receipts and allocations are not additional collections.</Banner>

      <MetricStrip items={[
        { label: 'Verified collections · Source slice', value: money(figures.collections.amount), hint: `${figures.collections.count} payment${figures.collections.count === 1 ? '' : 's'}` },
        { label: 'Outstanding · Source slice', value: money(figures.outstanding.amount), hint: `${figures.outstanding.count} invoice${figures.outstanding.count === 1 ? '' : 's'}${figures.outstanding.invoice ? ` · ${figures.outstanding.invoice.id} · Source balance` : ''}` },
        { label: 'Completed refunds · Source slice', value: money(figures.refunds.amount), hint: `${figures.refunds.count} records · Confirmed money returned` },
        { label: 'Reports with partial source data', value: `${availableCount} / ${REPORT_CATALOG.length}`, hint: `${REPORT_CATALOG.length - availableCount} unavailable · No complete organization reports` },
      ]} />

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-2">
        <Section title="Refund status" aside={<ActionButton onClick={() => exportReport('refunds')}>Export refunds ↓</ActionButton>}>
          <p className="-mt-3 mb-5 text-xs text-outline">{figures.refunds.all.length} refund records · Refund-created dates in selected period</p>
          <ul className="space-y-4">{REFUND_STATUSES.map((state) => (
            <li key={state} className="grid grid-cols-[72px_1fr_90px] items-center gap-3 text-xs"><span>{state}</span><span className="h-3 rounded-sm bg-slate-100"><span className={`block h-full rounded-sm ${BAR[state]}`} style={{ width: `${(summary[state].amount / largest) * 100}%` }} /></span><span className="text-right"><strong className="block text-[13px]">{money(summary[state].amount)}</strong><span className="text-[10px] text-outline">{summary[state].count} · {REFUND_NOTE[state]}</span></span></li>
          ))}</ul>
          <p className="mt-5 text-[11px] leading-4 text-outline">Completed = Processed in the Refund Register. Only {money(summary.Processed.amount)} was returned. Rejected {money(summary.Rejected.amount)} is shown separately and excluded from refund totals.</p>
        </Section>
        <Section title="Source evidence & limitations" aside="">
          <p className="-mt-3 mb-4 text-xs text-outline">Coverage applies to each report independently.</p>
          <div className="space-y-4 text-xs leading-5 text-on-surface-variant">
            {payments[0] && <p><TextLink to={pathFor(ROUTES.billingPayment, { paymentId: payments[0].id })}>{payments[0].id} ↗</TextLink> · {money(payments[0].amount)} verified<br />{payments[0].instrument} · {payments[0].desk}. Dated {formatDate(payments[0].date)}.</p>}
            {figures.outstanding.invoice && <p><TextLink to={pathFor(ROUTES.billingInvoice, { invoiceId: figures.outstanding.invoice.id })}>{figures.outstanding.invoice.id} ↗</TextLink> · {money(figures.outstanding.amount)} outstanding<br />Source balance after allocations.</p>}
            <p><TextLink to={ROUTES.billingRefunds}>Refund Register ↗</TextLink> · {figures.refunds.all.length} source records</p>
            <p className="text-outline">Date basis: collection date / refund-created date. Outstanding is the supplied invoice balance, not a period movement or an aging calculation.</p>
          </div>
        </Section>
      </div>

      <section className="mb-6 rounded-md border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 p-6"><div><h2 className="text-[17px] font-semibold">Report catalog & coverage</h2><p className="mt-1 text-xs text-outline">All {REPORT_CATALOG.length} report categories · “—” means unavailable, not zero. Amounts below use distinct source sets.</p></div><ActionButton disabled title="Unavailable reports cannot be exported; no all-data export exists">Export all reports</ActionButton></header>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Report', 'Availability', 'Amount (INR)', 'Source coverage / limitation', 'Export'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{REPORT_CATALOG.map((report) => (
            <tr key={report.name} className="border-t border-slate-100 align-top">
              <td className="px-6 py-4 text-[13px] font-semibold">{report.name}</td>
              <td className="px-6 py-4"><StatusPill tone={available(report) ? 'success' : 'neutral'}>{available(report) ? 'Source slice' : 'Unavailable'}</StatusPill></td>
              <td className="px-6 py-4 text-sm font-semibold">{available(report) ? money(amountOf[report.source]) : '—'}</td>
              <td className="px-6 py-4">{available(report) ? <>{detailOf[report.source][0]}<br /><span className="text-outline">{detailOf[report.source][1]}</span></> : <>{report.note}<br /><span className="text-outline">{report.detail}</span></>}</td>
              <td className="px-6 py-4">{available(report) ? <button type="button" onClick={() => exportReport(report.source)} className="font-semibold text-brand hover:underline">{report.source === 'refunds' ? 'Export refunds ↓' : 'Export slice ↓'}</button> : <>Export disabled<br /><span className="text-outline">Data unavailable</span></>}</td>
            </tr>))}</tbody></table></div>
        <p className="border-t border-slate-200 px-6 py-4 text-[11px] text-outline">Exports include only supplied collection, invoice-balance and refund records with report scope, date filters and source IDs. Unavailable reports cannot be exported; no all-data export is available.</p>
      </section>
      <GovernanceFooter code="BF-22">Not a reconciled organization ledger. No revenue, discount, expense, settlement, branch revenue or profitability data is inferred from payment activity.</GovernanceFooter>
    </BillingFrame>
  )
}
