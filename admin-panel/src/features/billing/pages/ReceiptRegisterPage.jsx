import ActionButton from '../../../components/workspace/ActionButton'
import { SearchBox } from '../../../components/workspace/controls'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { usePatientRecords } from '../../patients/context/usePatientRecords'
import { formatDate, formatTime } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, FilterField, GovernanceFooter, Scope, Section, TextLink } from '../../../components/workspace/RecordKit'
import { money, SCOPE_TEXT } from '../financeFormat'
import { receiptRows } from '../financeLogic'
import { useRegisterFilters } from '../../../hooks/useRegisterFilters'

const VERIFICATION = [['', 'All verification states'], ['conflict', 'Amount requires verification'], ['verified', 'Source verified']]

export default function ReceiptRegisterPage() {
  const { records, getPatient } = usePatientRecords()
  const filters = useRegisterFilters()
  const nameOf = (id) => getPatient(id)?.name ?? 'Unknown patient'
  const query = filters.get('q')
  const rows = receiptRows(records, { query, status: filters.get('verification'), patientName: nameOf })
  const conflicts = rows.filter((row) => row.conflict)
  const unreceipted = records.payments.filter((payment) => !payment.receiptId)
  const state = { search: filters.search }

  return (
    <BillingFrame back={{ to: ROUTES.billing, label: 'Billing & Finance' }} crumb="Billing & Finance / Receipts" code="BF-14 / Payments & receipts" title="Receipt Register" description="Find receipt records and check source verification before printing or downloading official output." actions={<ActionButton to={ROUTES.billingPayments}>Payment Register ↗</ActionButton>} scope={false}>
      <Scope left={`${SCOPE_TEXT} / 01 Sep–21 Oct 2026 · All models`} />

      <Section title="Find receipts" aside="Date filters apply to verified receipt issue dates; unverified issue dates are included and flagged." className="mb-6">
        <SearchBox value={query} onChange={(value) => filters.change('q', value)} label="Search receipts" placeholder="Search receipt number, patient / payer or payment reference" className="mb-4" />
        <div className="grid gap-4 sm:grid-cols-2">
          <FilterField label="Source verification" value={filters.get('verification')} onChange={(value) => filters.change('verification', value)} options={VERIFICATION} />
          <div className="flex items-end"><ActionButton onClick={filters.reset} className="w-full">Reset filters</ActionButton></div>
        </div>
      </Section>

      {conflicts.length > 0 && <Banner tone="warning" title="Amount requires verification" className="mb-6">{conflicts.map((row) => row.receiptId).join(', ')} {conflicts.length === 1 ? 'has' : 'have'} conflicting source amounts. The receipt amount is shown as “—”; official Print and Download are disabled. This source warning is not an issued, void or bank reconciliation status.</Banner>}

      <Section title="Receipts" aside={<StatusPill>Source slice only</StatusPill>} className="mb-6">
        <p className="-mt-3 mb-4 text-xs text-outline">{rows.length} authoritative receipt{rows.length === 1 ? '' : 's'} in this source slice · Not an organization-wide receipt count</p>
        <div className="-mx-6 overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="bg-surface-low text-[10px] font-semibold tracking-wide text-on-surface-variant uppercase"><tr>{['Receipt number', 'Date', 'Patient / payer', 'Payment reference', 'Amount (INR)', 'Status / verification', 'Actions'].map((heading) => <th key={heading} scope="col" className="px-6 py-3">{heading}</th>)}</tr></thead>
            <tbody>
              {rows.map(({ payment, receiptId, name, conflict }) => (
                <tr key={receiptId} className="border-t border-slate-100 align-top hover:bg-surface-lowest">
                  <td className="px-6 py-4"><TextLink to={pathFor(ROUTES.billingReceipt, { receiptId })} state={state}>{receiptId} ↗</TextLink><br /><span className="text-outline">Aura Health</span></td>
                  <td className="px-6 py-4">{conflict ? <strong>Issued: Not verified</strong> : <strong>Issued {formatDate(payment.date)}</strong>}<br /><span className="text-outline">Payment: {formatDate(payment.date)}<br />{formatTime(payment.time)} IST</span></td>
                  <td className="px-6 py-4"><strong>{name}</strong><br /><span className="text-outline">{getPatient(payment.patientId)?.mrn}<br />{payment.desk}</span></td>
                  <td className="px-6 py-4"><TextLink to={pathFor(ROUTES.billingPayment, { paymentId: payment.id })} state={state}>{payment.id} ↗</TextLink><br /><span className="text-outline">{payment.instrument.replace(/\s*\(.*\)$/, '')} · {payment.reference}</span></td>
                  <td className="px-6 py-4 text-sm font-semibold">{conflict ? <>—<br /><span className="text-[11px] font-normal text-outline">Not verified</span></> : money(payment.amount)}</td>
                  <td className="px-6 py-4"><strong>Official status: {conflict ? 'Unknown' : 'Issued'}</strong><br /><StatusPill tone={conflict ? 'warning' : 'success'} className="my-1">{conflict ? 'Amount requires verification' : 'Source verified'}</StatusPill><br /><span className="text-outline">Source verification status</span></td>
                  <td className="px-6 py-4"><TextLink to={pathFor(ROUTES.billingReceipt, { receiptId })} state={state}>Open Receipt Details →</TextLink><div className="mt-2 flex gap-2"><ActionButton size="sm" disabled={conflict}>Print</ActionButton><ActionButton size="sm" disabled={conflict}>Download</ActionButton></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <p className="px-6 py-10 text-center text-sm text-on-surface-variant">No receipts match these filters.</p>}
        </div>
        <p className="mt-3 flex justify-between text-xs text-outline"><span>Showing {rows.length} of {rows.length} available receipts · Unverified issue date included</span><span>Page 1 of 1</span></p>
      </Section>

      <div className="mb-6 grid gap-5 lg:grid-cols-2">
        <Section title="No receipt inferred from payment">
          <p className="text-xs leading-6 text-on-surface-variant">{unreceipted.length ? `${unreceipted.map((payment) => payment.id).join(', ')} ${unreceipted.length === 1 ? 'has' : 'have'} no recorded receipt number. ` : ''}A payment does not create an additional row here, even when its linked invoice is paid in full.</p>
          <TextLink to={ROUTES.billingPayments} className="mt-3 inline-block text-xs">Review payments →</TextLink>
        </Section>
        <Section title="Safe record navigation">
          <p className="text-xs leading-6 text-on-surface-variant">Open the receipt to inspect its non-issuable preview and linked payment. Back returns to this register with branch, date, search and verification filters preserved.</p>
          <p className="mt-3 text-[11px] text-outline">“—” means unavailable, not zero. No receipt total is calculated.</p>
        </Section>
      </div>
      <GovernanceFooter code="BF-14">Payment ≠ Allocation ≠ Receipt. Source verification must precede official receipt output; finalized history is not silently changed.</GovernanceFooter>
    </BillingFrame>
  )
}
