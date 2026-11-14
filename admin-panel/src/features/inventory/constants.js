// "Now" for the stock sample data. Real builds read the clock; the seeded records are dated around this moment.
export const NOW = { date: '2026-10-20', time: '11:30' }

export const NEAR_EXPIRY_DAYS = 90

export const LOCATIONS = [
  { id: 'central', name: 'Central Stores', detail: 'Receiving bay C-01', kind: 'store' },
  { id: 'main', name: 'Main Pharmacy', detail: 'Downtown Metro · #01', kind: 'pharmacy' },
  { id: 'opd', name: 'OPD Pharmacy', detail: 'Downtown · #02', kind: 'pharmacy' },
  { id: 'er', name: 'ER Pharmacy', detail: 'Downtown · #03', kind: 'pharmacy' },
]

export const PHARMACIES = LOCATIONS.filter((location) => location.kind === 'pharmacy')

export const locationName = (id) => LOCATIONS.find((location) => location.id === id)?.name ?? id

export const TRANSFER_REASONS = ['Routine replenishment', 'Stockout / below safety buffer', 'Emergency requirement', 'Rebalancing between locations']
export const ADJUSTMENT_REASONS = ['Damaged packs written off', 'Count variance', 'Expired stock removal', 'Found stock', 'Other (explain in evidence)']
export const DISCREPANCY_REASONS = ['Supplier short shipment', 'Damaged in transit', 'Wrong item delivered', 'Wrong batch / expiry']
export const DISCREPANCY_RESOLUTIONS = ['Keep balance open on PO', 'Close PO as short', 'Request replacement / credit note']
export const PAYMENT_TERMS = ['Net 15', 'Net 30', 'Net 45', 'Advance payment']
export const SUPPLIER_CATEGORIES = ['Medicines', 'Consumables', 'IV fluids', 'Equipment']
export const BINS = ['A-03', 'A-04', 'B-01', 'B-02', 'C-01']
export const REQUEST_REASONS = ['Routine replenishment', 'Replenishment · Stockout / below safety buffer', 'Emergency requirement', 'Event / camp supply']
export const REQUEST_PRIORITIES = ['Normal', 'Urgent']

// Request status → label shown in the inventory queues (the pharmacy side uses the plain status).
export const REQUEST_STATUS_TONE = {
  Draft: 'neutral',
  Submitted: 'warning',
  Approved: 'info',
  'Partially approved': 'info',
  Dispatched: 'warning',
  'Partially fulfilled': 'warning',
  Fulfilled: 'success',
  Rejected: 'danger',
  Cancelled: 'neutral',
}
