// Sample reporting cohorts standing in for the appointment and pharmacy reporting services.
export const REPORT_PERIOD = { label: '01–25 Oct 2026', from: '2026-10-01', to: '2026-10-25' }

export const OPERATIONS = {
  windows: [
    { label: '01–07 Oct', completed: 37, cancelled: 5, noShow: 3, rescheduled: 5 },
    { label: '08–14 Oct', completed: 38, cancelled: 4, noShow: 2, rescheduled: 6 },
    { label: '15–21 Oct', completed: 36, cancelled: 6, noShow: 3, rescheduled: 5 },
    { label: '22–25 Oct · 4 days', completed: 39, cancelled: 5, noShow: 2, rescheduled: 4 },
  ],
  waitMinutes: 1800,
  waitPairs: 120,
  rebooking: { replaced: 12, mature: 24, immature: 6 },
  doctors: [
    { name: 'Dr. Rahul Mehta', consultMinutes: 3600, availableMinutes: 4800 },
    { name: 'Dr. Priya Nair', consultMinutes: 3600, availableMinutes: 4800 },
  ],
  services: [
    { name: 'General', count: 90 },
    { name: 'Specialist', count: 60 },
  ],
}

const sku = (name, category, stock, unit, reorder, batch, expiry, buy, sell, status) => ({ name, category, stock, unit, reorder, batch, expiry, buy, sell, status })

export const PHARMACY = {
  items: [
    sku('Paracetamol 500mg', 'Analgesic', 500, 'tablets', 300, 'PCM-0926', '2026-11-20', 1.2, 2, 'Near expiry'),
    sku('Cetirizine 10mg', 'Antihistamine', 80, 'tablets', 200, 'CTZ-0526', '2027-05-31', 0.8, 1.5, 'Low stock'),
    sku('Amlodipine 5mg', 'Cardiovascular', 240, 'tablets', 300, 'AML-0826', '2027-08-31', 1.5, 3, 'Low stock'),
    sku('Metformin 500mg', 'Antidiabetic', 640, 'tablets', 400, 'MET-0726', '2027-07-31', 2, 3.5, 'In stock'),
    sku('Atropine 0.6mg/1ml', 'Emergency injectable', 0, 'ampoules', 10, 'ATP-0626', '2027-06-30', 12, 18, 'Out of stock'),
    sku('Human insulin 100IU/ml', 'Cold chain', 6, 'vials', 4, 'INS-1026', '2026-11-15', 180, 240, 'Near expiry'),
    sku('Examination gloves M', 'Consumables', 25, 'boxes', 20, 'GLV-0426', '2028-04-30', 90, 130, 'In stock'),
    sku('Normal saline 500ml', 'IV fluids', 180, 'bottles', 100, 'NS-1026', '2027-10-31', 17, 26.5, 'In stock'),
  ],
  dispensing: [{ label: '01–07 Oct', value: 250 }, { label: '08–14 Oct', value: 320 }, { label: '15–21 Oct', value: 360 }, { label: '22–25 Oct · 4 days', value: 320 }],
  purchases: [{ label: '01–07 Oct', value: 4200 }, { label: '08–14 Oct', value: 5650 }, { label: '15–21 Oct', value: 4800 }, { label: '22–25 Oct · 4 days', value: 5600 }],
  categories: [
    { name: 'Oral medicines', sales: 2600, cogs: 1465, purchases: 8700 },
    { name: 'Injectables & IV fluids', sales: 4335, cogs: 2790, purchases: 5700 },
    { name: 'Cold chain', sales: 2400, cogs: 1800, purchases: 3600 },
    { name: 'Consumables', sales: 2600, cogs: 1800, purchases: 2250 },
  ],
  exceptions: [
    { item: 'Paracetamol 500mg', branch: 'Main Pharmacy', quantity: '500 tablets', batch: 'PCM-0926', date: '20 Nov 2026', urgency: 'Near expiry', action: 'Review FEFO and transfer before expiry with authorized stock movement.' },
    { item: 'Human insulin 100IU/ml', branch: 'Main Pharmacy', quantity: '6 vials', batch: 'INS-1026', date: '15 Nov 2026', urgency: 'Near expiry', action: 'Review FEFO and transfer before expiry with authorized stock movement. Cold chain handling required.' },
    { item: 'Atropine 0.6mg/1ml', branch: 'Main Surgical Pavilion', quantity: '0 ampoules', batch: 'ATP-0626', date: '24 Oct 14:20', urgency: 'Urgent', action: 'Open incident · request existing Stock Request or branch transfer with authorized replenishment.' },
    { item: 'Cetirizine 10mg', branch: 'Main Pharmacy', quantity: '80 tablets', batch: 'CTZ-0526', date: '10 Oct 09:10', urgency: 'Resolved', action: 'Incident closed 10 Oct 15:40 after posted receipt. Review reorder policy.' },
  ],
}
