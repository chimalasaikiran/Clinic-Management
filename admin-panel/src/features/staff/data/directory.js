// Sample workforce directory until the staff API exists.
export const DIRECTORY_SUMMARY = [
  { label: 'Total people', value: '42', hint: 'verified personnel', foot: 'All credentialed profiles', badge: '+2 this qtr' },
  { label: 'Doctors', value: '18', hint: '42.8%', foot: 'Specialists & Generalists' },
  { label: 'Staff', value: '24', hint: '57.2%', foot: 'Nursing, Pharmacy, Tech & Admin' },
  { label: 'Active', value: '39', hint: 'on roster', foot: 'Operational across 3 branches' },
  { label: 'Inactive / leave', value: '3', hint: 'cases', foot: '2 Sabbatical / leave, 1 Off-boarded', badge: '3 Pending' },
]

export const DIRECTORY_TOTAL = 42

export const PEOPLE = [
  { id: 'julian-vance', initials: 'JV', tone: 'ink', name: 'Dr. Julian Vance, MD, MCh', staffCode: 'STF-001', registry: 'NMC-HYD-19682', type: 'Doctor', role: 'Chief Medical Proprietor & Lead Cardio Surgeon', department: 'Executive & Surgery', branches: ['Main Surgical Pavilion', 'Kondapur Clinic'], status: 'Active', verified: true },
  { id: 'ananya-rao', initials: 'AR', tone: 'teal', name: 'Dr. Ananya Rao, MBBS, MD, DM', staffCode: 'STF-088', registry: 'NMC-TS-2018-49021', type: 'Doctor', role: 'Consultant Interventional Cardiologist', department: 'Cardiology & Vascular Surgery', branches: ['Main Surgical Pavilion', 'Kondapur Clinic'], status: 'Active', verified: true },
  { id: 'rajesh-kannan', initials: 'RK', tone: 'ink', name: 'Dr. Rajesh Kannan, MD, DM', staffCode: 'STF-022', registry: 'MCI-49912', type: 'Doctor', role: 'Senior Neurologist', department: 'Neurology & Critical Care', branches: ['Main Surgical Pavilion', 'Kondapur Clinic'], status: 'Active', verified: true },
  { id: 'vikramaditya-sen', initials: 'VS', tone: 'indigo', name: 'Dr. Vikramaditya Sen, MS (Ortho)', staffCode: 'STF-031', registry: 'NMC-2012-6634', type: 'Doctor', role: 'Orthopaedic Surgeon', department: 'Orthopaedics', branches: ['Main Surgical Pavilion'], status: 'Active', verified: true },
  { id: 'priya-sharma', initials: 'PS', tone: 'blue', name: 'Priya Sharma, B.Sc Nursing', staffCode: 'STF-104', registry: 'INC-REG-4491', type: 'Staff', role: 'Head Nurse & Inpatient Triage Lead', department: 'Clinical Nursing & ICU', branches: ['Main Surgical Pavilion'], status: 'Active', verified: true },
  { id: 'suresh-patel', initials: 'SP', tone: 'amber', name: 'Suresh Patel, B.Pharm, D.Pharm', staffCode: 'STF-112', registry: 'PCI-TS-88410', type: 'Staff', role: 'Inpatient Chief Pharmacist (Form 20/21)', department: 'Pharmacy & Central Stores', branches: ['Main Surgical Pavilion', 'Metro North'], status: 'Active', verified: true },
  { id: 'rahul-kumar', initials: 'RK', tone: 'slate', name: 'Rahul Kumar', staffCode: 'STF-155', registry: 'EMP-8821', type: 'Staff', role: 'Senior Receptionist & OPD Billing', department: 'Reception & Front Desk', branches: ['Main Surgical Pavilion'], status: 'Active' },
  { id: 'kavita-deshmukh', initials: 'KD', tone: 'rose', name: 'Dr. Kavita Deshmukh, MD (Paed)', staffCode: 'STF-045', registry: 'NMC-2019-3312', type: 'Doctor', role: 'Visiting Paediatrician', department: 'Paediatrics', branches: ['Kondapur Clinic'], status: 'On Leave', leaveNote: 'Until 1 Oct', verified: true },
]

export const DIRECTORY_FILTERS = {
  type: ['Doctor', 'Staff'],
  department: ['Executive & Surgery', 'Cardiology & Vascular Surgery', 'Neurology & Critical Care', 'Orthopaedics', 'Clinical Nursing & ICU', 'Pharmacy & Central Stores', 'Reception & Front Desk', 'Paediatrics'],
  branch: ['Main Surgical Pavilion', 'Kondapur Clinic', 'Metro North'],
  status: ['Active', 'On Leave'],
}

// Departments offered by the Add person form.
export const DEPARTMENTS = ['Cardiology & Vascular', 'General Medicine', 'Neurology & Critical Care', 'Orthopaedics', 'Paediatrics', 'Pharmacy & Central Stores', 'Clinical Nursing & ICU', 'Reception & Front Desk', 'Administration']
export const MEDICAL_COUNCILS = ['National Medical Commission (NMC)', 'Telangana State Medical Council (TSMC)', 'Indian Nursing Council (INC)', 'Pharmacy Council of India (PCI)']
export const ENGAGEMENT_TYPES = [
  { value: 'full-time', title: 'Full-Time Consultant', detail: 'Core surgical faculty' },
  { value: 'visiting', title: 'Visiting Specialist', detail: 'Scheduled clinical sessions' },
  { value: 'honorary', title: 'Honorary / On-Call', detail: 'Emergency consults only' },
]
