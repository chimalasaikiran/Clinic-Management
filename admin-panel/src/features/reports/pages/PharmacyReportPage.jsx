import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FilterField, Section } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import LoadingState from '../../patients/components/LoadingState'
import { formatDate, formatINR } from '../../patients/format'
import ReportsFrame from '../components/ReportsFrame'
import { usePharmacyReport } from '../usePharmacyReport'

const TONE = { 'In stock': 'success', 'Low stock': 'neutral', 'Near expiry': 'warning', 'Out of stock': 'danger' }
const SEGMENT = { 'In stock': 'bg-brand', 'Low stock': 'bg-slate-400', 'Near expiry': 'bg-amber-700', 'Out of stock': 'bg-red-700' }
const ACTION = {
  'Out of stock': 'Raise an urgent stock request or a transfer from a location that holds it.',
  'Low stock': 'Below the reorder level · raise a purchase order or stock request.',
  'Near expiry': 'Expires within 30 days · dispense first (FEFO) or transfer before expiry.',
}
const unitPrice = (value) => (Number.isInteger(value) ? `₹${value}` : `₹${value.toFixed(2)}`)

// Stock health, dispensing and receipts over the last 30 days, worked out from the live stock records.
export default function PharmacyReportPage() {
  const [category, setCategory] = useState('')
  const [expiry, setExpiry] = useState('')
  const [query, setQuery] = useState('')
  const { report, today, restricted, loading, error, reload } = usePharmacyReport()
  const frame = { code: 'RPT-04', title: 'Pharmacy & Inventory', back: { to: ROUTES.reports, label: '← Back to Overview · RPT-01' }, query, onQuery: setQuery }

  if (restricted) {
    return <ReportsFrame {...frame} description="Stock and dispensing figures." notes={{ title: 'Inventory records not available to your role', text: 'Your role has no inventory or pharmacy permission, so no stock figures are shown.' }} />
  }
  if (!report) return <ReportsFrame {...frame} description="Stock and dispensing figures."><LoadingState label="Loading stock records…" error={loading ? null : error} onRetry={reload} /></ReportsFrame>

  const needle = query.trim().toLowerCase()
  const items = report.items.filter((item) => (!category || item.category === category) && (!expiry || item.status === expiry) && (!needle || `${item.name} ${item.category} ${item.batch}`.toLowerCase().includes(needle)))
  const categories = [...new Set(report.items.map((item) => item.category))]
  const period = `${formatDate(report.since)} – ${formatDate(today)}`

  return (
    <ReportsFrame
      {...frame}
      description={`Live stock records · all locations · dispensing and receipts over ${period}`}
      period={{ label: `Last 30 days (${period})` }}
      notes={{ title: 'Live stock ledger', text: 'Stock is the available quantity now (posted less reserved, quarantined and expired). Values are at each item’s unit price.' }}
      extraFilters={<>
        <FilterField label="Category" value={category} onChange={setCategory} options={[['', 'All categories'], ...categories]} />
        <FilterField label="Stock expiry" value={expiry} onChange={setExpiry} options={[['', 'All statuses'], 'In stock', 'Low stock', 'Near expiry', 'Out of stock']} />
      </>}
    >
      <dl className="mb-6 grid gap-4 sm:grid-cols-5">{[
        ['Units dispensed', report.dispensed.toLocaleString('en-IN'), 'Mixed base units, last 30 days'],
        ['Dispensed value', formatINR(report.dispensedValue), 'At unit price · not net sales'],
        ['Stock received', formatINR(report.receivedValue), 'Posted receipts at stores, at unit price'],
        ['Near-expiry value', formatINR(report.nearExpiryValue), `${report.nearExpirySkus} SKU${report.nearExpirySkus === 1 ? '' : 's'} expiring within 30 days`],
        ['Out of stock', String(report.stockouts), 'Active items with nothing available'],
      ].map(([label, value, hint]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-5"><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-2 text-2xl font-semibold">{value}</dd><p className="mt-2 text-[11px] text-outline">{hint}</p></div>)}</dl>

      <Section title="Gross margin" aside="" className="mb-6">
        <p className="text-xs text-on-surface-variant">Not calculated. ClinicOS records one unit price per item, not separate purchase and selling prices, so no sales, cost of goods or margin is inferred.</p>
      </Section>

      <Section title="Stock health" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">Mutually exclusive categories · {report.items.length} active SKUs, as of now</p>
        <p className="mb-4 flex flex-wrap gap-4 text-xs">{Object.entries(report.status).map(([status, count]) => <span key={status} className="flex items-center gap-2"><span className={`size-2.5 rounded-sm ${SEGMENT[status]}`} />{status} · {count}</span>)}</p>
        <div className="flex h-3 overflow-hidden rounded-sm bg-slate-100" role="img" aria-label="Stock status distribution">{Object.entries(report.status).map(([status, count]) => <span key={status} className={SEGMENT[status]} style={{ width: `${report.items.length ? (count / report.items.length) * 100 : 0}%` }} />)}</div>
      </Section>

      <Section title="Inventory table" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">{items.length} of {report.items.length} SKUs · all locations</p>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Item', 'Category', 'Available stock', 'Reorder level', 'Next expiring batch', 'Expiry', 'Unit price', 'Status'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
          <tbody>{items.map((item) => <tr key={item.itemId} className="border-t border-slate-100 align-top"><td className="px-5 py-3 font-semibold">{item.name}</td><td className="px-5 py-3 text-outline">{item.category}</td><td className="px-5 py-3">{item.stock.toLocaleString('en-IN')} {item.unit}</td><td className="px-5 py-3">{item.level} {item.unit}</td><td className="px-5 py-3">{item.batch}</td><td className="px-5 py-3">{item.expiry ? formatDate(item.expiry) : '—'}</td><td className="px-5 py-3">{unitPrice(item.buy)}</td><td className="px-5 py-3"><StatusPill tone={TONE[item.status]}>{item.status}</StatusPill></td></tr>)}</tbody></table>
          {items.length === 0 && <p className="px-5 py-8 text-center text-sm text-on-surface-variant">No items match these filters.</p>}</div>
      </Section>

      <Section title="Expiry and stockout exceptions" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">{report.exceptions.length} item{report.exceptions.length === 1 ? '' : 's'} needing action</p>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Item', 'Available', 'Batch', 'Status', 'Action'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
          <tbody>{report.exceptions.map((entry) => <tr key={entry.itemId} className="border-t border-slate-100 align-top"><td className="px-5 py-3 font-semibold">{entry.name}</td><td className="px-5 py-3">{entry.stock} {entry.unit}</td><td className="px-5 py-3">{entry.batch}</td><td className="px-5 py-3"><StatusPill tone={TONE[entry.status]}>{entry.status}</StatusPill></td><td className="px-5 py-3 text-on-surface-variant">{ACTION[entry.status]}</td></tr>)}</tbody></table>
          {report.exceptions.length === 0 && <p className="px-5 py-8 text-center text-sm text-on-surface-variant">Nothing needs action.</p>}</div>
        <Link to={ROUTES.inventory} className="mt-3 inline-block text-xs font-semibold text-brand hover:underline">Open Inventory ↗</Link>
      </Section>

      <Section title="Dispensing by category" aside="" className="mb-6">
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Category', 'Units dispensed', 'Value at unit price'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{report.categories.map((entry) => <tr key={entry.name} className="border-t border-slate-100"><td className="px-6 py-3">{entry.name}</td><td className="px-6 py-3">{entry.units.toLocaleString('en-IN')}</td><td className="px-6 py-3">{formatINR(entry.value)}</td></tr>)}</tbody></table>
          {report.categories.length === 0 && <p className="px-6 py-8 text-center text-sm text-on-surface-variant">Nothing was dispensed in the last 30 days.</p>}</div>
      </Section>
    </ReportsFrame>
  )
}
