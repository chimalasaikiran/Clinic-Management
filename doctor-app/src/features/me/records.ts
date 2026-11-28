import { dayLabel } from '@/features/reception/desk';
import { useResource } from '@/hooks/useResource';

/** The signed-in person's own attendance, leave and pay. The server returns nobody else's. */

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave' | 'unavailable';

export type AttendanceRecord = {
  id: string;
  date: string;
  status: AttendanceStatus;
  time: string | null;
  note: string | null;
  branch: { id: string; name: string };
  recordedBy: string;
  corrections: { id: string; fromStatus: AttendanceStatus; toStatus: AttendanceStatus; fromTime: string | null; toTime: string | null; reason: string; by: string; at: string }[];
};

export type AttendanceMonth = { linked: boolean; month: string; counts: Record<AttendanceStatus, number>; records: AttendanceRecord[] };

export type Leave = {
  id: string;
  kind: 'leave' | 'block' | 'relief';
  title: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  branch: { id: string; name: string } | null;
  reason: string;
  status: 'scheduled' | 'cancelled';
  createdBy: string;
  createdAt: string;
  cancelledBy: string | null;
  cancelledAt: string | null;
};

export type Payslip = {
  id: string;
  reference: string;
  month: string;
  payDate: string | null;
  branch: string | null;
  quantity: number | null;
  quantityNote: string | null;
  gross: number;
  additions: number;
  deductions: number;
  statutory: { code: string; label: string; amount: number }[];
  advance: number;
  net: number;
  adjustments: { id: string; direction: string; label: string; amount: number }[];
  paid: { date: string; reference: string | null } | null;
};

export type AdvanceStatus = 'pending_approval' | 'pending_disbursal' | 'awaiting_acknowledgement' | 'active' | 'settled' | 'rejected';

export type Advance = {
  id: string;
  reference: string;
  category: string;
  principal: number;
  installments: number;
  startMonth: string;
  status: AdvanceStatus;
  method: string | null;
  disbursalDate: string | null;
  rejectionReason: string | null;
  requested: string;
  approved: string | null;
  disbursed: string | null;
  acknowledged: string | null;
  recoveries: { number: number; amount: number; month: string }[];
  recovered: number;
  outstanding: number;
  version: number;
};

export type MyPay = {
  profile: { employment: string; model: 'monthly' | 'visit' | 'shift' | 'hourly'; rate: number; bankName: string; accountLast4: string; bankVerified: boolean; active: boolean } | null;
  payslips: Payslip[];
  advances: Advance[];
};

export const useMyAttendance = (month: string) => useResource<AttendanceMonth>(`/v1/me/attendance?month=${month}`);
export const useMyLeaves = () => useResource<{ linked: boolean; leaves: Leave[] }>('/v1/me/leaves');
export const useMyPay = () => useResource<MyPay>('/v1/me/pay');

// ---- Formatting ----

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 2026-09 → September 2026. */
export function monthLabel(month: string) {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return `${MONTHS[index - 1]} ${year}`;
}

export function shiftMonth(month: string, count: number) {
  const [year, index] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, index - 1 + count, 1)).toISOString().slice(0, 7);
}

/** Rupees with Indian digit grouping: ₹2,800 or ₹1,42,000.50. */
export function rupees(amount: number) {
  const [whole, fraction] = Math.abs(amount).toFixed(2).split('.') as [string, string];
  const last = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${amount < 0 ? '−' : ''}₹${rest ? `${rest},${last}` : last}${fraction !== '00' ? `.${fraction}` : ''}`;
}

export const ATTENDANCE: Record<AttendanceStatus, { label: string; color: string; tone: 'green' | 'amber' | 'red' | 'indigo' | 'grey' }> = {
  present: { label: 'Present', color: '#0d9488', tone: 'green' },
  late: { label: 'Late', color: '#f59e0b', tone: 'amber' },
  absent: { label: 'Absent', color: '#ef4444', tone: 'red' },
  leave: { label: 'Leave', color: '#6366f1', tone: 'indigo' },
  unavailable: { label: 'Unavailable', color: '#94a3b8', tone: 'grey' },
};

export const LEAVE_KIND: Record<Leave['kind'], string> = { leave: 'Leave', block: 'Blocked Time', relief: 'Relief Duty' };

export type LeaveState = 'upcoming' | 'current' | 'past' | 'cancelled';
export function leaveState(leave: Leave, today: string): LeaveState {
  if (leave.status === 'cancelled') return 'cancelled';
  if (leave.startDate > today) return 'upcoming';
  return leave.endDate >= today ? 'current' : 'past';
}
export const LEAVE_STATE: Record<LeaveState, { label: string; tone: 'blue' | 'teal' | 'grey' | 'red' }> = {
  upcoming: { label: 'Upcoming', tone: 'blue' },
  current: { label: 'On Now', tone: 'teal' },
  past: { label: 'Taken', tone: 'grey' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

/** Calendar days covered, counting both ends. */
export const leaveDays = (leave: Pick<Leave, 'startDate' | 'endDate'>) => Math.round((Date.parse(leave.endDate) - Date.parse(leave.startDate)) / 86_400_000) + 1;
export const leaveRange = (leave: Pick<Leave, 'startDate' | 'endDate'>) => (leave.startDate === leave.endDate ? dayLabel(leave.startDate, true) : `${dayLabel(leave.startDate)} – ${dayLabel(leave.endDate, true)}`);

export const ADVANCE_STATUS: Record<AdvanceStatus, { label: string; tone: 'amber' | 'blue' | 'teal' | 'green' | 'red' }> = {
  pending_approval: { label: 'Awaiting Approval', tone: 'amber' },
  pending_disbursal: { label: 'Approved, Not Paid', tone: 'blue' },
  awaiting_acknowledgement: { label: 'Confirm Receipt', tone: 'amber' },
  active: { label: 'Being Recovered', tone: 'teal' },
  settled: { label: 'Settled', tone: 'green' },
  rejected: { label: 'Refused', tone: 'red' },
};

export const PAY_MODEL = { monthly: 'per month', visit: 'per visit', shift: 'per shift', hourly: 'per hour' } as const;
export const EMPLOYMENT: Record<string, string> = { full_time: 'Full time', part_time: 'Part time', contract_locum: 'Contract / locum', consultant: 'Consultant' };

/** The monthly instalment, as the payroll run spreads the advance. */
export const instalmentOf = (advance: Pick<Advance, 'principal' | 'installments'>) => Math.round((advance.principal / advance.installments) * 100) / 100;
