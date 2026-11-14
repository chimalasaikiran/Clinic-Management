import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Section } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import { formatINR } from '../../patients/format'
import { usePatientRecords } from '../../patients/context/usePatientRecords'
import { useBilling } from '../../billing/context/useBilling'
import { allRefunds } from '../../billing/financeLogic'
import ReportsFrame from '../components/ReportsFrame'
import { OPERATIONS, PHARMACY, REPORT_PERIOD } from '../data/sampleReports'
import { financialFigures, operationsFigures, pharmacyFigures } from '../reportsLogic'

export default function ReportsOverviewPage() {
  const { records } = usePatientRecords()
  const { refundRequests } = useBilling()
  const [query, setQuery] = useState('')
  const operations = operationsFigures(OPERATIONS)
  const financial = financialFigures(records, allRefunds(records, refundRequests), REPORT_PERIOD)
  const pharmacy = pharmacyFigures(PHARMACY)
  const show = (text) => !query.trim() || text.toLowerCase().includes(query.trim().toLowerCase())
  const cards = [
    { id: 'operations', title: 'Operations', tag: 'Closed sample cohort', text: 'Main Surgical Pavilion only. A separate reporting sample, not organization totals.', to: ROUTES.reportsOperations, link: 'View Operations → RPT-02',
      stats: [[String(operations.scheduled), 'scheduled records'], [String(operations.completed), 'completed'], [`${operations.meanWait} min`, `mean wait · ${OPERATIONS.waitPairs} valid timestamp pairs`]], note: `${REPORT_PERIOD.label.replace(' 2026', '')} appointment starts. No reconciliation with the conflicting 14 Oct Appointments snapshot.` },
    { id: 'financial', title: 'Financial', tag: 'Independent source slices', text: `${financial.billed.invoices.length} invoice, ${financial.collected.payments.length} payment and selected refund requests. Branch mapping is incomplete.`, to: ROUTES.reportsFinancial, link: 'View Financial → RPT-03',
      stats: [[formatINR(financial.billed.amount), 'billed invoice value · not recognized revenue'], [formatINR(financial.collected.amount), `collected · ${financial.collected.payments.length} payment`], [formatINR(financial.outstanding.amount), 'source outstanding']], note: 'Independent record sets. Do not add or subtract these amounts into a net value.' },
    { id: 'pharmacy', title: 'Pharmacy & Inventory', tag: 'Enabled — sample data', text: `Main Pharmacy at Main Surgical Pavilion: ${pharmacy.dispensed.toLocaleString('en-IN')} mixed base units dispensed, ${pharmacy.stockouts} stockout incidents, and ${formatINR(pharmacy.nearExpiryValue)} near-expiry stock value at cost.`, to: ROUTES.reportsPharmacy, link: 'View Pharmacy & Inventory → RPT-04',
      stats: [], note: `Purchases ${formatINR(pharmacy.purchases)} · Net sales ${formatINR(pharmacy.sales)} · COGS ${formatINR(pharmacy.cogs)} · Gross profit ${formatINR(pharmacy.grossProfit)} · Margin ${pharmacy.margin}%.` },
  ].filter((card) => show(`${card.title} ${card.text} ${card.tag}`))

  return (
    <ReportsFrame code="RPT-01" title="Reports overview" description="Operational and financial source coverage, with a clear path into each owner report." query={query} onQuery={setQuery}>
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
        <p className="-mt-3 mb-4 text-xs text-outline">Expected services · local sample evidence only · none live-refreshed</p>
        <div className="grid gap-6 text-xs sm:grid-cols-3">{[['Appointments reporting service', 'Local sample cohort · Main Surgical Pavilion only.', 'Attendance, check-in pairs and clinical capacity samples.'], ['Billing, payments & refunds', 'Local source slice · incomplete branch mapping.', 'Not a recognized-revenue or organization ledger.'], ['Pharmacy & inventory services', 'Capability and report-read access not verified.', 'Current source query not performed; not a zero result.']].map(([title, line, note]) => <div key={title}><p className="text-[13px] font-semibold">{title}</p><p className="mt-1 leading-5">{line}</p><p className="mt-1 text-outline">{note}</p></div>)}</div>
      </Section>
    </ReportsFrame>
  )
}
