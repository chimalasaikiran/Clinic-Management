// Fixed option lists for the staff forms.
export const DEPARTMENTS = ['Cardiology & Vascular', 'General Medicine', 'Neurology & Critical Care', 'Orthopaedics', 'Paediatrics', 'Physical Medicine & Rehab', 'Pharmacy & Central Stores', 'Clinical Nursing & ICU', 'Reception & Front Desk', 'Administration']
export const MEDICAL_COUNCILS = ['National Medical Commission (NMC)', 'Telangana State Medical Council (TSMC)', 'Indian Nursing Council (INC)', 'Pharmacy Council of India (PCI)']
export const ENGAGEMENT_TYPES = [
  { value: 'full_time', title: 'Full-Time Consultant', detail: 'Core clinical faculty' },
  { value: 'visiting', title: 'Visiting Specialist', detail: 'Scheduled clinical sessions' },
  { value: 'honorary', title: 'Honorary / On-Call', detail: 'Emergency consults only' },
]

export const EXCEPTION_TYPES = [
  { value: 'leave', title: 'Planned Leave', detail: 'Whole days away' },
  { value: 'block', title: 'Temporary Block', detail: 'Procedure / meeting hours' },
  { value: 'relief', title: 'Emergency Relief', detail: 'Immediate notice' },
]

export const ATTENDANCE_STATUSES = ['Present', 'Late', 'Absent', 'Leave', 'Unavailable']
