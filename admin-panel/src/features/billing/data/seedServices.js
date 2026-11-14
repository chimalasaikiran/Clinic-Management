// Sample service catalogue for the billing workspace. `branches` holds, per branch, whether the service is offered
// and an optional custom price; a branch with no entry is "not configured".
const at = (main, kondapur, banjara) => Object.fromEntries(Object.entries({ main, kondapur, banjara }).filter(([, entry]) => entry))
const offered = (price) => ({ available: true, price })

const service = (code, name, category, department, price, tax, status, branches, extras = {}) => ({
  id: code.toLowerCase(), code, name, category, department, price, tax, taxConfig: tax === 'Exempt' ? 'Healthcare services — Exempt' : '', status, branches, description: '', updated: null, audit: [], ...extras,
})

export const SEED_SERVICES = [
  service('SRV-CARD-01', 'Cardiology Consultation (Initial OPD)', 'Consultation', 'Cardiology', 1000, 'Exempt', 'Active', at(offered(null), offered(null), null), { description: 'Comprehensive initial cardiac clinical assessment, cardiovascular risk evaluation, resting vitals examination, and preliminary management plan review by a consultant cardiologist.', unit: 'consultation' }),
  service('SRV-CARD-02', 'Cardiac Follow-up', 'Consultation', 'Cardiology', 600, 'Not configured', 'Active', at(offered(null), offered(null), null)),
  service('SRV-DIAG-03', '12-Lead Electrocardiogram (ECG)', 'Diagnostic & Lab', 'Diagnostic & Imaging', 450, 'Not configured', 'Active', at(offered(null), offered(null), offered(null))),
  service('SRV-CARD-04', '2D Transthoracic Echocardiography', 'Diagnostic & Lab', 'Cardiology', 2800, 'Not configured', 'Active', at(offered(null), null, null)),
  service('SRV-CARD-05', 'Treadmill Stress Test (TMT)', 'Diagnostic & Lab', 'Cardiology', 2200, 'Not configured', 'Active', at(offered(null), null, null)),
  service('SRV-GMED-01', 'General Physician Consultation', 'Consultation', 'General Medicine', 500, 'Not configured', 'Active', at(offered(null), offered(450), offered(450))),
  service('SRV-DIAG-08', 'Comprehensive Diabetic Health Panel', 'Diagnostic & Lab', 'Diagnostic & Imaging', 1800, 'Not configured', 'Active', at(offered(null), offered(null), null)),
  service('SRV-PED-01', 'Pediatric Well-Baby Examination', 'Consultation', 'Pediatrics', 750, 'Not configured', 'Active', at(offered(null), null, offered(null))),
  service('SRV-PHYS-01', 'Physiotherapy & Musculoskeletal Rehab', 'Therapy & Allied Health', 'Physiotherapy', 700, 'Not configured', 'Active', at(offered(null), offered(null), null)),
  service('SRV-DIAG-14', 'Sleep Study & Overnight Polysomnography', 'Diagnostic & Lab', '', 6500, 'Not configured', 'Inactive', at(null, null, null)),
]
