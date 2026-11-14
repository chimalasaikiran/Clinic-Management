import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FilterField, Section } from '../../../components/workspace/RecordKit'
import StatusPill from '../../../components/workspace/StatusPill'
import { ROUTES } from '../../../config/routes'
import { formatINR } from '../../patients/format'
import ReportsFrame from '../components/ReportsFrame'
import { PHARMACY } from '../data/sampleReports'
import { pharmacyFigures } from '../reportsLogic'

const TONE = { 'In stock': 'success', 'Low stock': 'neutral', 'Near expiry': 'warning', 'Out of stock': 'danger', Urgent: 'danger', Resolved: 'success' }
const SEGMENT = { 'In stock': 'bg-brand', 'Low stock': 'bg-slate-400', 'Near expiry': 'bg-amber-700', 'Out of stock': 'bg-red-700' }
const unitPrice = (value) => (Number.isInteger(value) ? `₹${value}` : `₹${value.toFixed(2)}`)

export default function PharmacyReportPage() {
  const [category, setCategory] = useState('')
  const [expiry, setExpiry] = useState('')
  const [query, setQuery] = useState('')
  const figures = pharmacyFigures(PHARMACY)
  const needle = query.trim().toLowerCase()
  const items = PHARMACY.items.filter((item) => (!category || item.category === category) && (!expiry || item.status === expiry) && (!needle || `${item.name} ${item.category} ${item.batch}`.toLowerCase().includes(needle)))
  const categories = [...new Set(PHARMACY.items.map((item) => item.category))]
  const peak = (series) => Math.max(...series.map((point) => point.value))

  return (
    <ReportsFrame code="RPT-04" title="Pharmacy & Inventory" description="Sample data · Modules enabled for this demo · Main Pharmacy at Main Surgical Pavilion · 01–25 Oct 2026" back={{ to: ROUTES.reports, label: '← Back to Overview · RPT-01' }} query={query} onQuery={setQuery} notes={{ title: 'Sample data · Modules enabled for this demo', text: 'This report covers Main Pharmacy at Main Surgical Pavilion. All displayed content is sample data and does not represent live operations.' }} extraFilters={<><FilterField label="Category · all categories included" value={category} onChange={setCategory} options={[['', 'All categories'], ...categories]} /><FilterField label="Stock expiry · all statuses included" value={expiry} onChange={setExpiry} options={[['', 'All expiry statuses'], 'In stock', 'Low stock', 'Near expiry', 'Out of stock']} /></>}>
      <dl className="mb-6 grid gap-4 sm:grid-cols-5">{[['Items dispensed', figures.dispensed.toLocaleString('en-IN'), 'Mixed base units · tablets / ampoules / vials / boxes / bottles'], ['Stockout incidents', String(figures.stockouts), `${figures.openStockouts} open · ${figures.stockouts - figures.openStockouts} resolved in selected period`], ['Near-expiry value', formatINR(figures.nearExpiryValue), `${figures.nearExpirySkus} SKUs · expiry within 30 days`], ['Inventory purchases', formatINR(figures.purchases), 'Accepted posted receipts only'], ['Gross margin', `${figures.margin}%`, `${formatINR(figures.grossProfit)} / ${formatINR(figures.sales)}`]].map(([label, value, hint]) => <div key={label} className="rounded-md border border-slate-200 bg-white p-4"><dt className="text-[13px] font-semibold">{label}</dt><dd className="mt-2 text-[28px] leading-8 font-semibold">{value}</dd><p className="mt-2 text-[11px] leading-4 text-outline">{hint}</p></div>)}</dl>

      <Section title="Gross margin breakdown" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">Explicit cost and sales inputs only · no inferred values from closing stock or period purchases</p>
        <dl className="rounded-md bg-surface-lowest p-5 text-xs">{[['Net sales', formatINR(figures.sales)], ['Posted COGS', formatINR(figures.cogs)], ['Gross profit', formatINR(figures.grossProfit)], ['Gross margin', `${figures.margin}%`]].map(([label, value]) => <div key={label} className="flex justify-between py-1.5"><dt>{label}</dt><dd className="font-semibold">{value}</dd></div>)}<p className="mt-2 text-outline">Margin = Gross profit / Net sales = {formatINR(figures.grossProfit)} / {formatINR(figures.sales)}</p></dl>
      </Section>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {[['Dispensing trend', 'Mixed base units · bars share a 0–400 unit scale', PHARMACY.dispensing, (value) => String(value), 400], ['Purchase trend', 'Posted receipts · bars share a ₹0–₹6,000 scale', PHARMACY.purchases, formatINR, 6000]].map(([title, hint, series, format, scale]) => (
          <Section key={title} title={title} aside=""><p className="-mt-3 mb-4 text-xs text-outline">{hint}</p>
            <ul className="grid grid-cols-4 gap-3 text-[11px]">{series.map((point) => <li key={point.label}><p className="text-outline">{point.label}</p><span className="my-1.5 block h-1.5 rounded-sm bg-slate-100"><span className="block h-full rounded-sm bg-brand" style={{ width: `${(point.value / Math.max(scale, peak(series))) * 100}%` }} /></span><strong className="text-[13px]">{format(point.value)}</strong></li>)}</ul></Section>))}
      </div>

      <Section title="Stock health" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">Mutually exclusive categories · snapshot as of 25 Oct 2026 18:00 IST</p>
        <p className="mb-4 flex flex-wrap gap-4 text-xs">{Object.entries(figures.status).map(([status, count]) => <span key={status} className="flex items-center gap-2"><span className={`size-2.5 rounded-sm ${SEGMENT[status]}`} />{status} · {count}</span>)}</p>
        <div className="flex h-3 overflow-hidden rounded-sm bg-slate-100" role="img" aria-label="Stock status distribution">{Object.entries(figures.status).map(([status, count]) => <span key={status} className={SEGMENT[status]} style={{ width: `${(count / PHARMACY.items.length) * 100}%` }} />)}</div>
      </Section>

      <Section title="Inventory table" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">{items.length} of {PHARMACY.items.length} SKUs · Main Pharmacy at Main Surgical Pavilion · snapshot 25 Oct 2026 18:00 IST</p>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[960px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Item', 'Category', 'Current stock', 'Reorder', 'Expiring batch', 'Date', 'Purchase value', 'Selling value', 'Status'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
          <tbody>{items.map((item) => <tr key={item.name} className="border-t border-slate-100 align-top"><td className="px-5 py-3 font-semibold">{item.name}</td><td className="px-5 py-3 text-outline">{item.category}</td><td className="px-5 py-3">{item.stock} {item.unit}</td><td className="px-5 py-3">{item.reorder} {item.unit}</td><td className="px-5 py-3">{item.batch}</td><td className="px-5 py-3">{new Date(`${item.expiry}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td className="px-5 py-3">{unitPrice(item.buy)}/unit</td><td className="px-5 py-3">{unitPrice(item.sell)}/unit</td><td className="px-5 py-3"><StatusPill tone={TONE[item.status]}>{item.status}</StatusPill></td></tr>)}</tbody></table>
          {items.length === 0 && <p className="px-5 py-8 text-center text-sm text-on-surface-variant">No items match these filters.</p>}</div>
      </Section>

      <Section title="Expiry and stockout exceptions" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">{PHARMACY.exceptions.filter((entry) => entry.urgency === 'Near expiry').length} expiry rows · {figures.stockouts} stockout rows · Main Pharmacy at Main Surgical Pavilion</p>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[860px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Item', 'Branch', 'Quantity', 'Batch', 'Date', 'Urgency', 'Recommended actions'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
          <tbody>{PHARMACY.exceptions.map((entry) => <tr key={entry.item} className="border-t border-slate-100 align-top"><td className="px-5 py-3 font-semibold">{entry.item}</td><td className="px-5 py-3 text-outline">{entry.branch}</td><td className="px-5 py-3">{entry.quantity}</td><td className="px-5 py-3">{entry.batch}</td><td className="px-5 py-3">{entry.date}</td><td className="px-5 py-3"><StatusPill tone={TONE[entry.urgency]}>{entry.urgency}</StatusPill></td><td className="px-5 py-3 text-on-surface-variant">{entry.action}</td></tr>)}</tbody></table></div>
      </Section>

      <Section title="Category purchase summary" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">Accepted posted receipts only · 01–25 Oct 2026</p>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Category', 'Net sales', 'COGS', 'Purchase value'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>{PHARMACY.categories.map((entry) => <tr key={entry.name} className="border-t border-slate-100"><td className="px-6 py-3">{entry.name}</td><td className="px-6 py-3">{formatINR(entry.sales)}</td><td className="px-6 py-3">{formatINR(entry.cogs)}</td><td className="px-6 py-3">{formatINR(entry.purchases)}</td></tr>)}<tr className="border-t border-slate-200 font-semibold"><td className="px-6 py-3">Total</td><td className="px-6 py-3">{formatINR(figures.sales)}</td><td className="px-6 py-3">{formatINR(figures.cogs)}</td><td className="px-6 py-3">{formatINR(figures.categoryPurchases)}</td></tr></tbody></table></div>
      </Section>

      <Section title="Drilldowns" aside="" className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">Existing destinations · retain branch, date, category and item filters</p>
        <div className="grid gap-4 sm:grid-cols-4">{[['View Dispensing', 'Open Pharmacy workspace', ROUTES.pharmacy], ['Open Inventory', 'Open Inventory workspace', ROUTES.inventory], ['Expiry register', 'Open stock expiry details', ROUTES.inventory], ['Purchase Orders', 'Open Purchase Orders', ROUTES.inventoryOrders]].map(([title, text, to]) => <Link key={title} to={to} className="rounded-md border border-slate-200 bg-surface-lowest p-4 text-xs hover:border-brand"><strong className="block text-[13px] text-brand">{title}</strong><span className="mt-1 block text-outline">{text} ↗</span></Link>)}</div>
      </Section>

      <Section title="Definitions and source coverage" aside="Sample dataset · snapshot 25 Oct 2026 18:00 IST" className="mb-6">
        <ul className="list-disc space-y-2 pl-5 text-xs leading-5 text-on-surface-variant"><li>Near expiry: expiry within 30 days from 25 Oct 2026 (25 Oct → 24 Nov inclusive).</li><li>Stockout incidents: distinct SKU-store episodes in the selected period, not current stockout counts.</li><li>Base dispensing units: tablets / ampoules / vials / boxes / bottles; not prescriptions or patients.</li><li>Current stock: posted net reservations / quarantine; excludes unposted receipts and in-transit.</li><li>Period purchases: accepted posted receipts only; excludes PO commitments and unposted GRNs.</li><li>Gross margin: explicit cost and sales inputs only; no inferred values from closing stock or period purchases.</li></ul>
      </Section>
    </ReportsFrame>
  )
}
