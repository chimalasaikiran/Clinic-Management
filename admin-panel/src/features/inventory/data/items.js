// Item master for the sample stock data. `safety` is the pharmacy-level buffer, `reorder` the central-store threshold.
const item = (id, name, category, unit, extras) => ({ id, name, category, unit, unitPlural: `${unit}s`, ...extras })

export const ITEMS = [
  item('MED-00124', 'Paracetamol 500mg', 'Analgesic', 'tablet', { dose: 'Tablet', reorder: 500, target: 2000, safety: 150, price: 1.2, pack: '10 tablets', storage: 'Ambient, below 25°C', suppliers: ['SUP-0018', 'SUP-0006'], preferred: 'SUP-0018' }),
  item('MED-00218', 'Cetirizine 10mg', 'Antihistamine', 'tablet', { dose: 'Tablet', reorder: 200, target: 800, safety: 100, price: 1.5, pack: '10 tablets', storage: 'Ambient, below 25°C', suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-00306', 'Amlodipine 5mg', 'Cardiovascular', 'tablet', { dose: 'Tablet', reorder: 300, target: 1000, safety: 100, price: 2.1, pack: '15 tablets', storage: 'Ambient, below 25°C', suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-00172', 'Metformin 500mg', 'Antidiabetic', 'tablet', { dose: 'Tablet', reorder: 400, target: 1200, safety: 100, price: 1.8, pack: '10 tablets', storage: 'Ambient, below 25°C', suppliers: ['SUP-0018'], preferred: 'SUP-0018' }),
  item('CON-00042', 'Examination gloves · M', 'Consumables', 'box', { dose: 'Box of 100', unitPlural: 'boxes', reorder: 100, target: 400, safety: 20, price: 240, pack: '100 gloves', storage: 'Dry store', suppliers: ['SUP-0031'], preferred: 'SUP-0031' }),
  item('MED-00451', 'Normal saline 500ml', 'IV fluids', 'bottle', { dose: 'Bottle', reorder: 100, target: 300, safety: 30, price: 38, pack: '1 bottle', storage: 'Ambient', suppliers: ['SUP-0031'], preferred: 'SUP-0031' }),
  item('MED-EM-ATR-006', 'Atropine 0.6mg/1ml', 'Emergency', 'ampoule', { dose: 'Injection · Crash cart', reorder: 30, target: 150, safety: 10, price: 28, pack: '1 ampoule', storage: 'Crash cart', suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-CV-TEL-040', 'Telmisartan 40mg', 'Antihypertensive', 'tablet', { dose: 'Tablet · Antihypertensive', reorder: 400, target: 1500, safety: 100, price: 6.5, pack: '15 tablets', storage: 'Ambient', suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-CV-RAM-005', 'Ramipril 5mg', 'Cardiovascular', 'tab', { brand: 'Cardace 5mg (Sanofi India Ltd)', safety: 60, reorder: 300, target: 900, price: 5.2, schedule: 'Schedule H', suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-CV-ATV-040', 'Atorvastatin 40mg', 'Statin', 'tab', { brand: 'Lipitor 40mg (Viatris Healthcare)', safety: 60, reorder: 300, target: 900, price: 9.4, schedule: 'Schedule H', suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-CV-ECO-075', 'Ecosprin 75mg', 'Antiplatelet', 'tab', { brand: 'Ecosprin 75 (USV Pvt Ltd)', safety: 60, reorder: 300, target: 900, price: 1.6, suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-GI-OMP-020', 'Omeprazole 20mg', 'Gastro', 'cap', { brand: 'Prilosec equivalent (Omez)', safety: 40, reorder: 200, target: 600, price: 3, suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-GI-SUC-010', 'Sucralfate syrup 10ml', 'Gastro', 'bottle', { safety: 10, reorder: 40, target: 120, price: 88, suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-RS-LVX-500', 'Levofloxacin 500mg', 'Anti-infective', 'tab', { safety: 30, reorder: 100, target: 400, price: 14, schedule: 'Schedule H1', suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-RS-AMB-030', 'Ambroxol 30mg/5ml', 'Respiratory', 'bottle', { safety: 10, reorder: 40, target: 120, price: 62, suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-DM-MSR-500', 'Metformin 500mg SR', 'Antidiabetic', 'tab', { safety: 60, reorder: 300, target: 900, price: 2.6, suppliers: ['SUP-0018'], preferred: 'SUP-0018' }),
  item('MED-DM-GLM-001', 'Glimepiride 1mg', 'Antidiabetic', 'tab', { safety: 40, reorder: 200, target: 600, price: 3.4, suppliers: ['SUP-0018'], preferred: 'SUP-0018' }),
  item('MED-EN-ACT-012', 'Human Actrapid 100IU', 'Endocrine', 'vial', { dose: 'Injection · Cold chain', safety: 6, reorder: 40, target: 120, price: 145, storage: 'Cold chain 2–8°C', suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-AB-CTX-1G', 'Ceftriaxone 1g', 'Anti-infective', 'vial', { safety: 20, reorder: 100, target: 300, price: 62, suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-EM-ADR-001', 'Adrenaline 1mg/1ml', 'Emergency', 'ampoule', { safety: 10, reorder: 30, target: 100, price: 22, suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-AB-AZI-500', 'Azithromycin 500mg', 'Anti-infective', 'tablet', { safety: 60, reorder: 200, target: 600, price: 19, suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-AB-AMX-500', 'Amoxicillin 500mg', 'Anti-infective', 'capsule', { safety: 60, reorder: 200, target: 600, price: 7.5, suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-GI-PAN-040', 'Pantoprazole 40mg', 'Gastro', 'tablet', { safety: 60, reorder: 200, target: 600, price: 5, suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-GI-OND-004', 'Ondansetron 4mg/2ml', 'Gastro', 'ampoule', { safety: 10, reorder: 40, target: 120, price: 12, suppliers: ['SUP-0006'], preferred: 'SUP-0006' }),
  item('MED-IV-DEX-025', 'Dextrose 25% 100ml', 'IV fluids', 'bottle', { safety: 10, reorder: 40, target: 120, price: 46, suppliers: ['SUP-0031'], preferred: 'SUP-0031' }),
]

export const itemById = (id) => ITEMS.find((entry) => entry.id === id)

export const unitLabel = (entry, quantity) => (quantity === 1 ? entry.unit : entry.unitPlural)
