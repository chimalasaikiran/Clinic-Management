import { Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { useBilling } from '../context/useBilling'
import { formatDate, formatINR, formatTime } from '../../patients/format'
import BillingFrame, { Card, Note } from '../components/BillingFrame'
import { DATE_RANGES } from '../constants'
import { invoiceRows, isOverdue } from '../registerLogic'

const STATUSES = ['Issued', 'Partially Paid', 'Paid in Full']
const TONE = { 'Partially Paid': 'warning', 'Paid in Full': 'success', Issued: 'info' }

// Search, status and date range live in the address, so opening an invoice and coming back keeps the register as it was.
export default function InvoiceRegisterPage() {
  const { records, getPatient } = useBilling()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const rangeId = params.get('range') ?? DATE_RANGES[0].id
  const openOnly = params.get('balance') === 'open'
  const range = DATE_RANGES.find((entry) => entry.id === rangeId) ?? DATE_RANGES[0]

  const change = (key, value, fallback = '') => {
    const next = new URLSearchParams(params)
    if (value && value !== fallback) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const nameOf = (id) => getPatient(id)?.name ?? 'Unknown patient'
  const all = invoiceRows(records, range, { patientName: nameOf })
  const rows = invoiceRows(records, range, { query, status, patientName: nameOf }).filter((row) => !openOnly || row.balance > 0)
  const total = (key) => all.reduce((sum, row) => sum + row[key], 0)
  const overdue = all.filter((row) => isOverdue(row.invoice, records.payments))
  const search = params.toString() ? `?${params.toString()}` : ''

  return (
    <BillingFrame back={{ to: ROUTES.billing, label: 'Billing & Finance' }} crumb="Billing & Finance / Invoices" code="BF-06 / Billing & Finance" title="Invoice Register" description="Find invoices and review balances without changing settled history." actions={<ActionButton variant="primary" icon={Plus} to={ROUTES.billingInvoiceNew}>Create Invoice</ActionButton>} scope={false}>
      <div className="mb-3 grid gap-4 sm:grid-cols-3">
        <label className="text-xs text-outline">Date range<select aria-label="Date range" value={rangeId} onChange={(event) => change('range', event.target.value, DATE_RANGES[0].id)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-brand">{DATE_RANGES.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}</option>)}</select></label>
        <label className="text-xs text-outline">Status<select aria-label="Status" value={status} onChange={(event) => change('status', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-brand"><option value="">All statuses</option>{STATUSES.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
        <label className="text-xs text-outline">Balance<select aria-label="Balance" value={openOnly ? 'open' : ''} onChange={(event) => change('balance', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-brand"><option value="">All invoices</option><option value="open">With a balance due</option></select></label>
      </div>
      <p className="mb-5 flex justify-between text-[11px] text-outline"><span>{openOnly ? 'Showing invoices with a balance due. Open one and choose Record Payment.' : 'Invoices are filtered by their issue date.'}</span><span>Currency: INR (₹) · Time: IST</span></p>

      <dl className="mb-5 grid gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-4">
        {[['Invoiced amount', formatINR(total('total'))], ['Paid / settled amount', formatINR(total('paid'))], ['Outstanding balance', formatINR(total('balance'))], ['Overdue invoices', String(overdue.length)]].map(([label, value]) => <div key={label} className="bg-white p-5"><dt className="text-xs font-semibold">{label}</dt><dd className="mt-1 text-2xl font-semibold">{value}</dd><p className="text-[11px] text-outline">{all.length} invoices in range</p></div>)}
      </dl>

      <Card title="Invoices" aside={`${rows.length} record${rows.length === 1 ? '' : 's'} · newest first`} className="mb-5">
        <div className="mb-4 flex flex-wrap items-center gap-2"><SearchBox value={query} onChange={(value) => change('q', value)} label="Search invoices" placeholder="Search invoice, patient or payer…" className="min-w-72 flex-1" /><ActionButton onClick={() => setParams({}, { replace: true })}>Reset filters</ActionButton></div>
        <div className="-mx-6 overflow-x-auto"><table className="w-full min-w-[960px] text-left text-xs">
          <thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Invoice', 'Date / IST', 'Patient / payer', 'Branch', 'Total', 'Paid amount', 'Balance due', 'Due date', 'Status'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
          <tbody>
            {rows.map(({ invoice, status: label, total: amount, paid, balance, name }) => (
              <tr key={invoice.id} className="border-t border-slate-100 align-top hover:bg-surface-lowest">
                <td className="px-6 py-3"><Link to={pathFor(ROUTES.billingInvoice, { invoiceId: invoice.id })} state={{ search }} className="font-semibold text-brand hover:underline">{invoice.id} ↗</Link><br /><span className="text-outline">View invoice details</span><br /><span className="text-on-surface-variant">{invoice.title}</span></td>
                <td className="px-6 py-3">{formatDate(invoice.date)}<br /><span className="text-outline">{formatTime(invoice.time)} IST</span></td>
                <td className="px-6 py-3"><strong>{name}</strong><br /><span className="text-outline">{getPatient(invoice.patientId)?.mrn} · {invoice.payer ?? 'Payer not recorded'}</span></td>
                <td className="px-6 py-3">{invoice.branch ?? invoice.location}</td>
                <td className="px-6 py-3 text-right font-semibold">{formatINR(amount)}</td>
                <td className="px-6 py-3 text-right font-semibold">{formatINR(paid)}</td>
                <td className="px-6 py-3 text-right font-semibold">{formatINR(balance)}</td>
                <td className="px-6 py-3">{invoice.dueDate ? <>{formatDate(invoice.dueDate)}{isOverdue(invoice, records.payments) && <><br /><span className="font-semibold text-danger">Overdue</span></>}</> : '—'}</td>
                <td className="px-6 py-3"><StatusPill tone={TONE[label]}>{label}</StatusPill></td>
              </tr>
            ))}
          </tbody>
        </table>{rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">No invoices match these filters.</p>}</div>
        <p className="mt-3 text-[11px] text-outline">Showing {rows.length} of {all.length} invoices in range.</p>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Note title="Create or inspect an invoice">Create Invoice → select a patient and eligible charges → review → issue. Issued invoices are read-only; corrections use authorized, separate records.</Note>
        <Note title="Balances follow allocations">An invoice balance is its total less the payment amounts allocated to it. A payment that is not allocated does not reduce any invoice until it is applied.</Note>
      </div>
    </BillingFrame>
  )
}
