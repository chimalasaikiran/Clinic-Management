const event = (date, time, text, by) => ({ date, time, text, by })

const line = (itemId, requested, extras = {}) => ({ itemId, requested, approved: 0, issued: 0, received: 0, ...extras })

export const SEED_REQUESTS = [
  {
    id: 'SR-261020-07', pharmacy: 'opd', requestedBy: 'A. Nair', role: 'Pharmacist', priority: 'Normal', required: '2026-10-21', date: '2026-10-20', time: '10:20',
    reason: 'Routine replenishment', notes: 'Routine branch replenishment.', status: 'Submitted', decision: null, transferIds: [],
    lines: [line('MED-00124', 1500), line('MED-00172', 200)],
    activity: [event('2026-10-20', '10:20', 'Submitted by A. Nair', 'Pharmacy · 1,500 Paracetamol + 200 Metformin tablets')],
  },
  {
    id: 'SR-261020-08', pharmacy: 'main', requestedBy: 'S. Iyer', role: 'Pharmacist', priority: 'Normal', required: '2026-10-22', date: '2026-10-20', time: '10:55',
    reason: 'Routine replenishment', notes: '', status: 'Submitted', decision: null, transferIds: [],
    lines: [line('CON-00042', 40)],
    activity: [event('2026-10-20', '10:55', 'Submitted by S. Iyer', 'Pharmacy · 40 boxes of gloves')],
  },
  {
    id: 'SR-261019-03', pharmacy: 'main', requestedBy: 'S. Iyer', role: 'Pharmacist', priority: 'Normal', required: '2026-10-20', date: '2026-10-19', time: '09:40',
    reason: 'Routine replenishment', notes: 'Paracetamol 500mg · P26A', status: 'Dispatched', decision: 'Approve in full', transferIds: ['TR-261019-04'],
    lines: [line('MED-00124', 200, { approved: 200, issued: 200 })],
    activity: [event('2026-10-19', '09:40', 'Submitted by S. Iyer', 'Pharmacy'), event('2026-10-19', '12:10', 'Approved in full by R. Shah', 'Inventory manager'), event('2026-10-19', '15:10', 'Dispatched on TR-261019-04', 'N. Desai')],
  },
  {
    id: 'SR-261017-02', pharmacy: 'opd', requestedBy: 'A. Nair', role: 'Pharmacist', priority: 'Normal', required: '2026-10-19', date: '2026-10-17', time: '14:05',
    reason: 'Routine replenishment', notes: 'Duplicate replenishment request', status: 'Cancelled', decision: null, transferIds: [],
    lines: [line('CON-00042', 20)],
    activity: [event('2026-10-17', '14:05', 'Cancelled by requester', 'Duplicate replenishment request · no stock movement')],
  },
  {
    id: 'SR-261018-04', pharmacy: 'main', requestedBy: 'R. Pillai', role: 'B.Pharm', priority: 'Urgent', required: '2026-10-20', date: '2026-10-18', time: '10:48',
    reason: 'Replenishment · Stockout / below safety buffer', notes: 'Please replenish crash cart Atropine urgently; pharmacy stock is zero.', status: 'Draft', decision: null, transferIds: [],
    lines: [line('MED-EM-ATR-006', 10), line('MED-CV-TEL-040', 100)],
    activity: [],
  },
  {
    id: 'SR-261018-03', pharmacy: 'opd', requestedBy: 'A. Nair', role: 'B.Pharm', priority: 'Normal', required: '2026-10-21', date: '2026-10-18', time: '09:35',
    reason: 'Routine replenishment', notes: '', status: 'Fulfilled', decision: 'Approve in full', transferIds: [],
    lines: [line('MED-00124', 500, { approved: 500, issued: 500, received: 500 }), line('MED-00218', 200, { approved: 200, issued: 200, received: 200 })],
    activity: [event('2026-10-18', '09:35', 'Submitted by A. Nair', 'Pharmacy'), event('2026-10-18', '15:30', 'Branch receipt posted', 'OPD Pharmacy')],
  },
  {
    id: 'SR-261017-05', pharmacy: 'main', requestedBy: 'R. Pillai', role: 'B.Pharm', priority: 'Normal', required: '2026-10-18', date: '2026-10-17', time: '11:10',
    reason: 'Routine replenishment', notes: '', status: 'Partially fulfilled', decision: 'Approve partial', decisionNote: 'Balance pending replenishment at Central Stores.', transferIds: [],
    lines: [line('MED-CV-TEL-040', 200, { approved: 100, issued: 100, received: 100 }), line('MED-00172', 300, { approved: 300, issued: 300, received: 300 })],
    activity: [event('2026-10-17', '12:05', 'Approved partially by K. Shah', 'Inventory manager'), event('2026-10-18', '09:20', 'Last issue', 'Central Stores · 100 tablets of Telmisartan')],
  },
  {
    id: 'SR-261017-08', pharmacy: 'main', requestedBy: 'R. Pillai', role: 'B.Pharm', priority: 'Urgent', required: '2026-10-18', date: '2026-10-17', time: '16:20',
    reason: 'Emergency requirement', notes: '', status: 'Approved', decision: 'Approve in full', transferIds: [],
    lines: [line('MED-AB-CTX-1G', 40, { approved: 40 }), line('MED-00451', 60, { approved: 60 })],
    activity: [event('2026-10-17', '16:20', 'Submitted by R. Pillai', 'Pharmacy'), event('2026-10-17', '17:05', 'Approved in full by K. Shah', 'Inventory manager')],
  },
  {
    id: 'SR-261016-06', pharmacy: 'er', requestedBy: 'S. Menon', role: 'B.Pharm', priority: 'Urgent', required: '2026-10-16', date: '2026-10-16', time: '14:45',
    reason: 'Emergency requirement', notes: '', status: 'Fulfilled', decision: 'Approve in full', transferIds: [],
    lines: [line('MED-EM-ADR-001', 20, { approved: 20, issued: 20, received: 20 }), line('MED-EM-ATR-006', 10, { approved: 10, issued: 10, received: 10 })],
    activity: [event('2026-10-16', '17:10', 'Branch receipt posted', 'ER Pharmacy')],
  },
  {
    id: 'SR-261015-02', pharmacy: 'opd', requestedBy: 'A. Nair', role: 'B.Pharm', priority: 'Normal', required: '2026-10-17', date: '2026-10-15', time: '10:05',
    reason: 'Routine replenishment', notes: '', status: 'Rejected', decision: 'Reject request', decisionNote: 'Duplicate request', transferIds: [],
    lines: [line('MED-AB-AZI-500', 150)],
    activity: [event('2026-10-15', '11:30', 'Rejected by R. Shah', 'Duplicate request')],
  },
]

