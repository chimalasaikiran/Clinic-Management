import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useResource } from '@/hooks/useResource';
import { errorMessage } from '@/lib/api';
import { useSession, useSignedIn } from '@/state/SessionState';

import { Glyph, ProfileButton, RoundButton, type ChipTone } from './ui';

/** What the front desk reads from the API. Reception never receives clinical detail. */

export type AppointmentStatus = 'pending' | 'confirmed' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
export type AppointmentType = 'consultation' | 'follow_up' | 'procedure' | 'diagnostic_review';
export type Gender = 'male' | 'female' | 'other';

export type PatientBrief = { id: string; fullName: string; mrn: string; gender: Gender; dateOfBirth: string };

export type DayAppointment = {
  id: string;
  reference: string;
  status: AppointmentStatus;
  type: AppointmentType;
  time: string;
  durationMinutes: number;
  token: string | null;
  waitingQueue: boolean;
  arrivedAt: string | null;
  arrivedTime: string | null;
  reason: string;
  patient: PatientBrief;
  practitioner: { id: string; displayName: string; department: string; room: string | null };
  branch: { id: string; name: string };
};

export type DayEvent = {
  id: string;
  action: string;
  time: string;
  actor: string;
  appointmentId: string;
  token: string | null;
  patient: { id: string; fullName: string };
};

export type Day = {
  date: string;
  today: string;
  timeZone: string;
  generatedAt: string;
  branches: { id: string; name: string; city: string | null }[];
  appointments: DayAppointment[];
  events: DayEvent[];
};

export type AppointmentEvent = {
  id: string;
  action: string;
  fromStatus: AppointmentStatus | null;
  toStatus: AppointmentStatus | null;
  from: { date: string; time: string } | null;
  to: { date: string; time: string } | null;
  reason: string | null;
  note: string | null;
  actor: string;
  at: string;
  date: string;
  time: string;
};

export type Appointment = {
  id: string;
  reference: string;
  status: AppointmentStatus;
  type: AppointmentType;
  channel: 'reception' | 'phone' | 'portal' | 'referral' | 'walk_in';
  waitingQueue: boolean;
  date: string;
  time: string;
  endTime: string;
  durationMinutes: number;
  patient: PatientBrief & { mobile: string; status: string };
  practitioner: { id: string; displayName: string; credentials: string | null; specialty: string; department: string; room: string | null; slotMinutes: number };
  branch: { id: string; name: string; city: string | null };
  reason: string;
  internalNote: string | null;
  notifyWhatsapp: boolean;
  notifySms: boolean;
  queueToken: string | null;
  arrivedAt: string | null;
  closedReason: string | null;
  bookedBy: string;
  service: string | null;
  createdAt: string;
  version: number;
  events?: AppointmentEvent[];
};

export type Patient = {
  id: string;
  mrn: string;
  title: string;
  fullName: string;
  alias: string | null;
  abhaNumber: string | null;
  mobile: string;
  altMobile: string | null;
  email: string | null;
  addressLine: string | null;
  area: string | null;
  city: string | null;
  state: string | null;
  pinCode: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: string | null;
  language: string | null;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
  notifyWhatsapp: boolean;
  notifySms: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  version: number;
  homeBranch: { id: string; name: string };
  lastVisit: { date: string; practitioner: string; department: string } | null;
};

export type Practitioner = {
  id: string;
  displayName: string;
  credentials: string | null;
  specialty: string;
  department: string;
  room: string | null;
  slotMinutes: number;
  status: 'active' | 'inactive';
  /** Weekly consulting hours; weekday 0 is Sunday. */
  availability: { branchId: string; branchName: string; weekday: number; start: string; end: string }[];
};

export type SlotState = 'available' | 'booked' | 'past' | 'unavailable';
export type Slots = { slotMinutes: number; days: { date: string; slots: { time: string; state: SlotState }[]; closed?: string }[] };

export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number };

// ---- Reading ----

