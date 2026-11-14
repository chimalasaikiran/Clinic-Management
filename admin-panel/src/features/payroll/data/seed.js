// Sample payroll data until the payroll API exists. Every total shown in the module is
// derived from these records, so they stay consistent across screens.

export const PAYROLL_BRANCHES = [
  { id: 'hyd-01', code: '#HYD-01', name: 'Jubilee Hills' },
  { id: 'hyd-02', code: '#HYD-02', name: 'Banjara Hills' },
  { id: 'hyd-03', code: '#HYD-03', name: 'Gachibowli' },
  { id: 'hyd-04', code: '#HYD-04', name: 'Kondapur' },
]

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract locum', 'Consultant']

// `model` drives how gross pay is calculated, see payrollLogic.grossPay.
export const PAY_MODELS = {
  monthly: { label: 'Monthly fixed', unit: 'mo' },
  visit: { label: 'Per visit', unit: 'visit' },
  shift: { label: 'Per shift', unit: 'shift' },
  hourly: { label: 'Hourly', unit: 'hr' },
}

export const STAFF_STATUSES = ['Ready', 'Needs review', 'On hold']

export const CURRENT_CYCLE = {
  month: '2026-09',
  label: 'September 2026',
  batchId: 'PR-2026-SEP-01',
  start: '01 Sep 2026',
  end: '30 Sep 2026',
  days: 30,
  cutoff: '30 Sep 2026, 23:59 IST',
  payDate: '05 Oct 2026',
}

export const EMPLOYEES = [
  {
    id: 'STF-1048',
    name: 'Dr. Ananya Rao',
    initials: 'AR',
    title: 'Senior Physiotherapist',
    department: 'Physiotherapy',
    branchId: 'hyd-02',
    employment: 'Full-time',
    model: 'monthly',
    rate: 85000,
    paidDays: 30,
    volumeNote: '28 days present · 2 days paid leave',
    status: 'Ready',
    bank: 'HDFC Bank •••• 4421',
    bankVerified: true,
    joined: 'Mar 2022',
  },
  {
    id: 'STF-1122',
    name: 'Dr. Ravi Kumar',
    initials: 'RK',
    title: 'Visiting Consultant',
    department: 'Orthopedics',
    branchId: 'hyd-03',
    employment: 'Consultant',
    model: 'visit',
    rate: 1500,
    units: 24,
    volumeNote: '24 verified visits',
    status: 'Ready',
    bank: 'ICICI Bank •••• 1180',
    bankVerified: true,
    joined: 'Jan 2024',
  },
  {
    id: 'STF-1093',
    name: 'Priya Sharma',
    initials: 'PS',
    title: 'Front Desk Lead',
    department: 'Reception',
    branchId: 'hyd-01',
    employment: 'Full-time',
    model: 'monthly',
    rate: 32000,
    paidDays: 26,
    volumeNote: '26 days present · 4 days sick leave unverified',
    status: 'Needs review',
    statusNote: 'Sick leave certificate pending',
    bank: 'SBI •••• 7702',
    bankVerified: true,
    joined: 'Jun 2023',
  },
  {
    id: 'STF-1092',
    name: 'Ramesh Kumar',
    initials: 'RK',
    title: 'Lab Technician',
    department: 'Diagnostics',
    branchId: 'hyd-02',
    employment: 'Contract locum',
    model: 'shift',
    rate: 2500,
    units: 16,
    volumeNote: '16 verified night shifts',
    status: 'Ready',
    bank: 'Axis Bank •••• 3390',
    bankVerified: false,
    joined: 'Feb 2025',
  },
  {
    id: 'STF-1104',
    name: 'Sneha Patel',
    initials: 'SP',
    title: 'Staff Nurse II',
    department: 'Nursing',
    branchId: 'hyd-01',
    employment: 'Full-time',
    model: 'monthly',
    rate: 42000,
    paidDays: 27,
    volumeNote: '27 days present · 3 days unpaid leave',
    status: 'Needs review',
    statusNote: 'Medical certificate attached, awaiting sign-off',
    bank: 'HDFC Bank •••• 8812',
    bankVerified: true,
    joined: 'Aug 2021',
  },
  {
    id: 'STF-1002',
    name: 'Dr. Vikramaditya Sahai',
    initials: 'VS',
    title: 'Clinical Lead & Director',
    department: 'Executive',
    branchId: 'hyd-02',
    employment: 'Full-time',
    model: 'monthly',
    rate: 145000,
    paidDays: 30,
    volumeNote: '30 days executive attendance',
    status: 'Ready',
    bank: 'HDFC Bank •••• 0021',
    bankVerified: true,
    joined: 'Apr 2019',
  },
  {
    id: 'STF-1145',
    name: 'Meera Joshi',
    initials: 'MJ',
    title: 'Pediatric Rehab Specialist',
    department: 'Physiotherapy',
    branchId: 'hyd-03',
    employment: 'Part-time',
    model: 'hourly',
    rate: 1500,
    units: 44,
    volumeNote: '44 session hours logged',
    status: 'Ready',
    bank: 'Kotak Bank •••• 5567',
    bankVerified: true,
    joined: 'Nov 2024',
  },
  {
    id: 'STF-1042',
    name: 'Dr. Arjun Mehta',
    initials: 'AM',
    title: 'Sports Rehab Lead',
    department: 'Sports Medicine',
    branchId: 'hyd-04',
    employment: 'Full-time',
    model: 'monthly',
    rate: 92000,
    paidDays: 30,
    volumeNote: '30 days present',
    status: 'On hold',
    statusNote: 'Bank IFSC mismatch',
    bank: 'Yes Bank •••• 6610',
    bankVerified: false,
    joined: 'Jul 2022',
  },
  {
    id: 'STF-1108',
    name: 'Sunita Rao',
    initials: 'SR',
    title: 'Care Coordinator',
    department: 'Operations',
    branchId: 'hyd-04',
    employment: 'Full-time',
    model: 'monthly',
    rate: 34000,
    paidDays: 3,
    volumeNote: 'Joined 28 Sep, after cycle cutoff',
    status: 'On hold',
    statusNote: 'Deferred to supplemental cycle',
    bank: 'SBI •••• 9014',
    bankVerified: false,
    joined: 'Sep 2026',
  },
]