export const SEED_TRANSFERS = [
  {
    id: 'TR-261019-04', issueId: 'ISS-261019-04', requestId: 'SR-261019-03', from: 'central', to: 'main', status: 'In transit', created: '2026-10-19', dispatched: '2026-10-19', dispatchedTime: '15:10', received: null, reason: 'Routine replenishment', notes: '', createdBy: 'N. Desai',
    lines: [{ itemId: 'MED-00124', batchId: 'BAT-001', batchNo: 'P26A', expiry: '2027-01-15', qty: 200, received: 0 }],
    history: [event('2026-10-19', '12:10', 'Created & approved', 'Batch and quantity confirmed at Central Stores'), event('2026-10-19', '15:10', 'Dispatched', '200 tablets left Central Stores')],
  },
  {
    id: 'TR-261020-03', issueId: null, requestId: null, from: 'central', to: 'opd', status: 'Ready for dispatch', created: '2026-10-20', dispatched: null, received: null, reason: 'Routine replenishment', notes: '', createdBy: 'N. Desai',
    lines: [{ itemId: 'CON-00042', batchId: 'BAT-006', batchNo: 'GL26F', expiry: '2029-09-30', qty: 20, received: 0 }],
    history: [event('2026-10-20', '09:20', 'Created & reserved', 'Quantity reserved at Central Stores')],
  },
  {
    id: 'TR-261020-02', issueId: null, requestId: null, from: 'central', to: 'opd', status: 'Draft', created: '2026-10-20', dispatched: null, received: null, reason: 'Routine replenishment', notes: '', createdBy: 'N. Desai',
    lines: [{ itemId: 'MED-00218', batchId: 'BAT-003', batchNo: 'CT26C', expiry: '2028-06-30', qty: 100, received: 0 }],
    history: [event('2026-10-20', '09:05', 'Draft saved', 'No stock reserved')],
  },
  {
    id: 'TR-261020-01', issueId: null, requestId: null, from: 'central', to: 'main', status: 'Draft', created: '2026-10-20', dispatched: null, received: null, reason: 'Routine replenishment', notes: '', createdBy: 'N. Desai',
    lines: [{ itemId: 'MED-00306', batchId: 'BAT-004', batchNo: 'AM26D', expiry: '2028-08-31', qty: 120, received: 0 }],
    history: [event('2026-10-20', '08:50', 'Draft saved', 'No stock reserved')],
  },
  {
    id: 'TR-261019-03', issueId: 'ISS-261019-03', requestId: null, from: 'central', to: 'main', status: 'Received', created: '2026-10-19', dispatched: '2026-10-19', dispatchedTime: '14:00', received: '2026-10-19', receivedTime: '15:10', reason: 'Routine replenishment', notes: '', createdBy: 'N. Desai',
    lines: [{ itemId: 'MED-00172', batchId: 'BAT-005', batchNo: 'MF26B', expiry: '2028-07-31', qty: 300, received: 300 }],
    history: [event('2026-10-19', '14:00', 'Dispatched', '300 tablets left Central Stores'), event('2026-10-19', '15:10', 'Received at Main Pharmacy', 'Accepted quantity posted')],
  },
  {
    id: 'TR-261018-02', issueId: 'ISS-261018-02', requestId: null, from: 'central', to: 'opd', status: 'Received', created: '2026-10-18', dispatched: '2026-10-18', dispatchedTime: '10:00', received: '2026-10-18', receivedTime: '11:20', reason: 'Routine replenishment', notes: '', createdBy: 'N. Desai',
    lines: [{ itemId: 'MED-00451', batchId: 'BAT-007', batchNo: 'NS26H', expiry: '2028-10-31', qty: 24, received: 24 }],
    history: [event('2026-10-18', '10:00', 'Dispatched', '24 bottles left Central Stores'), event('2026-10-18', '11:20', 'Received at OPD Pharmacy', 'Accepted quantity posted')],
  },
]