/** The day's list for the desk, reloaded whenever an appointment changes anywhere in the clinic. */
export const useDay = (date?: string) =>
  useResource<Day>(`/v1/dashboard/day${date ? `?date=${date}` : ''}`, ['appointments']);

// ---- Formatting ----

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const parts = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return { year, month, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
};

/** 2026-10-26 → Mon, 26 Oct (with the year when asked). */
export function dayLabel(iso: string, withYear = false) {
  const { year, month, day, weekday } = parts(iso);
  return `${WEEKDAYS[weekday]}, ${day} ${MONTHS[month - 1]}${withYear ? ` ${year}` : ''}`;
}

export const weekdayOf = (iso: string) => WEEKDAYS[parts(iso).weekday]!;
export const dayOfMonth = (iso: string) => String(parts(iso).day);

/** Today's date on this phone, which is at the clinic. */
export function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function addDays(iso: string, days: number) {
  const { year, month, day } = parts(iso);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** 14:05 → 02:05 PM. */
export function clock(time: string | null | undefined) {
  if (!time) return '';
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  const hour = hours % 12 || 12;
  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
}

export function yearsOld(dateOfBirth: string, today: string) {
  const born = parts(dateOfBirth);
  const now = parts(today);
  return now.year - born.year - (now.month < born.month || (now.month === born.month && now.day < born.day) ? 1 : 0);
}

const SEX = { male: 'M', female: 'F', other: 'O' } as const;
export const GENDER_LABEL = { male: 'Male', female: 'Female', other: 'Other' } as const;

/** 31F, or 8M for a child. Ages under a year are shown in months. */
export function ageSex(patient: { dateOfBirth: string; gender: Gender }, today: string) {
  const years = yearsOld(patient.dateOfBirth, today);
  if (years >= 1) return `${years}${SEX[patient.gender]}`;
  const born = parts(patient.dateOfBirth);
  const now = parts(today);
  const months = Math.max(0, (now.year - born.year) * 12 + now.month - born.month - (now.day < born.day ? 1 : 0));
  return `${months}mo ${SEX[patient.gender]}`;
}

export function initialsOf(name: string) {
  const words = name.replace(/^(dr|mr|mrs|ms)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words.length > 1 ? (words.at(-1)?.[0] ?? '') : '')).toUpperCase() || '?';
}

/** +91 98765 43210. */
export function phone(mobile: string | null | undefined) {
  if (!mobile) return '';
  const digits = mobile.replace(/\D/g, '').slice(-10);
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export const telOf = (mobile: string) => `+91${mobile.replace(/\D/g, '').slice(-10)}`;

/** Whole minutes since an instant, never negative. */
export const minutesSince = (instant: string, now: number) => Math.max(0, Math.floor((now - new Date(instant).getTime()) / 60_000));

export const TYPE_LABEL: Record<AppointmentType, string> = {
  consultation: 'Consultation',
  follow_up: 'Follow-up',
  procedure: 'Procedure',
  diagnostic_review: 'Diagnostic Review',
};

export const STATUS: Record<AppointmentStatus, { label: string; tone: ChipTone; rail: string }> = {
  pending: { label: 'Pending Confirmation', tone: 'red', rail: '#ba1a1a' },
  confirmed: { label: 'Confirmed', tone: 'pale', rail: '#c3d0d6' },
  arrived: { label: 'Arrived · Waiting', tone: 'amber', rail: '#f59e0b' },
  in_progress: { label: 'In Chamber', tone: 'mint', rail: '#10b981' },
  completed: { label: 'Completed', tone: 'green', rail: '#059669' },
  cancelled: { label: 'Cancelled', tone: 'red', rail: '#ba1a1a' },
  no_show: { label: 'No-show', tone: 'steel', rail: '#64748b' },
};

/** Statuses the desk can still act on today. */
export const isOpen = (status: AppointmentStatus) => status === 'pending' || status === 'confirmed';
export const isPresent = (status: AppointmentStatus) => status === 'arrived' || status === 'in_progress';

export function practitionerLine(practitioner: { displayName: string; department: string; room: string | null }) {
  return [practitioner.displayName, practitioner.department, practitioner.room].filter(Boolean).join(' · ');
}

/** Minutes past midnight at the clinic, whatever time zone the phone is set to. */
export function clinicMinute(now: number, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now));
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return value('hour') * 60 + value('minute');
  } catch {
    const local = new Date(now);
    return local.getHours() * 60 + local.getMinutes();
  }
}