export const ADJUSTMENT_CATEGORIES = {
  addition: ['Overtime / extra hours', 'Performance incentive', 'Clinic bonus', 'Travel allowance', 'Other approved addition'],
  deduction: ['Unpaid leave', 'Equipment or badge recovery', 'Other approved deduction'],
}

export const ADJUSTMENT_STATUSES = ['Pending approval', 'Approved', 'Rejected']

export const ADJUSTMENTS = [
  { id: 'ADJ-2026-042', employeeId: 'STF-1122', direction: 'addition', category: 'Performance incentive', label: 'Service surge incentive', amount: 1500, reason: 'Completed 24 verified encounters against a baseline of 20 during the 27–28 Sep weekend roster.', requestedBy: 'Rajesh Nair · Branch Manager', requestedOn: '28 Sep 2026', status: 'Pending approval' },
  { id: 'ADJ-2026-038', employeeId: 'STF-1048', direction: 'addition', category: 'Travel allowance', label: 'Home visit surge', amount: 5400, reason: '18 verified GPS home visits at ₹300 per visit.', requestedBy: 'Dr. K. Suman · Clinical Lead', requestedOn: '26 Sep 2026', status: 'Approved' },
  { id: 'ADJ-2026-035', employeeId: 'STF-1093', direction: 'addition', category: 'Clinic bonus', label: 'Lead weekend stipend', amount: 2500, reason: 'On-call weekend front desk cover.', requestedBy: 'P. V. Rao · HR Operations', requestedOn: '24 Sep 2026', status: 'Approved' },
  { id: 'ADJ-2026-033', employeeId: 'STF-1092', direction: 'deduction', category: 'Equipment or badge recovery', label: 'Badge replacement fee', amount: 1200, reason: 'RFID turnstile badge replacement.', requestedBy: 'Rajesh Nair · Branch Manager', requestedOn: '22 Sep 2026', status: 'Approved' },
  { id: 'ADJ-2026-031', employeeId: 'STF-1104', direction: 'addition', category: 'Overtime / extra hours', label: 'Overtime shift allowance', amount: 3200, reason: '12 hours of acute trauma cover across two night rosters.', requestedBy: 'Dr. K. Suman · Clinical Lead', requestedOn: '21 Sep 2026', status: 'Approved' },
  { id: 'ADJ-2026-029', employeeId: 'STF-1145', direction: 'deduction', category: 'Unpaid leave', label: 'Unpaid leave adjustment', amount: 4500, reason: '3 hours of unscheduled leave recorded manually.', requestedBy: 'P. V. Rao · HR Operations', requestedOn: '19 Sep 2026', status: 'Approved' },
  { id: 'ADJ-2026-027', employeeId: 'STF-1042', direction: 'addition', category: 'Travel allowance', label: 'Transport reimbursement', amount: 1000, reason: 'Inter-branch emergency transit.', requestedBy: 'Rajesh Nair · Branch Manager', requestedOn: '18 Sep 2026', status: 'Pending approval' },
]

// Lifecycle: Pending approval → Pending disbursal → Awaiting acknowledgement → Active → Settled.
// Only Active advances are recovered through payroll.
export const ADVANCE_STATUSES = ['Pending approval', 'Pending disbursal', 'Awaiting acknowledgement', 'Active', 'Settled']

