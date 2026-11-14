// Sample OPD bookings for the working day (2026-10-12) across the consulting chambers. Ananya Sharma's own
// 10:30 appointment lives with her visit history and appears in the same grid.
const DAY = '2026-10-12'
const MAIN = { branch: 'Main Surgical Pavilion', campus: 'Kondapur Campus' }
const DOCTORS = {
  'rahul-mehta': { doctor: 'Dr. Rahul Mehta, MD, DM', doctorShort: 'Dr. Rahul Mehta', specialty: 'Interventional Cardiologist', department: 'Cardiology OPD', room: 'Chamber 101' },
  'ananya-rao': { doctor: 'Dr. Ananya Rao, MD', doctorShort: 'Dr. Ananya Rao', specialty: 'Cardiology', department: 'Cardiology OPD', room: 'Chamber 102' },
  'sarita-nambiar': { doctor: 'Dr. Sarita V. Nambiar, MD', doctorShort: 'Dr. Sarita V. Nambiar', specialty: 'General Medicine', department: 'OPD General Medicine', room: 'Chamber 103' },
  'rajesh-nair': { doctor: 'Dr. Rajesh K. Nair, MD', doctorShort: 'Dr. Rajesh K. Nair', specialty: 'Internal Medicine', department: 'Internal Medicine', room: 'Chamber 104' },
}

let sequence = 0
const booking = (patientId, doctorId, time, status, reason, extras = {}) => ({
  id: `APT-DAY-${String(++sequence).padStart(3, '0')}`, patientId, date: DAY, time, minutes: 30, type: extras.type ?? 'Consultation', mode: extras.mode ?? 'In-Person Clinical Consultation',
  service: extras.service ?? 'OPD Consultation', serviceCode: 'SRV-GM-001', tariff: extras.tariff ?? 1200, doctorId, ...DOCTORS[doctorId], ...MAIN, status, reason,
  bookedBy: 'Priya Nair (Reception)', channel: extras.channel ?? 'Reception / In-Person Intake', audit: [], ...extras.rest,
})

export const SEED_DAY_APPOINTMENTS = [
  booking('pt-000219', 'rahul-mehta', '09:00', 'Completed', 'Follow-up ECG review', { service: 'Cardiology Consultation', tariff: 1500, type: 'Follow-up' }),
  booking('pt-000844', 'rahul-mehta', '09:30', 'Completed', 'Hypertension consult, Rx dispatched', { service: 'Cardiology Consultation', tariff: 1500 }),
  booking('pt-000671', 'rahul-mehta', '10:00', 'Arrived', 'Post-angioplasty review, suture line check', { service: 'Cardiology Consultation', tariff: 1500, type: 'Follow-up', rest: { queueToken: 'A-17', arrivedAt: '09:52' } }),
  booking('pt-000528', 'ananya-rao', '09:00', 'Completed', 'Annual cardiac screening', { service: 'Cardiology Consultation', tariff: 1500 }),
  booking('pt-000412', 'ananya-rao', '10:00', 'Confirmed', 'Dyspnea evaluation', { service: 'Cardiology Consultation', tariff: 1500 }),
  booking('pt-000789', 'ananya-rao', '10:30', 'Pending Confirmation', 'Paediatric cardiac clearance (tele-booking)', { mode: 'Tele-consultation', channel: 'Patient Portal', service: 'Cardiology Consultation', tariff: 1500 }),
  booking('pt-000305', 'sarita-nambiar', '09:00', 'Completed', 'Antenatal follow-up', { service: 'General Medicine Consultation', tariff: 800 }),
  booking('pt-000528', 'sarita-nambiar', '10:00', 'Arrived', 'Hypertension follow-up, kiosk vitals ready', { service: 'General Medicine Consultation', tariff: 800, type: 'Follow-up', rest: { queueToken: 'A-18', arrivedAt: '09:58' } }),
  booking('pt-000219', 'sarita-nambiar', '11:00', 'Scheduled', 'Geriatric multi-morbidity review', { service: 'General Medicine Consultation', tariff: 800 }),
  booking('pt-000844', 'rajesh-nair', '09:30', 'No-show', 'Annual health screening', { service: 'Internal Medicine Consultation', tariff: 900 }),
  booking('pt-000671', 'rajesh-nair', '10:30', 'Scheduled', 'Diabetes review, HbA1c 8.2', { service: 'Internal Medicine Consultation', tariff: 900 }),
]
