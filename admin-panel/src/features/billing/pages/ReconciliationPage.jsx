import { CheckCircle2, Download, RefreshCw, Upload } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { formatDate } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, FilterField, GovernanceFooter, MetricStrip, TextLink } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { DATE_RANGES } from '../constants'
import { useBilling } from '../context/useBilling'
import { RECON_SOURCES } from '../data/financeSeed'
import { reconRows, reconSummary } from '../financeLogic'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'

const TONE = { Matched: 'success', Exception: 'warning', Candidate: 'warning', Resolved: 'brand' }
const signed = (value) => (value === 0 ? '₹0' : `${value > 0 ? '+' : '−'} ${money(Math.abs(value))}`)

export default function ReconciliationPage() {
  const { exceptions } = useBilling()
  const filters = useRegisterFilters({ range: DATE_RANGES[0].id })
  const range = DATE_RANGES.find((entry) => entry.id === filters.get('range')) ?? DATE_RANGES[0]
  const rows = reconRows(exceptions, { source: filters.get('source'), state: filters.get('match'), range })
  const summary = reconSummary(rows)
  const state = { search: filters.search }

  const exportComparison = () => exportCsv('reconciliation.csv', [['Source', 'Reference', 'Date', 'Source amount (INR)', 'ClinicOS payment', 'ClinicOS amount (INR)', 'Difference (INR)', 'Status'], ...rows.map(({ line, clinicos, difference, state: status }) => [line.source, line.reference, line.date, line.amount, line.paymentId ?? '', clinicos ?? '', difference, status])])

  return (
    <BillingFrame back={{ to: ROUTES.billing, label: 'Billing & Finance' }} crumb="Billing & Finance / Reconciliation" code="BF-17 / Aura Health · Billing & Finance" title="Payment Reconciliation" description="Compare configured gateway and bank transactions with ClinicOS payments. Resolve exceptions without rewriting source records." actions={<><ActionButton icon={Upload} disabled title="Available once a bank or gateway source is connected">Import statement</ActionButton><ActionButton variant="brand" icon={RefreshCw} disabled title="Available once a bank or gateway source is connected">Sync sources</ActionButton></>} scope={false}>
      <div className="mb-5 grid items-end gap-4 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1fr]">
        <FilterField label="Transaction date range" value={range.id} onChange={(value) => filters.change('range', value, DATE_RANGES[0].id)} options={DATE_RANGES.map((entry) => [entry.id, entry.label])} />
        <FilterField label="Source" value={filters.get('source')} onChange={(value) => filters.change('source', value)} options={[['', `All configured sources (${RECON_SOURCES.length - 1})`], ...RECON_SOURCES]} />
        <FilterField label="Match status" value={filters.get('match')} onChange={(value) => filters.change('match', value)} options={[['', 'All · Matched & unmatched'], ['Matched', 'Matched'], ['Unmatched', 'Unmatched']]} />
        <p className="text-right text-[11px] text-outline">Aura Health · All locations (3) · INR / IST<br />Finance Manager · Reconcile & resolve enabled</p>
      </div>

      <p className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-md border border-slate-200 bg-white px-4 py-3 text-xs"><CheckCircle2 className="size-4 text-brand" aria-hidden="true" /><span>Razorpay · Synced 21 Oct, 10:35 IST</span><span>HDFC · Statement imported 10:30 IST</span><span className="text-outline">Batch REC-BATCH-026 · {rows.length} transactions · No sync in progress</span></p>

      <MetricStrip items={[
        { label: 'Source transactions', value: money(summary.source), hint: `${rows.length} imported transactions · Selected scope` },
        { label: 'ClinicOS comparison total', value: money(summary.clinicos), hint: `${summary.linked} linked / candidate payments` },
        { label: 'Net difference', value: signed(summary.net), hint: 'Source − ClinicOS · Missing record treated as ₹0' },
        { label: 'Matched / unmatched', value: `${summary.matched} / ${summary.unmatched}`, hint: `${money(summary.matchedAmount)} matched · ${summary.exceptions} exceptions, ${summary.candidates} candidate` },
      ]} />

      <section className="mb-6 rounded-md border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 p-5"><h2 className="text-[17px] font-semibold">Transaction comparison <span className="ml-3 text-xs font-normal text-outline">{rows.length} records · Gross payment basis · Not a settlement ledger</span></h2><ActionButton icon={Download} onClick={exportComparison} disabled={rows.length === 0}>Export comparison</ActionButton></header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Source / reference', 'Date', 'Source (INR)', 'ClinicOS record', 'ClinicOS (INR)', 'Difference', 'Status / reason', 'Action'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ line, payment, clinicos, difference, state: status, exception }) => (
                <tr key={line.id} className={`border-t border-slate-100 align-middle ${status === 'Matched' ? '' : 'bg-surface-lowest'}`}>
                  <td className="px-5 py-4"><strong>{line.source}</strong><br /><span className="text-outline">{line.reference}</span></td>
                  <td className="px-5 py-4">{formatDate(line.date)}</td>
                  <td className="px-5 py-4 text-sm font-semibold">{money(line.amount)}</td>
                  <td className="px-5 py-4">{line.paymentId ? <><TextLink to={pathFor(ROUTES.billingPayment, { paymentId: line.paymentId })} state={state}>{line.paymentId}</TextLink><br /><span className="text-outline">{payment.who}{status === 'Candidate' && ' · Suggested'}</span></> : <><strong>No linked record</strong><br /><span className="text-outline">Payer not identified</span></>}</td>
                  <td className="px-5 py-4">{money(clinicos)}</td>
                  <td className={`px-5 py-4 font-semibold ${difference ? 'text-danger' : 'text-outline'}`}>{signed(difference)}</td>
                  <td className="px-5 py-4"><StatusPill tone={TONE[status]}>{status === 'Candidate' ? 'Unmatched' : status}</StatusPill><br /><span className="text-[11px] text-outline">{status === 'Resolved' ? 'Exception resolved' : line.note}</span></td>
                  <td className="px-5 py-4">{exception ? <TextLink to={pathFor(ROUTES.billingException, { exceptionId: exception.id })} state={state}>{exception.id} →</TextLink> : <TextLink to={line.paymentId ? pathFor(ROUTES.billingPayment, { paymentId: line.paymentId }) : ROUTES.billingPayments} state={state}>{status === 'Candidate' ? 'Match →' : 'View match →'}</TextLink>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-on-surface-variant">No transactions match these filters.</p>}
        </div>
        <p className="flex flex-wrap justify-between gap-2 border-t border-slate-200 px-5 py-4 text-xs text-outline"><span>Showing {rows.length} of {rows.length} · Match status is separate from payment settlement status.</span><span>Page 1 of 1</span></p>
      </section>

      <Banner tone="neutral" title="Review before matching or reconciling" className="mb-6">“Match” opens a comparison and confirmation; it does not apply silently. Amount differences require evidence and a resolution note. Resolving an exception creates an audit entry, not a payment, receipt or adjustment.</Banner>
      <GovernanceFooter code="BF-17">Source comparisons are read-only. Matching and resolution require explicit confirmation and preserve actor, timestamp, evidence and prior status in audit history.</GovernanceFooter>
    </BillingFrame>
  )
}
