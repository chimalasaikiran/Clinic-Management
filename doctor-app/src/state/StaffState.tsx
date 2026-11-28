import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { staffMember, type Role, type StaffMember } from '@/data/staff';
import { useSignedIn } from '@/state/SessionState';

/** How the signed-in person appears on screen, built from their account and staff record. */
type StaffContext = { role: Role; me: StaffMember };

const Context = createContext<StaffContext | null>(null);

export function StaffProvider({ children }: { children: ReactNode }) {
  const signedIn = useSignedIn();
  const value = useMemo<StaffContext>(() => {
    const role: Role = signedIn?.workspace ?? 'reception';
    const me = signedIn
      ? staffMember(signedIn.user, signedIn.me, role, signedIn.membership?.organisation.name ?? '', signedIn.membership?.roles.map((entry) => entry.name) ?? [])
      : staffMember({ id: '', email: '', fullName: '', emailVerified: false }, { staff: null, practitioner: null }, role, '', []);
    return { role, me };
  }, [signedIn]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useStaff() {
  const value = useContext(Context);
  if (!value) throw new Error('useStaff must be used inside StaffProvider');
  return value;
}
