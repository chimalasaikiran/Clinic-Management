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

