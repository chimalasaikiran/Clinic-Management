// Sample dispensing queue, dispense records and returns/discrepancy cases for the pharmacy workspace.
const line = (id, itemId, name, qty, unit, timing, dispensed = 0) => ({ id, itemId, name, qty, unit, timing, dispensed })

const SOURCE_CHECKS = {
  ddi: 'Standard guideline-aligned combination; no adverse drug-drug interaction recorded in the prescription source.',
  renal: 'Renal and hepatic function recorded within range in the prescription source.',
  prescriber: 'Prescriber registration verified and active in the source record.',
}

export const SEED_RX = [
  {
    id: 'RX-10284', date: '2026-10-20', time: '10:42', ago: '6m ago in source', priority: 'STAT', status: 'Awaiting dispensing', hold: null,
    patient: { name: 'Keerthi Sagar', age: 42, gender: 'M', uhid: 'PT-10284', abha: '91-4402-1923-4412', allergies: ['penicillin'], payer: 'ABHA Linked' },
    prescriber: 'Dr. Julian Vance, MD', department: 'Cardiology', chamber: 'Ch. 101', encounter: 'EN-10284', followUp: 'Post-PCI Follow-up',
    diagnoses: ['Essential Hypertension (I10)', 'CAD Post-PCI (Z95.5)', 'Primary Dyslipidemia (E78.0)'], vitals: 'BP 128/82 mmHg · HR 72 bpm · BMI 24.1',
    coverage: 'Star Health Cashless: ₹5,00,000 cap · zero co-pay', schedule: 'H', notes: 'Pharmacy source: penicillin allergy cleared; zero D-D interactions; Schedule H verified.', sourceChecks: SOURCE_CHECKS,
    lines: [
      line('L1', 'MED-CV-RAM-005', 'Tab. Ramipril 5mg', 30, 'tabs', '1-0-0 · Oral morning (post-breakfast)'),
      line('L2', 'MED-CV-ATV-040', 'Tab. Atorvastatin 40mg', 30, 'tabs', '0-0-1 · Oral night (post-dinner)'),
      line('L3', 'MED-CV-ECO-075', 'Tab. Ecosprin 75mg', 30, 'tabs', '1-0-0 · Oral noon (post-lunch)'),
    ],
  },
  {
    id: 'RX-10281', date: '2026-10-20', time: '10:30', ago: '18m ago in source', priority: 'ROUTINE', status: 'Partially dispensed', hold: null,
    patient: { name: 'Ananya Sharma', age: 29, gender: 'F', uhid: 'PT-09822', abha: '', allergies: [], payer: 'Cash / Self-Pay' },
    prescriber: 'Dr. Meera Nambiar', department: 'Gastroenterology', chamber: '', encounter: '', followUp: '',
    diagnoses: [], vitals: '', coverage: 'Self-pay', schedule: null, notes: 'Omez → Prilosec equivalent verified by R. Pillai. Bay B-04 staged.', sourceChecks: SOURCE_CHECKS,
    lines: [line('L1', 'MED-GI-SUC-010', 'Syp. Sucralfate 10ml', 1, 'bottle', 'Dispensed', 1), line('L2', 'MED-GI-OMP-020', 'Cap. Omeprazole 20mg', 30, 'caps', '1-0-0 · before food', 15)],
  },
  {
    id: 'RX-10279', date: '2026-10-20', time: '10:15', ago: '33m ago in source', priority: 'STATUTORY', status: 'On hold', hold: 'Schedule H1 · awaiting patient OTP consent; register entry pending',
    patient: { name: 'Vikramaditya Rao', age: 61, gender: 'M', uhid: 'PT-07619', abha: '', allergies: [], payer: 'ABHA Linked' },
    prescriber: 'Dr. Julian Vance, MD', department: 'Pulmonology', chamber: '', encounter: '', followUp: '',
    diagnoses: [], vitals: '', coverage: 'Self-pay', schedule: 'H1', notes: 'Schedule H1 · Awaiting patient OTP consent. Statutory register entry pending.', sourceChecks: SOURCE_CHECKS,
    lines: [line('L1', 'MED-RS-LVX-500', 'Tab. Levofloxacin 500mg', 10, 'tabs', '1-0-0 · after food'), line('L2', 'MED-RS-AMB-030', 'Syp. Ambroxol 30mg/5ml', 1, 'bottle', '5 ml thrice daily')],
  },
  {
    id: 'RX-10276', date: '2026-10-20', time: '09:55', ago: '53m ago in source', priority: 'ROUTINE', status: 'Dispensed', hold: null,
    patient: { name: 'Farida Khan', age: 34, gender: 'F', uhid: 'PT-09941', abha: '', allergies: [], payer: 'TPA: Star Health' },
    prescriber: 'Dr. Rajeshwari K.', department: 'Internal Medicine', chamber: '', encounter: '', followUp: '',
    diagnoses: [], vitals: '', coverage: 'TPA pre-auth approved', schedule: null, notes: 'Counter Bay #3 · explicit dispensing confirmation takes precedence over the source Ready badge.', sourceChecks: SOURCE_CHECKS,
    lines: [line('L1', 'MED-DM-MSR-500', 'Tab. Metformin 500mg SR', 60, 'tabs', '1-0-1', 60), line('L2', 'MED-DM-GLM-001', 'Tab. Glimepiride 1mg', 30, 'tabs', '1-0-0', 30)],
  },
]

