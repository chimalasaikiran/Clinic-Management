import type { IconName } from '@/theme/icons';

/** The topics the clinic sorts help requests by. Must match SUPPORT_CATEGORIES in the API. */
export const issueCategories: { value: string; icon: IconName; caption: string }[] = [
  { value: 'Account & Login', icon: 'tab-profile', caption: 'Sign-in codes, phone number, profile' },
  { value: 'Appointments', icon: 'tab-appointments', caption: 'Booking, moving or cancelling visits' },
  { value: 'Clinic Connect', icon: 'tab-clinics', caption: 'Connecting your clinic record' },
  { value: 'Health Records', icon: 'tab-health', caption: 'Consultations, care plans, history' },
  { value: 'Prescriptions & Reports', icon: 'module-prescriptions', caption: 'Medicines, refills, test results' },
  { value: 'Notifications', icon: 'bell', caption: 'Updates you get in the app' },
  { value: 'Privacy & Data', icon: 'shield-check', caption: 'Consents and who sees your records' },
  { value: 'Technical Problem', icon: 'info', caption: 'Something in the app is not working' },
  { value: 'Other', icon: 'help-circle', caption: 'Anything else' },
];

export const faqs = [
  {
    question: 'How do I book, move or cancel an appointment?',
    answer:
      'Open the Clinics tab, choose a clinic, then a service and a time. To move or cancel a booking, open it under Appointments. Changes can be made in the app until the appointment starts; after that, call the clinic.',
    topics: 'book visit cancel slot appointment reschedule move',
  },
  {
    question: 'When can I see my test results?',
    answer:
      'Open the Health tab, then Lab & Diagnostics. A result appears once your doctor has reviewed it. Until then you can follow the test’s progress under Diagnostic Orders.',
    topics: 'lab report results test',
  },
  {
    question: 'How do I get a refill of my medicine?',
    answer:
      'Open the Health tab, then Prescriptions, and open the prescription. Tap Request Refill. The clinic will approve or decline it in the app; if approved, collect it at the clinic pharmacy.',
    topics: 'refill medicine prescription pharmacy',
  },
  {
    question: 'Why can I not see my records from a clinic?',
    answer:
      'Your account connects to a clinic record when your mobile number and date of birth match the clinic’s record. If that does not happen, ask the clinic’s reception desk for a connection code and enter it under Profile, then Security.',
    topics: 'connect clinic code record link',
  },
  {
    question: 'I did not receive my sign-in code. What should I do?',
    answer: 'Wait for the countdown to finish and ask for a new code by SMS. Check that the number shown is yours. If it still does not arrive, call your clinic.',
    topics: 'otp login code sms',
  },
  {
    question: 'Is ABHA (national health ID) linking available?',
    answer: 'Not yet. Your records are kept by each clinic you are connected to, and only you and that clinic can see them in the app.',
    topics: 'abdm abha privacy data',
  },
];

export const popularSearches = ['Book visit', 'Test results', 'Refill', 'Connect clinic'];