const poLine = (itemId, ordered, rate) => ({ itemId, ordered, rate })

export const SEED_ORDERS = [
  { id: 'PO-261018-04', supplierId: 'SUP-0018', date: '2026-10-18', store: 'central', expected: '', reference: '', terms: '', notes: '', createdBy: '', closed: false, lines: [poLine('MED-00124', 1000, 1.2)] },
  { id: 'PO-261019-05', supplierId: 'SUP-0006', date: '2026-10-19', store: 'central', expected: '2026-10-23', reference: '', terms: '', notes: '', createdBy: '', closed: false, lines: [poLine('MED-00218', 1000, 1.5)] },
  { id: 'PO-261012-06', supplierId: 'SUP-0018', date: '2026-10-12', store: 'central', expected: '', reference: '', terms: '', notes: '', createdBy: '', closed: false, lines: [poLine('MED-00124', 2000, 1.2)] },
]

const dsc = (id, kind, qty, state, note, resolution) => ({ id, kind, qty, state, note, resolution })

export const SEED_RECEIPTS = [
  {
    id: 'GRN-261020-03', orderId: 'PO-261018-04', supplierId: 'SUP-0018', store: 'central', date: '2026-10-20', time: '09:40', receivedBy: 'K. Rao', challan: 'DC-39811', invoice: 'INV-88214', bay: 'C-01', status: 'Reconciliation required', posted: false, verified: true,
    lines: [{ itemId: 'MED-00124', ordered: 1000, received: 980, accepted: 960, rejected: 20, short: 20, batches: [{ batchNo: 'P26C', expiry: '2028-08-31', qty: 960, bin: 'A-04' }] }],
    discrepancies: [
      dsc('DSC-261020-03', 'Short delivery', 20, 'Unresolved', 'Count sheet CS-108; challan records 1,000. Supplier notified 10:20 AM.', null),
      dsc('DSC-261020-04', 'Damaged packs', 20, 'Documented', 'Photo QA-109. R. Shah approved 10:50 AM; supplier acknowledgement attached.', 'Return agreed · RTN-261020-01'),
    ],
    attachments: 2,
    audit: [event('2026-10-20', '09:40', 'Receipt recorded', 'K. Rao · 20 Oct, 980 tablets physically counted'), event('2026-10-20', '10:05', 'Inspection completed', 'K. Rao · 960 accepted / 20 damaged / rejected'), event('2026-10-20', '10:20', 'Shortage raised', 'R. Shah · Supplier notified · DSC-261020-03'), event('2026-10-20', '10:50', 'Return documented', 'R. Shah · RTN-261020-01 · 20 rejected tablets')],
  },
  {
    id: 'GRN-261016-02', orderId: 'PO-261012-06', supplierId: 'SUP-0018', store: 'central', date: '2026-10-16', time: '10:00', receivedBy: 'K. Rao', challan: 'DC-39702', invoice: 'INV-88102', bay: 'C-01', status: 'Posted', posted: true, verified: true,
    lines: [{ itemId: 'MED-00124', ordered: 2000, received: 2000, accepted: 2000, rejected: 0, short: 0, batches: [{ batchNo: 'P26A', expiry: '2027-01-15', qty: 1000, bin: 'A-03' }, { batchNo: 'P26B', expiry: '2028-07-31', qty: 1000, bin: 'A-04' }] }],
    discrepancies: [], attachments: 0,
    audit: [event('2026-10-16', '10:00', 'Receipt recorded', 'K. Rao · 2,000 tablets counted'), event('2026-10-16', '10:30', 'Receipt posted', 'K. Rao · 1,000 per batch accepted, reconciled and posted')],
  },
]

