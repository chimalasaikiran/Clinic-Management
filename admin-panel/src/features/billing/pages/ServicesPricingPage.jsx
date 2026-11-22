import { Plus } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { formatINR } from '../../patients/format'
import BillingFrame, { Note } from '../components/BillingFrame'
import { SERVICE_CATEGORIES, SERVICE_PAGE_SIZE, TAX_TREATMENTS } from '../constants'
import { useBilling } from '../context/useBilling'
import { branchSummary } from '../serviceLogic'

// Filters and page live in the address, so opening a service and coming back restores the catalogue as it was.
export default function ServicesPricingPage() {
  const { services, branches } = useBilling()
  const saved = useLocation().state?.saved
  const [params, setParams] = useSearchParams()
  const get = (key) => params.get(key) ?? ''
  const page = Number(params.get('page')) || 1
  const change = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const needle = get('q').trim().toLowerCase()
  const rows = services.filter((service) => (!needle || `${service.name} ${service.code}`.toLowerCase().includes(needle)) && (!get('category') || service.category === get('category')) && (!get('department') || service.department === get('department')) && (!get('branch') || service.branches[get('branch')]) && (!get('status') || service.status === get('status')) && (!get('tax') || service.tax === get('tax')))
  const pages = Math.max(1, Math.ceil(rows.length / SERVICE_PAGE_SIZE))
  const current = Math.min(page, pages)
  const shown = rows.slice((current - 1) * SERVICE_PAGE_SIZE, current * SERVICE_PAGE_SIZE)
  const filtered = [...params.keys()].some((key) => key !== 'page')
  const unconfigured = services.filter((service) => service.tax === 'Not configured').length
  const search = params.toString() ? `?${params.toString()}` : ''
  const select = (key, label, all, options) => <label className="text-xs text-outline">{label}<select aria-label={label} value={get(key)} onChange={(event) => change(key, event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-on-surface outline-none focus:border-brand"><option value="">{all}</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>

  return (
    <BillingFrame back={{ to: ROUTES.billing, label: 'Back to Billing & Finance' }} crumb="Owner Panel / Billing & Finance / Services & Pricing" code={`BF-02 / ${services.length ? 'Service catalog' : 'Empty'}`} title="Services & Pricing" description="Manage reusable service definitions, default prices and optional branch settings. This catalog does not create financial transactions." actions={<ActionButton variant="primary" icon={Plus} to={ROUTES.billingServiceNew}>Add Service</ActionButton>}>
      {saved && <p role="status" className="mb-4 rounded-md border border-teal-200 bg-teal-50/60 px-4 py-2.5 text-xs">Service saved. {saved} is in the catalogue.</p>}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><SearchBox value={get('q')} onChange={(value) => change('q', value)} label="Search services" placeholder="Search by service name or unique code" className="min-w-80 flex-1" /><strong className="text-xs">{rows.length} service{rows.length === 1 ? '' : 's'} · {get('status') || 'all statuses'}</strong></div>
      <div className="mb-2 grid gap-3 sm:grid-cols-5">
        {select('category', 'Category', 'All categories', SERVICE_CATEGORIES.map((entry) => [entry, entry]))}
        {select('department', 'Department / specialty', 'All departments', [...new Set(services.map((service) => service.department).filter(Boolean))].sort().map((entry) => [entry, entry]))}
        {select('branch', 'Branch', `All locations (${branches.length})`, branches.map((entry) => [entry.id, entry.name]))}
        {select('status', 'Status', 'All statuses', [['Active', 'Active'], ['Inactive', 'Inactive']])}
        {select('tax', 'Tax configuration', 'All treatments', TAX_TREATMENTS.map(([, label]) => [label, label]))}
      </div>
      <p className="mb-4 flex justify-between text-[11px] text-outline"><span>Branch filter narrows availability; it does not change the organization context.</span>{filtered && <button type="button" onClick={() => setParams({}, { replace: true })} className="font-semibold text-brand hover:underline">Clear filters</button>}</p>

      {unconfigured > 0 && <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs"><strong className="text-[13px]">Configuration needs review</strong><p className="text-on-surface-variant">{unconfigured} services have no tax treatment configured. “Not configured” is not an exemption — decide before the service is used on future invoices.</p></div>}

      <section className="mb-5 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-xs">
          <thead className="bg-surface-lowest text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Service name', 'Unique code', 'Category', 'Department / specialty', 'Default price', 'Branch availability / price', 'Tax treatment', 'Status', 'Last updated', 'Actions'].map((heading) => <th key={heading} scope="col" className="px-4 py-3">{heading}</th>)}</tr></thead>
          <tbody>
            {shown.map((service) => {
              const [where, how] = branchSummary(service, branches)
              return (
                <tr key={service.id} className="border-t border-slate-100 align-top hover:bg-surface-lowest">
                  <td className="px-4 py-4 text-[13px] font-semibold">{service.name}</td>
                  <td className="px-4 py-4 font-mono">{service.code}</td>
                  <td className="px-4 py-4">{service.category}</td>
                  <td className="px-4 py-4">{service.department || 'Unassigned'}</td>
                  <td className="px-4 py-4 text-right text-sm font-semibold">{formatINR(service.price)}</td>
                  <td className="px-4 py-4"><span className={where === 'Not configured' ? 'text-amber-700' : ''}>{where}</span><br /><span className="text-outline">{how}</span></td>
                  <td className="px-4 py-4">{service.tax === 'Exempt' ? `Exempt · ${service.taxConfig.split(' — ')[0]}` : service.tax}</td>
                  <td className="px-4 py-4"><StatusPill tone={service.status === 'Active' ? 'success' : 'neutral'}>{service.status}</StatusPill></td>
                  <td className="px-4 py-4 text-outline">{service.updated ?? 'Not recorded'}</td>
                  <td className="px-4 py-4 font-semibold text-brand"><Link to={pathFor(ROUTES.billingService, { serviceId: service.id })} state={{ search }} className="block hover:underline">View details</Link><Link to={pathFor(ROUTES.billingServiceEdit, { serviceId: service.id })} className="font-normal hover:underline">Edit</Link></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {shown.length === 0 && (
          <div className="flex flex-col items-center px-6 py-14 text-center"><span className="mb-3 flex size-9 items-center justify-center rounded bg-surface-low text-brand">+</span><h2 className="text-lg font-semibold">{services.length ? 'No services match' : 'No services yet'}</h2><p className="mt-1 max-w-md text-xs text-on-surface-variant">{services.length ? 'Try a different search or clear the filters.' : 'Create your first service definition. Add a required default price, then choose availability and any optional branch overrides.'}</p>{!services.length && <ActionButton variant="primary" icon={Plus} to={ROUTES.billingServiceNew} className="mt-4">Add Service</ActionButton>}</div>
        )}</div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-surface-lowest px-5 py-3 text-xs text-on-surface-variant">
          <span>{rows.length ? `Showing ${(current - 1) * SERVICE_PAGE_SIZE + 1}–${(current - 1) * SERVICE_PAGE_SIZE + shown.length} of ${rows.length} services · ${SERVICE_PAGE_SIZE} per page` : 'No services in this view'}</span>
          <nav aria-label="Pagination" className="flex items-center gap-1.5"><button type="button" disabled={current === 1} onClick={() => change('page', String(current - 1))} className="px-2 disabled:opacity-40">‹ Previous</button>{Array.from({ length: pages }, (_, index) => index + 1).map((number) => <button key={number} type="button" aria-current={number === current ? 'page' : undefined} onClick={() => change('page', number === 1 ? '' : String(number))} className={number === current ? 'font-semibold text-brand' : ''}>{number}</button>)}<button type="button" disabled={current === pages} onClick={() => change('page', String(current + 1))} className="px-2 disabled:opacity-40">Next ›</button></nav>
        </footer>
      </section>
      <Note title="Service definition ≠ Charge ≠ Invoice ≠ Payment ≠ Receipt">Downstream financial records reference the applicable service and price. Catalog price changes apply prospectively and never silently rewrite finalized historical records.</Note>
    </BillingFrame>
  )
}
