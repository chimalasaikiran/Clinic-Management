/** Sample patient used until the app is connected to a service. */
export const patient = {
  name: 'Keerthi Sagar',
  initials: 'KS',
  email: 'keerthi.sagar@example.com',
  phone: '9876543210',
  abha: '91-8402-1192-31',
  patientId: '#PT-10284',
};

export const sexOptions = [
  { value: 'Female', icon: 'female' },
  { value: 'Male', icon: 'male' },
  { value: 'Other', icon: 'transgender' },
] as const;

export type Sex = (typeof sexOptions)[number]['value'];

export const bloodGroups = ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-', 'AB-', "Don't know"];

export const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
