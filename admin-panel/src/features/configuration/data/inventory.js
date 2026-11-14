// Sample branch inventory configuration until the inventory API exists.
export const INVENTORY_LOCATIONS = [
  { id: 'main-pharmacy', name: 'Main Pharmacy', detail: 'Central Dispensary, Ground Floor, Room G-04', type: 'Pharmacy', status: 'Active', protocol: 'Enabled (Full Batch & Expiry)', protocolNote: 'FEFO Picking · Batch trace on dispensation' },
  { id: 'opd-dispensary', name: 'Outpatient Dispensary', detail: 'Clinic Wing A, Front Desk OPD', type: 'Dispensary', status: 'Active', protocol: 'Enabled (Dispense Only)', protocolNote: 'Stock from Central hub allocations' },
  { id: 'sterile-store', name: 'Sterile Surgical Storage Room', detail: 'Floor 2, OT Complex Wing', type: 'Storage', status: 'Active', protocol: 'Enabled (Restricted Access)', protocolNote: 'Batch tracking for implants & sensitive drugs' },
  { id: 'trauma-store', name: 'Emergency Crash Cart & Trauma Bay Stock', detail: 'Trauma Unit, Room 01', type: 'Emergency Reserve', status: 'Active', protocol: 'Enabled (Audit Required)', protocolNote: 'Mandatory expiry audit on every restock' },
]

export const LOCATION_TYPES = [
  'Storage (Medical consumables, surgical kits & procedural pick-up)',
  'Pharmacy (Dispensing counter)',
  'Dispensary (Outpatient)',
  'Emergency Reserve',
]

export const STOCK_GOVERNANCE = [
  { id: 'batch', title: 'Batch tracking', badge: 'Mandatory', detail: 'Enforces unique manufacturer batch ID assignment on all stock-in, so stock can be traced to chambers or pharmacies.', locked: true },
  { id: 'expiry', title: 'Expiry tracking (FEFO)', badge: 'Mandatory', detail: 'Mandates FEFO (first-expiry, first-out) picking and proactively flags formulations within 90 days of operational expiration.', locked: true },
  { id: 'serial', title: 'Serial number tracking', badge: 'Optional', detail: 'High-value implant and specialized surgical inventory each tracked by a unique serial ID.', defaultOn: false },
  { id: 'barcode', title: 'Barcode / QR validation at intake', badge: 'Recommended', detail: 'Scans and validates GS1 barcode codes during receipt validation to pre-verify provenance in the ABDM registry.', defaultOn: true },
]

export const STOCK_ALERTS = [
  { id: 'low', title: 'Low-stock threshold alerts', badge: 'Automatic', detail: 'Generates operational notifications when any SKU drops below the configured reorder safety stock.', field: 'Default floor', value: '25', unit: 'units' },
  { id: 'velocity', title: 'Reorder buffer velocity monitoring', detail: 'Flags automated replenishment drafts in procurement leads when inventory velocity days fall below 15-day run rate.', field: 'Velocity run rate', value: '15', unit: 'days' },
  { id: 'emergency', title: 'Emergency stock depletion beacon', badge: 'Priority 0', detail: 'Escalates high-priority crash inventory for Trauma Bay, surgical consoles, and SMS gateways for life-saving formulations.', defaultOn: true },
]

export const INVENTORY_ROLES = [
  { id: 'admins', title: 'Inventory Administrators', count: 2, detail: 'Full configuration rights, route commissioning, master auditing.', people: 'Dr. Siddharth Verma, Vikram Sethi' },
  { id: 'pharmacists', title: 'Pharmacists & Dispensary Leads', count: 4, detail: 'Dispense authorization, post-dispense batch tracking and ledger posting.', people: 'Suresh Patel, Farhan Akhtar (+2 others)' },
  { id: 'viewers', title: 'Clinical Stock Viewers', count: 6, detail: 'Read-only availability checks for OPD chambers (Floor 2 & Theatres).', people: 'All chamber doctors' },
]
