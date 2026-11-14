import { Download, Printer } from 'lucide-react'
import { useLocation, useParams } from 'react-router-dom'
import ActionButton from '../../../components/workspace/ActionButton'
import StatusPill from '../../../components/workspace/StatusPill'
import { pathFor, ROUTES } from '../../../config/routes'
import { allocatedFromPayment } from '../../patients/billing'
import { usePatientRecords } from '../../patients/context/usePatientRecords'
import { formatDate, formatTime } from '../../patients/format'
import BillingFrame from '../components/BillingFrame'
import { Banner, GovernanceFooter, KeyValue, Scope, Section, TextLink } from '../../../components/workspace/RecordKit'
import { money } from '../financeFormat'
import { RECEIPT_CONFLICTS } from '../data/financeSeed'

export default function ReceiptDetailPage() {
  const { receiptId } = useParams()
  const { state } = useLocation()
  const { records, getPatient } = usePatientRecords()
  const payment = records.payments.find((entry) => entry.receiptId === receiptId)
  const registerPath = `${ROUTES.billingReceipts}${state?.search ?? ''}`

  if (!payment) {
    return (
      <BillingFrame back={{ to: registerPath, label: 'Receipt Register' }} crumb="Billing & Finance / Receipts" code="BF-13 / Payments & receipts" title="Receipt not found" scope={false}>
        <Banner tone="warning" title="No receipt matches this link">Open the Receipt Register to find the record.</Banner>
      </BillingFrame>
    )
  }

  const patient = getPatient(payment.patientId)
  const conflict = RECEIPT_CONFLICTS.includes(receiptId)
  const paymentPath = pathFor(ROUTES.billingPayment, { paymentId: payment.id })
  const method = payment.instrument.replace(/\s*\(.*\)$/, '')

  return (
    <BillingFrame back={{ to: registerPath, label: 'Receipt Register · filtered view' }} crumb={`Billing & Finance / Receipts / ${receiptId}`} code="BF-13 / Payments & receipts" title="Receipt Details" description={`${receiptId} · Review the linked receipt without inferring an amount from the payment or allocation.`} actions={<><ActionButton icon={Printer} disabled={conflict} onClick={() => window.print()}>Print</ActionButton><ActionButton icon={Download} disabled={conflict}>Download</ActionButton></>} scope={false}>
      <Scope left={`Aura Health · ${payment.desk} / ${patient?.name} · ${patient?.mrn}`} />
      {conflict && <Banner tone="warning" title="Amount requires verification · Official receipt output disabled" className="mb-6">The source contains conflicting amounts for {receiptId}. Receipt amount is unavailable, not zero. Print and Download remain disabled until the amount and official issue details are verified.</Banner>}

      <div className="mb-6 grid items-start gap-6 lg:grid-cols-[1fr_452px]">
        <div>
          <p className="mb-3 flex items-center justify-between text-[13px] font-semibold">Printable layout {conflict && <StatusPill tone="warning">Non-issuable preview</StatusPill>}</p>
          <article className="rounded-md border border-slate-300 bg-white p-10">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
              <div><h2 className="text-[28px] font-semibold">Aura Health</h2><p className="mt-1 text-xs text-outline">{payment.desk}</p><p className="mt-2 text-[11px] text-outline">ClinicOS Sovereign · Payment receipt</p></div>
              <div className="text-right"><p className="text-base font-semibold">{conflict ? 'RECEIPT PREVIEW' : 'RECEIPT'}</p><p className="mt-1 text-sm font-semibold text-brand">{receiptId}</p>{conflict && <StatusPill tone="warning" className="mt-2">NOT VALID FOR ISSUE</StatusPill>}</div>
            </header>
            <dl className="grid gap-x-8 gap-y-6 py-6 text-xs sm:grid-cols-2">
              <KeyValue label="Patient / payer" hint={patient?.mrn}>{patient?.name}</KeyValue>
              <KeyValue label="Receipt issued" hint={conflict ? 'Official issue / finalization status: unknown' : 'Issued with the payment'}>{conflict ? 'Not verified' : formatDate(payment.date)}</KeyValue>
              <KeyValue label="Payment reference">{payment.id}</KeyValue>
              <KeyValue label="Payment date" hint="Verified payment date, not receipt issue time">{formatDate(payment.date)} · {formatTime(payment.time)} IST</KeyValue>
              <KeyValue label="Payment method">{method}</KeyValue>
              <KeyValue label="Transaction reference">{payment.reference}</KeyValue>
            </dl>
            <div className="flex items-center justify-between border-y border-slate-200 py-5"><div><p className="text-[13px] font-semibold">Receipt amount (INR)</p>{conflict && <p className="mt-1 text-xs text-amber-700">Amount requires verification</p>}</div><p className="text-2xl font-semibold">{conflict ? '—' : money(payment.amount)}</p></div>
            {conflict ? <Banner tone="warning" title="Preview only — not an official receipt" className="mt-6">No receipt amount is asserted. Do not issue, print as an official receipt, or use this preview as proof of the receipt amount.</Banner> : <p className="mt-6 text-xs text-outline">Amount received in full for the linked payment. Allocation to invoices is a separate record.</p>}
            <p className="mt-6 text-[11px] text-outline">Payment, allocation and receipt are distinct records. Neither the {money(payment.amount)} payment nor the {money(allocatedFromPayment(payment))} allocation establishes this receipt’s amount{conflict ? '' : ' beyond the verified payment'}.</p>
          </article>
        </div>

        <div className="space-y-5">
          <Section title="Verification status">
            <StatusPill tone={conflict ? 'warning' : 'success'}>{conflict ? 'Amount requires verification' : 'Source verified'}</StatusPill>
            <dl className="mt-5 space-y-4 text-xs">
              <KeyValue label="Receipt amount" hint={conflict ? 'Conflicting source values; not verified' : undefined}>{conflict ? '—' : money(payment.amount)}</KeyValue>
              <KeyValue label="Official issue status">{conflict ? 'Unknown' : 'Issued'}</KeyValue>
              <KeyValue label="Receipt issue timestamp">{conflict ? 'Not verified' : `${formatDate(payment.date)} · ${formatTime(payment.time)} IST`}</KeyValue>
            </dl>
            <p className="mt-4 text-xs leading-5 text-outline">Source verification is separate from official receipt status. No issued or void status is inferred.</p>
          </Section>
          <Section title="Linked payment">
            <TextLink to={paymentPath} state={state}>{payment.id} → Payment Details</TextLink>
            <p className="mt-3"><StatusPill tone="success">Settled & Recorded · Verified</StatusPill></p>
            <dl className="mt-4 space-y-4 text-xs">
              <KeyValue label="Payment received" hint={conflict ? 'Not the verified receipt amount' : undefined}>{money(payment.amount)}</KeyValue>
              <KeyValue label="Payment method">{payment.instrument}</KeyValue>
            </dl>
            <p className="mt-4 text-xs leading-5 text-outline">Opened from Payment Details? Return to {payment.id} with the original register context preserved.</p>
            <ActionButton to={paymentPath} state={state} className="mt-4">Back to Payment Details</ActionButton>
          </Section>
        </div>
      </div>
      <GovernanceFooter code="BF-13">{conflict ? 'Official output is blocked pending source verification. ' : ''}Reviewing this receipt does not alter settled payment history or create an allocation.</GovernanceFooter>
    </BillingFrame>
  )
}