export const DISBURSAL_METHODS = ['Bank transfer (NEFT)', 'Bank transfer (RTGS)', 'Cheque']

export const ADVANCE_CATEGORIES = ['Medical emergency', 'Personal emergency / relocation', 'Education', 'Equipment purchase', 'Other']

export const ADVANCES = [
  { id: 'ADV-2026-0041', employeeId: 'STF-1048', principal: 60000, installments: 6, startMonth: '2026-08', source: 'Employee request', category: 'Personal emergency / relocation', status: 'Active', approvedBy: 'Dr. Julian Vance', disbursedOn: '15 Jul 2026' },
  { id: 'ADV-2026-0042', employeeId: 'STF-1122', principal: 20000, installments: 4, startMonth: '2026-09', source: 'Admin created', category: 'Equipment purchase', status: 'Active', approvedBy: 'Dr. Julian Vance', disbursedOn: '20 Aug 2026' },
  { id: 'ADV-2026-0043', employeeId: 'STF-1093', principal: 30000, installments: 3, startMonth: '2026-09', source: 'Admin created', category: 'Medical emergency', status: 'Active', approvedBy: 'Devraj Patel', disbursedOn: '24 Aug 2026' },
  { id: 'ADV-2026-0044', employeeId: 'STF-1092', principal: 16000, installments: 4, startMonth: '2026-06', source: 'Employee request', category: 'Equipment purchase', status: 'Active', approvedBy: 'Devraj Patel', disbursedOn: '28 May 2026' },
  { id: 'ADV-2026-0045', employeeId: 'STF-1104', principal: 25000, installments: 5, startMonth: '2026-10', source: 'Employee request', category: 'Medical emergency', status: 'Pending approval' },
  { id: 'ADV-2026-0046', employeeId: 'STF-1042', principal: 45000, installments: 3, startMonth: '2026-05', source: 'Admin created', category: 'Personal emergency / relocation', status: 'Settled', approvedBy: 'Dr. Julian Vance', disbursedOn: '22 Apr 2026' },
  { id: 'ADV-2026-0047', employeeId: 'STF-1145', principal: 15000, installments: 3, startMonth: '2026-10', source: 'Employee request', category: 'Education', status: 'Awaiting acknowledgement', approvedBy: 'Devraj Patel', disbursedOn: '30 Sep 2026' },
]

