import { parseDay } from '@/lib/dates';
import type { Address, Appointment, AppointmentStatus } from '@/types';

/** The clinic's calendar day (India), whatever time zone the phone is set to. */
export const clinicToday = (now = new Date()) => new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);

/** "14:30" as "02:30 PM". */
export function clock(time: string): string {
  const hour = Number(time.slice(0, 2));
  return `${String(hour % 12 || 12).padStart(2, '0')}:${time.slice(3, 5)} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** "Today", "Tomorrow", "In 3 days" or "2 days ago". */
export function relativeDay(iso: string, today = clinicToday()): string {
  const days = Math.round((parseDay(iso).getTime() - parseDay(today).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

export const rupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

/** What the patient was quoted when they booked; visits the desk booked have no quoted fee. */
export const feeText = (fee: number | null) => (fee === null ? 'Confirm at the clinic' : rupees(fee));

export const addressText = (place: Address) =>
  [place.addressLine1, place.addressLine2, place.city, place.state, place.pinCode].filter(Boolean).join(', ');

export function directionsUrl(place: Address & { latitude: number | null; longitude: number | null }, name: string) {
  const query = place.latitude !== null && place.longitude !== null ? `${place.latitude},${place.longitude}` : `${name}, ${addressText(place)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export const STATUS_TEXT: Record<AppointmentStatus, string> = {
  pending: 'Waiting for the clinic to confirm',
  confirmed: 'Confirmed',
  arrived: 'Checked in',
  in_progress: 'In consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Missed',
};

export const statusTone = (status: AppointmentStatus) =>
  status === 'cancelled' || status === 'no_show' ? ('red' as const) : status === 'pending' ? ('amber' as const) : status === 'completed' ? ('mint' as const) : ('sky' as const);

export const isUpcoming = (appointment: Appointment) => ['pending', 'confirmed', 'arrived', 'in_progress'].includes(appointment.status);

export const doctorLine = (practitioner: Appointment['practitioner']) =>
  [practitioner.displayName, practitioner.credentials].filter(Boolean).join(', ');