export const SEED_DISPENSES = [
  { id: 'DSP-2026-0840', rxId: 'RX-10276', date: '2026-10-20', time: '10:20', by: 'Ramesh Pillai, B.Pharm', lines: [
    { lineId: 'L1', itemId: 'MED-DM-MSR-500', name: 'Tab. Metformin 500mg SR', qty: 60, batchNo: 'BT-MSR-2026-06', expiry: '2028-06-30', bin: 'Bay E-01' },
    { lineId: 'L2', itemId: 'MED-DM-GLM-001', name: 'Tab. Glimepiride 1mg', qty: 30, batchNo: 'BT-GLM-2026-02', expiry: '2028-03-31', bin: 'Bay E-02' },
  ] },
  { id: 'DSP-2026-0841', rxId: 'RX-10281', date: '2026-10-20', time: '10:55', by: 'Ramesh Pillai, B.Pharm', lines: [
    { lineId: 'L1', itemId: 'MED-GI-SUC-010', name: 'Syp. Sucralfate 10ml', qty: 1, batchNo: 'BT-SUC-2026-03', expiry: '2028-01-31', bin: 'Bay C-04' },
    { lineId: 'L2', itemId: 'MED-GI-OMP-020', name: 'Cap. Omeprazole 20mg', qty: 15, batchNo: 'BT-OMP-2026-02', expiry: '2028-04-30', bin: 'Bay C-02' },
  ] },
]

const reported = (id, type, subtype, date, time, medicine, batchNo, qty, unit, origin, originNote, reason, reasonNote, assignee, assigneeRole, status, statusNote, extras = {}) => ({
  id, type, subtype, date, time, medicine, batchNo, qty, unit, origin, originNote, reason, reasonNote, assignee, assigneeRole, status, statusNote, ...extras,
})