// Closed cycles, newest first. Branch rows sum to the cycle totals.
export const CYCLE_HISTORY = [
  {
    month: '2026-08', label: 'August 2026', start: '01 Aug 2026', end: '31 Aug 2026', batchId: '#PAY-2026-AUG-HYD', payDate: '05 Sep 2026', employees: 82,
    gross: 1248000, adjustments: 28400, statutory: 95600, advances: 36500, approvedBy: 'Devraj Patel, CFO', approvedOn: '03 Sep 2026, 10:15 AM',
    branches: [
      { branchId: 'hyd-02', staff: 24, gross: 408000, net: 374000 },
      { branchId: 'hyd-01', staff: 18, gross: 304000, net: 279000 },
      { branchId: 'hyd-03', staff: 21, gross: 342000, net: 314300 },
      { branchId: 'hyd-04', staff: 19, gross: 194000, net: 177000 },
    ],
  },
  {
    month: '2026-07', label: 'July 2026', start: '01 Jul 2026', end: '31 Jul 2026', batchId: '#PAY-2026-JUL-HYD', payDate: '05 Aug 2026', employees: 82,
    gross: 1232500, adjustments: 24100, statutory: 94200, advances: 34000, approvedBy: 'Devraj Patel, CFO', approvedOn: '03 Aug 2026, 11:02 AM',
    branches: [
      { branchId: 'hyd-02', staff: 24, gross: 402500, net: 368600 },
      { branchId: 'hyd-01', staff: 18, gross: 301000, net: 275800 },
      { branchId: 'hyd-03', staff: 21, gross: 338000, net: 309700 },
      { branchId: 'hyd-04', staff: 19, gross: 191000, net: 174300 },
    ],
  },
  {
    month: '2026-06', label: 'June 2026', start: '01 Jun 2026', end: '30 Jun 2026', batchId: '#PAY-2026-JUN-HYD', payDate: '05 Jul 2026', employees: 80,
    gross: 1218000, adjustments: 22800, statutory: 93100, advances: 31500, approvedBy: 'Devraj Patel, CFO', approvedOn: '03 Jul 2026, 09:40 AM',
    branches: [
      { branchId: 'hyd-02', staff: 23, gross: 398000, net: 364900 },
      { branchId: 'hyd-01', staff: 18, gross: 298000, net: 273100 },
      { branchId: 'hyd-03', staff: 21, gross: 334000, net: 306200 },
      { branchId: 'hyd-04', staff: 18, gross: 188000, net: 172000 },
    ],
  },
  {
    month: '2026-05', label: 'May 2026', start: '01 May 2026', end: '31 May 2026', batchId: '#PAY-2026-MAY-HYD', payDate: '05 Jun 2026', employees: 79,
    gross: 1204000, adjustments: 21500, statutory: 92000, advances: 31000, approvedBy: 'Devraj Patel, CFO', approvedOn: '03 Jun 2026, 10:05 AM',
    branches: [
      { branchId: 'hyd-02', staff: 23, gross: 394000, net: 361000 },
      { branchId: 'hyd-01', staff: 17, gross: 294000, net: 269300 },
      { branchId: 'hyd-03', staff: 21, gross: 331000, net: 303200 },
      { branchId: 'hyd-04', staff: 18, gross: 185000, net: 169000 },
    ],
  },
  {
    month: '2026-04', label: 'April 2026', start: '01 Apr 2026', end: '30 Apr 2026', batchId: '#PAY-2026-APR-HYD', payDate: '05 May 2026', employees: 78,
    gross: 1192000, adjustments: 20300, statutory: 90900, advances: 29300, approvedBy: 'Devraj Patel, CFO', approvedOn: '04 May 2026, 09:30 AM',
    branches: [
      { branchId: 'hyd-02', staff: 23, gross: 390000, net: 357300 },
      { branchId: 'hyd-01', staff: 17, gross: 291000, net: 266500 },
      { branchId: 'hyd-03', staff: 20, gross: 328000, net: 300400 },
      { branchId: 'hyd-04', staff: 18, gross: 183000, net: 167900 },
    ],
  },
  {
    month: '2026-03', label: 'March 2026', start: '01 Mar 2026', end: '31 Mar 2026', batchId: '#PAY-2026-MAR-HYD', payDate: '05 Apr 2026', employees: 78,
    gross: 1186000, adjustments: 19800, statutory: 90400, advances: 28000, approvedBy: 'Devraj Patel, CFO', approvedOn: '03 Apr 2026, 10:20 AM',
    branches: [
      { branchId: 'hyd-02', staff: 23, gross: 388000, net: 355700 },
      { branchId: 'hyd-01', staff: 17, gross: 289000, net: 265000 },
      { branchId: 'hyd-03', staff: 20, gross: 327000, net: 299700 },
      { branchId: 'hyd-04', staff: 18, gross: 182000, net: 167000 },
    ],
  },
  {
    month: '2026-02', label: 'February 2026', start: '01 Feb 2026', end: '28 Feb 2026', batchId: '#PAY-2026-FEB-HYD', payDate: '05 Mar 2026', employees: 77,
    gross: 1171000, adjustments: 18600, statutory: 89300, advances: 27500, approvedBy: 'Devraj Patel, CFO', approvedOn: '03 Mar 2026, 09:55 AM',
    branches: [
      { branchId: 'hyd-02', staff: 22, gross: 383000, net: 351100 },
      { branchId: 'hyd-01', staff: 17, gross: 286000, net: 262200 },
      { branchId: 'hyd-03', staff: 20, gross: 323000, net: 296000 },
      { branchId: 'hyd-04', staff: 18, gross: 179000, net: 163500 },
    ],
  },
  {
    month: '2026-01', label: 'January 2026', start: '01 Jan 2026', end: '31 Jan 2026', batchId: '#PAY-2026-JAN-HYD', payDate: '05 Feb 2026', employees: 77,
    gross: 1165000, adjustments: 18000, statutory: 88800, advances: 26900, approvedBy: 'Devraj Patel, CFO', approvedOn: '03 Feb 2026, 10:10 AM',
    branches: [
      { branchId: 'hyd-02', staff: 22, gross: 381000, net: 349400 },
      { branchId: 'hyd-01', staff: 17, gross: 284000, net: 260400 },
      { branchId: 'hyd-03', staff: 20, gross: 321000, net: 294400 },
      { branchId: 'hyd-04', staff: 18, gross: 179000, net: 163100 },
    ],
  },
]

export const ACTIVITY = [
  { id: 'a4', title: 'Adjustment approved (+₹3,200)', meta: 'Dr. K. Suman · 21 Sep 2026, 02:40 PM' },
  { id: 'a3', title: 'Advance disbursed (₹15,000)', meta: 'Devraj Patel, CFO · 30 Sep 2026, 10:10 AM' },
  { id: 'a2', title: 'Attendance synced for September', meta: 'Biometric gateway · 30 Sep 2026, 08:00 AM' },
  { id: 'a1', title: 'Payroll run started', meta: 'Sita Raman · 20 Sep 2026, 09:30 AM' },
]
