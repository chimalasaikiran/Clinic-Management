import type { MyRecords, User, Workspace } from '@/state/SessionState';

export type Role = Workspace;

/** How the signed-in person appears on profile screens. Built from their account and staff record. */
export type StaffMember = {
  name: string;
  initials: string;
  employeeId: string;
  designation: string;
  department: string;
  branch: string;
  phone: string;
  email: string;
  home: '/today' | '/nurse' | '/reception';
};

export const homeOf: Record<Role, StaffMember['home']> = { doctor: '/today', nurse: '/nurse', reception: '/reception' };

const initialsOf = (name: string) =>
  name
    .replace(/^Dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

const masked = (value: string | null | undefined, keep: number) => (value ? `${value.slice(0, keep)}${'•'.repeat(Math.max(0, value.length - keep - 2))}${value.slice(-2)}` : 'Not recorded');

export function staffMember(user: User, me: MyRecords, role: Role, clinicName: string, roleNames: string[]): StaffMember {
  const record = me.staff;
  const name = me.practitioner?.displayName ?? record?.fullName ?? user.fullName;
  const branch = record?.branches.find((entry) => entry.primary) ?? record?.branches[0];
  return {
    name,
    initials: initialsOf(name),
    employeeId: record?.staffCode ?? 'No staff record',
    designation: record?.designation ?? me.practitioner?.specialty ?? (roleNames.join(', ') || 'Clinic staff'),
    department: me.practitioner?.department ?? record?.department ?? '',
    branch: branch ? `${clinicName} · ${branch.name}` : clinicName,
    phone: record?.mobile ? `+91 ${masked(record.mobile, 5)}` : 'Not recorded',
    email: masked(record?.email ?? user.email, 3),
    home: homeOf[role],
  };
}
