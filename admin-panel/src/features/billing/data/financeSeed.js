// Sample finance records standing in for the billing API: refund requests, payments from other patients,
// gateway/bank statement lines and the exceptions raised against them.

export const ALLOCATION_REFS = { 'PAY-2026-112|INV-2026-084': 'ALC-88194' }

// Receipts whose source amounts disagree; their amount is shown as unavailable and official output stays off.
export const RECEIPT_CONFLICTS = ['REC-2026-091']

// Payments received for patients who are not in the patient directory yet; they only feed refunds and reconciliation.
export const OTHER_PAYMENTS = [
  { id: 'PAY-2026-117', patientName: 'Rohan Mehta', mrn: 'PT-000236', payer: 'Self-pay', date: '2026-10-19', time: '10:05', amount: 2400, instrument: 'UPI / Razorpay', allocations: [] },
  { id: 'PAY-2026-119', patientName: 'Meera Rao', mrn: 'PT-000309', payer: 'Self-pay', date: '2026-10-19', time: '12:20', amount: 800, instrument: 'UPI / Razorpay', allocations: [] },
  { id: 'PAY-2026-115', patientName: 'Vikram Nair', mrn: '', payer: 'Star Health · TPA', date: '2026-10-17', time: '15:45', amount: 1200, instrument: 'NEFT', allocations: [] },
  { id: 'PAY-2026-120', patientName: 'Isha Reddy', mrn: 'PT-000287', payer: 'Self-pay', date: '2026-10-20', time: '14:31', amount: 5000, instrument: 'UPI / Razorpay', allocations: [], branch: 'Main Surgical Pavilion' },
]

// Refund requests on the approval path. Refunds already processed for PT-000184 live with the patient records.
export const SEED_REFUND_REQUESTS = [
  { id: 'REF-2026-018', patientId: 'pt-000184', paymentId: 'PAY-2026-112', date: '2026-10-21', amount: 1500, reason: 'Unused advance', status: 'Pending', payer: 'Self-pay' },
  { id: 'REF-2026-016', patientName: 'Rohan Mehta', mrn: 'PT-000236', paymentId: 'PAY-2026-117', date: '2026-10-20', amount: 2400, reason: 'Service cancelled', status: 'Approved', payer: 'Self-pay' },
  { id: 'REF-2026-015', patientName: 'Meera Rao', mrn: 'PT-000309', paymentId: 'PAY-2026-119', date: '2026-10-20', amount: 800, reason: 'Duplicate payment', status: 'Failed', payer: 'Self-pay', note: 'Razorpay declined the refund on 20 Oct at 16:42 IST. No money was returned.' },
  { id: 'REF-2026-014', patientName: 'Vikram Nair', mrn: '', paymentId: 'PAY-2026-115', date: '2026-10-19', amount: 1200, reason: 'Payer adjustment', status: 'Rejected', payer: 'Star Health · TPA' },
  { id: 'REF-2026-017', patientId: 'pt-000184', paymentId: 'PAY-2026-112', date: '2026-10-18', amount: 500, reason: 'Unused advance', status: 'Processed', payer: 'Self-pay' },
]

export const REFUND_METHODS = ['Original source · Razorpay UPI', 'Original source · Bank transfer', 'Cash (branch desk)']
export const REFUND_REASON_OPTIONS = ['Unused advance', 'Service cancelled', 'Duplicate payment', 'Payer adjustment', 'Overcharge correction']

export const RECON_SOURCES = ['Razorpay UPI', 'Razorpay Card', 'HDFC Bank']

