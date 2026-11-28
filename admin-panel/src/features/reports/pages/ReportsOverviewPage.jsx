import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Section } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import { formatINR } from '../../patients/format'
import { useBilling } from '../../billing/context/useBilling'
import { allRefunds } from '../../billing/financeLogic'
import ReportsFrame from '../components/ReportsFrame'
import { DATE_RANGES } from '../../billing/constants'
import { useOperationsReport } from '../useOperationsReport'
import { usePharmacyReport } from '../usePharmacyReport'
import { financialFigures, operationsFigures } from '../reportsLogic'

export default function ReportsOverviewPage() {
  const { records, refundRequests } = useBilling()
  const month = DATE_RANGES[1]
  const [query, setQuery] = useState('')
  const operationsReport = useOperationsReport()
  const operations = operationsReport.report ? operationsFigures(operationsReport.report) : null
  const financial = financialFigures(records, allRefunds(records, refundRequests), month)
  const { report: pharmacy, restricted: noStock } = usePharmacyReport()
  const show = (text) => !query.trim() || text.toLowerCase().includes(query.trim().toLowerCase())
  const cards = [
    { id: 'operations', title: 'Operations', tag: !operationsReport.allowed ? 'Not available to your role' : `Live appointments · ${operationsReport.period.label}`, text: operations ? `${operations.scheduled} appointment${operations.scheduled === 1 ? '' : 's'} starting in the period across ${operationsReport.report.branches.length} permitted branch${operationsReport.report.branches.length === 1 ? '' : 'es'}.` : operationsReport.allowed ? 'Loading appointment records…' : 'Your role has no reports permission.', to: ROUTES.reportsOperations, link: 'View Operations →',
      stats: operations ? [[String(operations.scheduled), 'scheduled records'], [String(operations.completed), 'completed'], [operations.meanWait === null ? '—' : `${operations.meanWait} min`, `mean wait · ${operationsReport.report.wait.pairs} check-in pairs`]] : [], note: operations ? `No-show ${operations.noShowRate === null ? '—' : `${operations.noShowRate}%`} of attendance-assessable appointments · ${operations.open} not yet closed.` : '' },
    { id: 'financial', title: 'Financial', tag: `Live ledger · ${month.label}`, text: `${financial.billed.invoices.length} invoice${financial.billed.invoices.length === 1 ? '' : 's'} issued and ${financial.collected.payments.length} payment${financial.collected.payments.length === 1 ? '' : 's'} received this month.`, to: ROUTES.reportsFinancial, link: 'View Financial →',
      stats: [[formatINR(financial.billed.amount), 'billed invoice value · not recognized revenue'], [formatINR(financial.collected.amount), `collected · ${financial.collected.payments.length} payment`], [formatINR(financial.outstanding.amount), 'outstanding on those invoices']], note: 'Independent record sets. Do not add or subtract these amounts into a net value.' },
    { id: 'pharmacy', title: 'Pharmacy & Inventory', tag: noStock ? 'Not available to your role' : 'Live stock ledger · last 30 days', text: pharmacy ? `${pharmacy.dispensed.toLocaleString('en-IN')} base units dispensed, ${pharmacy.stockouts} item${pharmacy.stockouts === 1 ? '' : 's'} out of stock, and ${formatINR(pharmacy.nearExpiryValue)} of stock expiring within 30 days at unit price.` : noStock ? 'Your role has no inventory or pharmacy permission.' : 'Loading stock records…', to: ROUTES.reportsPharmacy, link: 'View Pharmacy & Inventory →',
      stats: [], note: pharmacy ? `Stock received ${formatINR(pharmacy.receivedValue)} · dispensed value ${formatINR(pharmacy.dispensedValue)} at unit price. No margin is calculated: no separate selling price is recorded.` : '' },
  ].filter((card) => show(`${card.title} ${card.text} ${card.tag}`))

  return (
    <ReportsFrame title="Reports overview" description="Operational and financial source coverage, with a clear path into each owner report." query={query} onQuery={setQuery} notes={{ title: 'Live records', text: 'Each report reads the records when it opens, within the branches your role covers.' }}>
      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        {cards.map((card) => (
          <article key={card.id} className="flex flex-col rounded-md border border-slate-200 bg-white p-5">
            <StatusPill tone={card.id === 'pharmacy' ? 'success' : 'neutral'} className="self-start">{card.tag.toUpperCase()}</StatusPill>
            <h2 className="mt-3 text-xl font-semibold">{card.title}</h2>
            <p className="mt-2 text-xs leading-5 text-on-surface-variant">{card.text}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">{card.stats.map(([value, label]) => <div key={label}><dd className="text-2xl font-semibold">{value}</dd><dt className="text-[11px] leading-4 text-outline">{label}</dt></div>)}</dl>
            <p className="mt-4 flex-1 text-[11px] leading-4 text-outline">{card.note}</p>
            <Link to={card.to} className="mt-3 text-xs font-semibold text-brand hover:underline">{card.link}</Link>
          </article>))}
      </div>
      {cards.length === 0 && <p className="mb-6 rounded-md border border-slate-200 bg-white px-6 py-10 text-center text-sm text-on-surface-variant">No reports or measures match this search.</p>}
      <Section title="Source health & coverage" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">Where each report reads from · live when the page opens</p>
        <div className="grid gap-6 text-xs sm:grid-cols-3">{[['Appointments', 'Appointment records and history, check-in and consultation-start times, therapist consulting hours, leave and blocks.', 'Needs the reports permission; branches follow your role.'], ['Billing, payments & refunds', 'The billing ledger: invoices, payments and refunds.', 'Billed, collected and refunded are kept apart; not recognized revenue.'], ['Pharmacy & inventory', 'Stock batches, movements and dispensing.', 'Valued at unit price; no margin is calculated.']].map(([title, line, note]) => <div key={title}><p className="text-[13px] font-semibold">{title}</p><p className="mt-1 leading-5">{line}</p><p className="mt-1 text-outline">{note}</p></div>)}</div>
      </Section>
    </ReportsFrame>
  )
}