export const SEED_ADJUSTMENTS = [
  { id: 'ADJ-261020-03', date: '2026-10-20', time: '10:45', recordedBy: 'N. Desai', itemId: 'CON-00042', batchId: 'BAT-006', batchNo: 'GL26F', proposed: -2, posted: 0, reason: 'Count variance under review', evidence: 'Count sheet CS-110 · recount pending', status: 'Draft', approvedBy: '', approvedAt: '' },
  { id: 'ADJ-261019-02', date: '2026-10-19', time: '16:35', recordedBy: 'N. Desai', itemId: 'MED-00124', batchId: 'BAT-001', batchNo: 'P26A', proposed: -200, posted: -200, reason: 'Damaged blister packs removed after count', evidence: 'QA-108 · approved write-off', status: 'Posted', approvedBy: 'R. Shah', approvedAt: '2026-10-19 16:35' },
  { id: 'ADJ-261018-01', date: '2026-10-18', time: '15:00', recordedBy: 'K. Rao', itemId: 'MED-00451', batchId: 'BAT-007', batchNo: 'NS26H', proposed: -5, posted: 0, reason: 'Count variance · recount matched ledger', evidence: 'CS-104 · no adjustment needed', status: 'Rejected', approvedBy: 'R. Shah', approvedAt: '2026-10-18 16:10' },
]

const move = (date, time, actor, kind, ref, itemId, batchLabel, delta, availableAfter, reason, loc = 'central') => ({ id: `MOV-${date.slice(5)}-${time}-${kind[0]}`, date, time, actor, kind, ref, itemId, loc, batchLabel, delta, availableAfter, reason })

export const SEED_MOVEMENTS = [
  move('2026-10-20', '09:10', 'N. Desai · Store officer', 'Reservation created', 'RSV-261020-02', 'MED-00124', 'P26A / P26B', 0, 1200, '400 reserved for approved requests; 200 per batch. Posted stock unchanged.'),
  move('2026-10-19', '16:35', 'R. Shah · Approved', 'Adjustment', 'ADJ-261019-02', 'MED-00124', 'P26A', -200, 1600, 'Damaged blister packs removed after count. Evidence QA-108; approved write-off.'),
  move('2026-10-19', '14:20', 'N. Desai · Store officer', 'Issue', 'TR-261019-04', 'MED-00124', 'P26A', -200, 1800, 'Central Stores → Main Pharmacy. Dispatched 03:10 PM; branch receipt pending.'),
  move('2026-10-16', '10:00', 'K. Rao · Receiving officer', 'Receipt', 'GRN-261016-02', 'MED-00124', 'P26A / P26B', 2000, 2000, '1,000 per batch accepted, reconciled and posted. No discrepancy.'),
]