export const minuteOf = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number) as [number, number];
  return hours * 60 + minutes;
};

/** A minute-precision clock that ticks, for waiting times. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** What each history entry on an appointment means. */
export const EVENT_LABEL: Record<string, string> = {
  booked: 'Appointment booked',
  walk_in: 'Walk-in registered',
  confirm: 'Appointment confirmed',
  reschedule: 'Appointment rescheduled',
  checkIn: 'Patient arrived',
  start: 'Consultation started',
  complete: 'Visit completed',
  cancel: 'Appointment cancelled',
  noShow: 'Marked as no-show',
};

// The same reason lists as the admin panel, so the audit history reads the same wherever a change was made.
export const CANCEL_REASONS = ['Patient requested', 'Doctor unavailable / Emergency leave', 'Clinic administrative / Facility', 'Duplicate appointment detected', 'Schedule conflict', 'Other non-clinical reason'];
export const NO_SHOW_REASONS = ['Patient did not arrive (Default)', 'Could not reach patient', 'Patient did not confirm', 'Other non-arrival reason'];
export const RESCHEDULE_REASONS = ['Patient requested', 'Doctor unavailable / Leave', 'Clinic administrative', 'Triage priority conflict', 'Other non-clinical reason'];

/** The server asks for an operational note of at least this length when a visit is cancelled, missed or moved. */
export const NOTE_MIN = 10;

// ---- Acting ----

export type DeskAction = 'confirm' | 'check-in' | 'cancel' | 'no-show' | 'reschedule';

/** Runs an appointment change on the server, says what happened, and returns the updated appointment. */
export function useAppointmentAction() {
  const { call } = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = useCallback(
    async (id: string, action: DeskAction, body: object = {}, done?: string) => {
      setBusy(`${id}:${action}`);
      try {
        const updated = await call<Appointment>(`/v1/appointments/${id}/${action}`, { method: 'POST', body });
        if (done) toast(done);
        return updated;
      } catch (error) {
        toast(errorMessage(error));
        return null;
      } finally {
        setBusy(null);
      }
    },
    [call, toast],
  );

  return { run, isBusy: (id: string, action: DeskAction) => busy === `${id}:${action}`, busy: busy !== null };
}

// ---- Chrome ----

/** The clinic, the day and the person signed in, at the top of each reception tab. */
export function DeskHeader({ date }: { date?: string }) {
  const signedIn = useSignedIn();
  const clinic = signedIn?.membership?.organisation.name ?? 'ClinicOS';
  const branch = signedIn?.me.staff?.branches.find((entry) => entry.primary)?.name;
  return (
    <View className="flex-row items-center gap-2.5 border-b border-sky-150/60 bg-sky-50 px-4 py-2.5">
      <View className="size-9 items-center justify-center rounded-xl bg-deep">
        <Glyph name="add-box" size={18} color="#ffffff" />
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="font-pj-bd text-[14px] leading-[18px] text-ink">
          {branch ? `${clinic} · ${branch}` : clinic}
        </Text>
        <Text className="text-[11px] leading-4 text-slate">{date ? `${dayLabel(date)} • Front Desk` : 'Front Desk'}</Text>
      </View>
      <RoundButton icon="notifications-none" label="Notifications" onPress={() => router.push('/notifications')} />
      <ProfileButton initials />
    </View>
  );
}
