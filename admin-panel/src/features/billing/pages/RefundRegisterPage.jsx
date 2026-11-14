import { Download, Plus } from 'lucide-react'
import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { exportCsv } from '../../../lib/exportCsv'
import { usePatientRecords } from '../../patients/context/usePatientRecords'
import { formatDate } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, FilterField, GovernanceFooter, MetricStrip, TextLink } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { DATE_RANGES } from '../constants'
import { useBilling } from '../context/useBilling'
import { REFUND_STATUSES, refundSummary } from '../financeLogic'
import { refundContext, refundParty } from '../refundData'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'

const TONE = { Pending: 'warning', Approved: 'brand', Processed: 'success', Failed: 'danger', Rejected: 'neutral' }
const byNewest = (a, b) => `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`)

export default function RefundRegisterPage() {
  const { records, getPatient } = usePatientRecords()
  const { refundRequests } = useBilling()
  const filters = useRegisterFilters({ range: DATE_RANGES[0].id })
  const range = DATE_RANGES.find((entry) => entry.id === filters.get('range')) ?? DATE_RANGES[0]
  const { refunds } = refundContext(records, refundRequests)
  const inRange = refunds.filter((refund) => refund.date >= range.from && refund.date <= range.to)
  const summary = refundSummary(inRange)
  const query = filters.get('q').trim().toLowerCase()
  const rows = inRange
    .filter((refund) => !filters.get('status') || refund.status === filters.get('status'))
    .filter((refund) => !query || `${refund.id} ${refundParty(refund, getPatient).name} ${refund.paymentId}`.toLowerCase().includes(query))
    .sort(byNewest)
  const failed = inRange.find((refund) => refund.status === 'Failed')
  const state = { search: filters.search }
  const detail = (refund) => pathFor(ROUTES.billingRefund, { refundId: refund.id })

  const exportRegister = () => exportCsv('refund-register.csv', [['Refund ID', 'Date', 'Patient', 'Payer', 'Original payment', 'Amount (INR)', 'Reason', 'Status'], ...rows.map((refund) => { const party = refundParty(refund, getPatient); return [refund.id, refund.date, party.name, party.payer, refund.paymentId, refund.amount, refund.reason, refund.status] })])

  return (
    <BillingFrame back={{ to: ROUTES.billing, label: 'Billing & Finance' }} crumb="Billing & Finance / Refunds" code="BF-15 / Aura Health · Billing & Finance" title="Refund Register" description="Track refund requests, approvals and gateway outcomes. Each refund stays linked to its original payment." actions={<ActionButton variant="brand" icon={Plus} to={ROUTES.billingRefundNew} state={state}>Create Refund</ActionButton>} scope={false}>
      <div className="mb-6 grid items-end gap-4 sm:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_1fr]">
        <FilterField label="Date range · Refund created" value={range.id} onChange={(value) => filters.change('range', value, DATE_RANGES[0].id)} options={DATE_RANGES.map((entry) => [entry.id, entry.label])} />
        <FilterField label="Organization / branch" value="" disabled options={[['', 'Aura Health · All locations (3)']]} />
        <FilterField label="Refund status" value={filters.get('status')} onChange={(value) => filters.change('status', value)} options={[['', 'All statuses'], ...REFUND_STATUSES]} />
        <p className="text-right text-[11px] text-outline">Currency: INR (₹) · Time: IST<br />Finance Manager · Create & review enabled</p>
      </div>

      <MetricStrip items={[
        { label: 'Processed refunds', value: money(summary.Processed.amount), hint: `${summary.Processed.count} refunds · Confirmed returned` },
        { label: 'Awaiting review', value: money(summary.Pending.amount), hint: `${summary.Pending.count} pending request${summary.Pending.count === 1 ? '' : 's'}` },
        { label: 'Approved · not processed', value: money(summary.Approved.amount), hint: `${summary.Approved.count} refund · Awaiting gateway` },
        { label: 'Failed refunds', value: money(summary.Failed.amount), hint: `${summary.Failed.count} failure · Money not returned` },
      ]} />

      <section className="mb-6 rounded-md border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-3 p-5">
          <SearchBox value={filters.get('q')} onChange={(value) => filters.change('q', value)} label="Search refunds" placeholder="Search refund ID, patient, payer or payment" className="min-w-72 flex-1 sm:max-w-md" />
          <span className="text-xs text-outline">{rows.length} refund{rows.length === 1 ? '' : 's'} · Newest first</span>
          <ActionButton icon={Download} onClick={exportRegister} className="ml-auto" disabled={rows.length === 0}>Export register</ActionButton>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Refund ID', 'Date', 'Patient / payer', 'Original payment', 'Amount (INR)', 'Reason', 'Status', 'Action'].map((heading) => <th key={heading} scope="col" className="px-5 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {rows.map((refund) => {
                const party = refundParty(refund, getPatient)
                return (
                  <tr key={refund.id} className="border-t border-slate-100 align-middle hover:bg-surface-lowest">
                    <td className="px-5 py-4"><TextLink to={detail(refund)} state={state}>{refund.id} ↗</TextLink></td>
                    <td className="px-5 py-4">{formatDate(refund.date)}</td>
                    <td className="px-5 py-4"><strong className="font-medium">{party.name}</strong><br /><span className="text-outline">{[party.mrn, party.payer].filter(Boolean).join(' · ')}</span></td>
                    <td className="px-5 py-4"><TextLink to={pathFor(ROUTES.billingPayment, { paymentId: refund.paymentId })} className="font-medium">{refund.paymentId} ↗</TextLink></td>
                    <td className="px-5 py-4 text-sm font-semibold">{money(refund.amount)}</td>
                    <td className="px-5 py-4">{refund.reason}</td>
                    <td className="px-5 py-4"><StatusPill tone={TONE[refund.status]}>{refund.status}</StatusPill></td>
                    <td className="px-5 py-4"><TextLink to={detail(refund)} state={state}>{refund.status === 'Pending' ? 'Review →' : 'Details →'}</TextLink></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-on-surface-variant">No refunds match these filters.</p>}
        </div>
        <p className="flex flex-wrap justify-between gap-2 border-t border-slate-200 px-5 py-4 text-xs text-outline"><span>Showing {rows.length} of {inRange.length} · Rejected: {money(summary.Rejected.amount)} (excluded from refund totals)</span><span>Page 1 of 1</span></p>
      </section>

      {failed && <Banner tone="warning" title="Failed does not mean refunded" className="mb-6">{failed.id}: {failed.note ?? 'The refund failed.'} Open details to verify gateway status before an authorized retry.</Banner>}
      <GovernanceFooter code="BF-15">Refund ≠ payment ≠ receipt ≠ allocation. Processed refunds are read-only; corrections require a separate authorized, audited record.</GovernanceFooter>
    </BillingFrame>
  )
}
