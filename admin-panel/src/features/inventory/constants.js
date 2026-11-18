import { localClock, localToday } from '../patients/format'

// "Now" on this device, read each time it is used.
export const NOW = {
  get date() {
    return localToday()
  },
  get time() {
    return localClock()
  },
}

export const NEAR_EXPIRY_DAYS = 90

// The organisation's stock locations, loaded from the API by StockProvider (see setLocations). The arrays are
// filled in place so the many screens that import them keep working without passing them down.
export const LOCATIONS = []
export const PHARMACIES = []
const selection = { dispensary: null }

export function setLocations(locations, dispensary) {
  LOCATIONS.splice(0, LOCATIONS.length, ...locations)
  PHARMACIES.splice(0, PHARMACIES.length, ...locations.filter((location) => location.kind === 'pharmacy' && location.active))
  selection.dispensary = PHARMACIES.some((location) => location.id === dispensary) ? dispensary : PHARMACIES[0]?.id ?? null
}

// The store that supplies the pharmacies (the first store), and the pharmacy this screen dispenses from.
export const centralId = () => LOCATIONS.find((location) => location.kind === 'store' && location.active)?.id ?? null
export const dispensaryId = () => selection.dispensary

export const locationName = (id) => LOCATIONS.find((location) => location.id === id)?.name ?? id

export const TRANSFER_REASONS = ['Routine replenishment', 'Stockout / below safety buffer', 'Emergency requirement', 'Rebalancing between locations']
export const ADJUSTMENT_REASONS = ['Damaged packs written off', 'Count variance', 'Expired stock removal', 'Found stock', 'Other (explain in evidence)']
export const DISCREPANCY_REASONS = ['Supplier short shipment', 'Damaged in transit', 'Wrong item delivered', 'Wrong batch / expiry']
export const DISCREPANCY_RESOLUTIONS = ['Keep balance open on PO', 'Close PO as short', 'Request replacement / credit note']
export const PAYMENT_TERMS = ['Net 15', 'Net 30', 'Net 45', 'Advance payment']
export const ITEM_CATEGORIES = ['Analgesic', 'Antibiotic / Anti-infective', 'Antidiabetic', 'Antihistamine', 'Cardiovascular', 'Gastro', 'Respiratory', 'Endocrine', 'Emergency', 'IV fluids', 'Consumables', 'Other']
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
