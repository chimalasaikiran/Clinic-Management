import { ArrowDownAZ, ChevronRight, Plus } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import { Cell, Row, StatTiles, Table } from '../../../components/workspace/DataTable'
import { InfoNote, SearchBox } from '../../../components/workspace/controls'
import { pathFor, ROUTES } from '../../../config/routes'
import DetailFrame from '../components/DetailFrame'
import { CountChip, ListFooter, Pill } from '../components/shared'
import { REF_CLASS } from '../components/tones'
import { SUPPLIER_CATEGORIES } from '../constants'
import { useStock } from '../context/useStock'
import { supplierIssues } from '../selectors'

// Filters, search and sort live in the URL so they survive opening a supplier and coming back.
export default function SuppliersPage() {
  const { state } = useStock()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const category = params.get('category') ?? ''
  const order = params.get('sort') === 'desc' ? 'desc' : 'asc'

  const change = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const needle = query.trim().toLowerCase()
  const rows = state.suppliers
    .filter((supplier) => (!status || (status === 'Active') === supplier.active) && (!category || supplier.categories.includes(category)) && (!needle || `${supplier.name} ${supplier.code} ${supplier.id} ${supplier.email} ${supplier.phone}`.toLowerCase().includes(needle)))
    .sort((a, b) => a.name.localeCompare(b.name) * (order === 'asc' ? 1 : -1))
  const attention = state.suppliers.filter((supplier) => supplierIssues(state, supplier.id).length)
  const filtered = Boolean(status || category || needle)

  return (
    <DetailFrame
      crumbs={[{ label: 'Inventory', to: ROUTES.inventory }, { label: 'Suppliers' }]}
      title="Suppliers"
      subtitle="Manage shared supplier records, contact information and purchasing relationships."
      actions={<ActionButton variant="brand" icon={Plus} to={ROUTES.supplierNew}>Add Supplier</ActionButton>}
    >
      <StatTiles
        className="mb-5"
        items={[
          { label: 'Total suppliers', value: state.suppliers.length, hint: 'Shared records' },
          { label: 'Active', value: state.suppliers.filter((supplier) => supplier.active).length, hint: 'Available for new orders' },
          { label: 'Inactive', value: state.suppliers.filter((supplier) => !supplier.active).length, hint: 'History retained' },
          { label: 'Needs attention', value: attention.length, hint: 'Receipt reconciliation' },
        ]}
      />

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <h2 className="flex items-center gap-2.5 text-lg font-semibold">Supplier directory <CountChip>{rows.length} results</CountChip></h2>
          <span className="text-[11px] text-outline">Select any row to view supplier details</span>
        </header>
        <div className="flex flex-wrap items-center gap-2 px-5 py-4">
          <SearchBox value={query} onChange={(value) => change('q', value)} label="Search suppliers" placeholder="Search name, code, email or phone" className="min-w-64 flex-1" />
          <select aria-label="Status" value={status} onChange={(event) => change('status', event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-brand">
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <select aria-label="Category" value={category} onChange={(event) => change('category', event.target.value)} className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-brand">
            <option value="">All categories</option>
            {SUPPLIER_CATEGORIES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
          <button type="button" onClick={() => change('sort', order === 'asc' ? 'desc' : '')} className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs font-medium"><ArrowDownAZ className="size-3.5" aria-hidden="true" />Name {order === 'asc' ? 'A–Z' : 'Z–A'}</button>
        </div>
        {filtered && (
          <p className="flex flex-wrap items-center gap-3 px-5 pb-3 text-xs text-on-surface-variant">
            {category && <span className="rounded bg-surface-low px-2 py-1">Category: {category}</span>}
            {status && <span className="rounded bg-surface-low px-2 py-1">Status: {status}</span>}
            <button type="button" onClick={() => setParams({}, { replace: true })} className="font-semibold text-brand hover:underline">Clear filters</button>
            <span>Search, filters and sort are kept when you return.</span>
          </p>
        )}
        <Table headings={['Supplier / Code', 'Contact details', 'Category', 'Status', 'Operational issues', '']} minWidth={860} empty={rows.length ? null : 'No suppliers match the current filters.'}>
          {rows.map((supplier) => {
            const issues = supplierIssues(state, supplier.id)
            return (
              <Row key={supplier.id}>
                <Cell><Link to={pathFor(ROUTES.supplier, { supplierId: supplier.id })} className={REF_CLASS}>{supplier.name}</Link><p className="font-mono text-[11px] text-outline">{supplier.code || 'Not assigned'}</p></Cell>
                <Cell className="text-xs"><p>{supplier.contact ? `${supplier.contact}${supplier.phone ? ` · ${supplier.phone}` : ''}` : 'Contact not provided'}</p><p className="text-outline">{supplier.email || 'Email not provided'}</p></Cell>
                <Cell className="text-xs">{supplier.categories.join(', ') || '—'}</Cell>
                <Cell><Pill tone={supplier.active ? 'success' : 'neutral'}>{supplier.active ? 'Active' : 'Inactive'}</Pill></Cell>
                <Cell className={`text-xs ${issues.length ? 'text-amber-700' : 'text-on-surface-variant'}`}>{issues.length ? `${issues.length} receipt to reconcile` : supplier.active ? 'No open issues recorded' : 'No issue data available'}</Cell>
                <Cell><Link to={pathFor(ROUTES.supplier, { supplierId: supplier.id })} aria-label={`Open ${supplier.name}`} className="text-outline hover:text-brand"><ChevronRight className="size-4" aria-hidden="true" /></Link></Cell>
              </Row>
            )
          })}
        </Table>
        <ListFooter shown={rows.length} total={rows.length} noun="results">{` · ${state.suppliers.length} suppliers overall`}</ListFooter>
      </section>
      <InfoNote className="mt-5">Suppliers are shared with purchasing. Deactivate records with transactions instead of deleting them; historical references remain available.</InfoNote>
    </DetailFrame>
  )
}