// Statement lines imported from the gateway and bank. `match` is the ClinicOS payment they pair with, when one exists.
export const RECON_LINES = [
  { id: 'rzp_628901', source: 'Razorpay UPI', reference: 'rzp_628901', date: '2026-10-06', time: '14:28', amount: 7000, paymentId: 'PAY-2026-112', note: 'UPI/628901', state: 'Matched' },
  { id: 'CORP-SH-260928-881', source: 'HDFC Bank', reference: 'CORP-SH-260928-881', date: '2026-09-28', time: '16:10', amount: 6500, paymentId: 'PAY-2026-098', note: 'NEFT · Bank import', state: 'Matched' },
  { id: 'rzp_629314', source: 'Razorpay UPI', reference: 'rzp_629314', date: '2026-10-20', time: '14:32', amount: 4750, paymentId: 'PAY-2026-120', note: 'Amount mismatch', state: 'Exception', exceptionId: 'EXC-2026-042' },
  { id: 'rzp_629320', source: 'Razorpay Card', reference: 'rzp_629320', date: '2026-10-20', time: '15:02', amount: 3200, paymentId: 'PAY-2026-121', note: 'CARD/629320', state: 'Matched' },
  { id: 'UPI-629328-110', source: 'HDFC Bank', reference: 'UPI-629328-110', date: '2026-10-21', time: '09:40', amount: 2000, paymentId: null, note: 'Missing ClinicOS record', state: 'Exception', exceptionId: 'EXC-2026-043' },
  { id: 'rzp_629331', source: 'Razorpay UPI', reference: 'rzp_629331', date: '2026-10-21', time: '10:12', amount: 1800, paymentId: 'PAY-2026-123', note: 'Exact candidate · Review required', state: 'Candidate' },
]

// What ClinicOS holds for the payments the statement lines point at.
export const RECON_PAYMENTS = {
  'PAY-2026-112': { amount: 7000, who: 'Ananya Sharma' },
  'PAY-2026-098': { amount: 6500, who: 'Star Health TPA' },
  'PAY-2026-120': { amount: 5000, who: 'Isha Reddy', mrn: 'PT-000287', date: '2026-10-20', time: '14:31', reference: 'UPI/629314', branch: 'Main Surgical Pavilion', related: ['INV-2026-092', 'REC-2026-103'] },
  'PAY-2026-121': { amount: 3200, who: 'Arjun Patel' },
  'PAY-2026-123': { amount: 1800, who: 'Neha Kapoor' },
}

export const RESOLUTION_TYPES = ['Explained source difference', 'Source record corrected upstream', 'Duplicate source line', 'Write-off approved (separate record)']

export const SEED_EXCEPTIONS = [
  {
    id: 'EXC-2026-042', lineId: 'rzp_629314', kind: 'Amount mismatch', detected: '21 Oct 2026, 10:36 IST', owner: 'Kavya Menon', status: 'In review', batch: 'REC-BATCH-026', evidenceAttached: false,
    reason: 'Possible gross / net reporting difference. A ₹250 fee is not yet evidenced. Do not assume a fee, change PAY-2026-120, or mark the payment as underpaid.',
    audit: [
      ['21 Oct 2026 · 10:35', 'System · Razorpay sync', 'Source transaction imported', 'REC-BATCH-026 · Raw payload retained'],
      ['21 Oct 2026 · 10:36', 'System · Matching engine', 'Exception created · Open', 'Amount difference −₹250; reference matched'],
      ['21 Oct 2026 · 10:41', 'Kavya Menon · Finance Manager', 'Review started · In review', 'Assigned to self; payment left unchanged'],
      ['21 Oct 2026 · 10:44', 'Kavya Menon · Finance Manager', 'Evidence requested', 'Gateway fee breakdown requested; no resolution posted'],
    ],
  },
  {
    id: 'EXC-2026-043', lineId: 'UPI-629328-110', kind: 'Missing ClinicOS record', detected: '21 Oct 2026, 09:55 IST', owner: 'Kavya Menon', status: 'Open', batch: 'REC-BATCH-026', evidenceAttached: false,
    reason: 'The bank statement shows a UPI credit with no ClinicOS payment. The payer is not identified; do not create a payment from the statement line.',
    audit: [
      ['21 Oct 2026 · 10:30', 'System · HDFC import', 'Statement line imported', 'REC-BATCH-026 · Raw payload retained'],
      ['21 Oct 2026 · 10:36', 'System · Matching engine', 'Exception created · Open', 'No ClinicOS payment found for ₹2,000'],
    ],
  },
]
