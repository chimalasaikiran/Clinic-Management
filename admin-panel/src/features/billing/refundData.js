import { allPayments, allRefunds } from './financeLogic'

// Who a refund belongs to: patients in the directory by id, other payers by the name held on the request.
export function refundParty(refund, getPatient) {
  const patient = refund.patientId ? getPatient(refund.patientId) : null
  return { name: patient?.name ?? refund.patientName ?? 'Unknown patient', mrn: patient?.mrn ?? refund.mrn ?? '', payer: refund.payer ?? 'Self-pay' }
}

export function refundContext(records, requests) {
  const refunds = allRefunds(records, requests)
  const payments = allPayments(records)
  return { refunds, payments, paymentOf: (id) => payments.find((payment) => payment.id === id) }
}