export const SEED_CASES = [
  reported('RET-1048', 'Return', 'Patient return', '2026-10-20', '10:42', 'Metformin 500 mg', 'MT-2608', 20, 'tablets', 'RX-10284', 'OP Pharmacy', 'Therapy changed', 'Unopened strips', 'R. Pillai', 'Pharmacist', 'Awaiting review', 'Quarantined',
    { location: 'OP Pharmacy', stage: 'Pending return', reference: 'RX-10284', original: 30, expiry: '2028-08-31', notes: 'Two unopened strips returned after a therapy change. Packaging appears intact; storage history requires review.', source: 'Patient return', receiving: 'OP Pharmacy' }),
  reported('DIS-2073', 'Discrepancy', 'Shortage', '2026-10-20', '09:30', 'Amoxicillin 500 mg', 'AM-2609', 10, 'capsules', 'Rack A-03', 'Central Stores', 'Count variance', '100 expected · 90 found', 'A. Nair', 'Store lead', 'Investigating', 'Recount in progress',
    { location: 'Central Stores', stage: 'Resolving', expected: 100, observed: 90, notes: 'Count variance: 100 capsules expected, 90 observed at Rack A-03. Recount in progress; cause and further explanation are not recorded.' }),
  reported('RET-1047', 'Return', 'To inventory', '2026-10-19', '16:15', 'Ceftriaxone 1 g', 'CF-2607', 3, 'vials', 'ISS-0816', 'Ward B → Pharmacy', 'Unused ward stock', 'Sealed · verified', 'R. Pillai', 'Pharmacist', 'Approved', 'Stock posting pending',
    { location: 'Ward B → Pharmacy', stage: 'Approved return', reference: 'ISS-0816', notes: '' }),
  reported('DIS-2072', 'Discrepancy', 'Damaged stock', '2026-10-19', '11:05', 'Human insulin 100 IU/ml', 'IN-2606', 2, 'vials', 'Cold chain · C-01', 'OP Pharmacy', 'Cracked vials', 'Isolated from stock', 'Unassigned', 'Needs owner', 'Awaiting review', 'Reported · photos added',
    { location: 'OP Pharmacy', stage: 'Pending review', notes: '' }),
  reported('DIS-2071', 'Discrepancy', 'Batch mismatch', '2026-10-18', '14:20', 'Paracetamol 500 mg', 'PC-2609 / PC-2610', 30, 'tablets', 'Bin B-02', 'OP Pharmacy', 'Batch differs', 'Ledger 09 · label 10', 'A. Nair', 'Store lead', 'Investigating', 'Batch check in progress',
    { location: 'OP Pharmacy', stage: 'Resolving', notes: '' }),
  reported('RET-1046', 'Return', 'To inventory', '2026-10-17', '15:40', 'Sodium chloride 0.9%', 'NS-2608 · 500 ml', 4, 'bottles', 'ISS-0794', 'Ward A → Pharmacy', 'Excess ward issue', 'Sealed · verified', 'S. Das', 'Pharmacist', 'Resolved', 'Restocked · ADJ-0412',
    { location: 'Ward A → Pharmacy', stage: 'Closed', reference: 'ISS-0794', notes: '' }),
  reported('RET-1045', 'Return', 'Patient return', '2026-10-16', '12:10', 'Pantoprazole 40 mg', 'PN-2605', 7, 'tablets', 'RX-10192', 'OP Pharmacy', 'Opened packaging', 'Seal compromised', 'R. Pillai', 'Pharmacist', 'Rejected', 'Not eligible for restock',
    { location: 'OP Pharmacy', stage: 'Rejected return', reference: 'RX-10192', notes: '' }),
  reported('DIS-2070', 'Discrepancy', 'Damaged stock', '2026-10-15', '09:45', 'Cefixime 200 mg', 'CX-2604', 6, 'tablets', 'Rack A-05', 'Central Stores', 'Water-damaged strip', 'Write-off authorized', 'A. Nair', 'Store lead', 'Resolved', 'Written off · ADJ-0408',
    { location: 'Central Stores', stage: 'Closed', notes: '' }),
  reported('RET-1044', 'Return', 'Patient return', '2026-10-14', '13:25', 'Atorvastatin 40 mg', 'AT-2603', 15, 'tablets', 'RX-10151', 'Main Pharmacy', 'Dose changed', 'Unopened strips', 'R. Pillai', 'Pharmacist', 'Awaiting review', 'Quarantined',
    { location: 'Main Pharmacy', stage: 'Pending return', reference: 'RX-10151', notes: '' }),
  reported('DIS-2069', 'Discrepancy', 'Shortage', '2026-10-13', '16:00', 'Cetirizine 10 mg', 'CT-2602', 12, 'tablets', 'Rack B-01', 'Central Stores', 'Count variance', '200 expected · 188 found', 'A. Nair', 'Store lead', 'Investigating', 'Recount in progress',
    { location: 'Central Stores', stage: 'Resolving', expected: 200, observed: 188, notes: '' }),
  reported('RET-1043', 'Return', 'To inventory', '2026-10-12', '10:10', 'Dextrose 25% 100 ml', 'DX-2601', 5, 'bottles', 'ISS-0771', 'ER Ward → ER Pharmacy', 'Unused ward stock', 'Sealed · verified', 'S. Menon', 'Pharmacist', 'Approved', 'Stock posting pending',
    { location: 'ER Ward → ER Pharmacy', stage: 'Approved return', reference: 'ISS-0771', notes: '' }),
  reported('DIS-2068', 'Discrepancy', 'Damaged stock', '2026-10-10', '09:15', 'Adrenaline 1 mg/1 ml', 'AD-2512', 4, 'ampoules', 'Crash cart 2', 'ER Pharmacy', 'Cracked ampoule', 'Isolated from stock', 'Unassigned', 'Needs owner', 'Awaiting review', 'Reported · photos added',
    { location: 'ER Pharmacy', stage: 'Pending review', notes: '' }),
]
