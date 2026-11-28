import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { apiRequest, ApiError, errorMessage, type RequestOptions } from '@/lib/api';
import { tokenStore } from '@/lib/tokenStore';

export type Workspace = 'doctor' | 'nurse' | 'reception';

export type Membership = {
  membershipId: string;
  organisation: { id: string; name: string; status: string };
  roles: { id: string; name: string }[];
  permissions: string[];
  branchScope: 'all' | string[];
};

export type User = { id: string; email: string; fullName: string; emailVerified: boolean };

export type MyRecords = {
  staff: {
    id: string;
    staffCode: string;
    type: 'doctor' | 'staff';
    fullName: string;
    designation: string;
    department: string;
    mobile: string | null;
    email: string | null;
    status: string;
    council: string | null;
    councilNumber: string | null;
    qualifications: string[];
    engagement: 'full_time' | 'visiting' | 'honorary';
    createdAt: string;
    branches: { id: string; name: string; primary: boolean }[];
  } | null;
  practitioner: {
    id: string;
    displayName: string;
    credentials: string | null;
    specialty: string;
    department: string;
    room: string | null;
    status: string;
    slotMinutes: number;
    /** Weekly consulting hours; weekday 0 is Sunday. */
    availability: { weekday: number; start: string; end: string; branch: { id: string; name: string } }[];
  } | null;
};

export type SignedInPayload = { token: string; user: User; memberships: Membership[] };

type Session =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** A saved sign-in could not be checked, usually because the phone is offline. */
  | { status: 'unreachable'; message: string }
  | {
      status: 'signedIn';
      user: User;
      membership: Membership | null;
      memberships: Membership[];
      me: MyRecords;
      /** The workspaces this person's permissions open, best first. */
      workspaces: Workspace[];
      workspace: Workspace | null;
    };

type SessionValue = {
  session: Session;
  signIn: (payload: SignedInPayload) => Promise<void>;
  signOut: () => Promise<void>;
  /** An authenticated request for the active clinic. A session the server has ended signs the app out. */
  call: <T>(path: string, options?: Omit<RequestOptions, 'token' | 'orgId'>) => Promise<T>;
  /** Headers for requests that cannot go through `call`, such as the live event stream. */
  authorization: () => Record<string, string>;
  orgId: string | null;
  can: (permission: string) => boolean;
  switchWorkspace: (workspace: Workspace) => void;
  retry: () => void;
};

const SessionContext = createContext<SessionValue | null>(null);

const sessionOver = (error: unknown) => error instanceof ApiError && error.status === 401;

// The server decides what a person may do; the app only picks which screens to open first. A therapist with
// clinical rights gets the doctor workspace; the front desk the reception one; nursing staff the nurse one.
export function workspacesFor(membership: Membership | null, practitioner: MyRecords['practitioner']): Workspace[] {
  if (!membership) return [];
  const has = (permission: string) => membership.permissions.includes(permission);
  const list: Workspace[] = [];
  if (has('clinical.write') && practitioner?.status === 'active') list.push('doctor');
  if (has('bookings.create') && has('bookings.view')) list.push('reception');
  if (has('clinical.vitals')) list.push('nurse');
  return list;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const token = useRef<string | null>(null);
  const [session, setSession] = useState<Session>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const forget = useCallback(async () => {
    token.current = null;
    setSession({ status: 'signedOut' });
    await tokenStore.clear().catch(() => undefined);
  }, []);

  // Builds the signed-in state: the first active clinic, the person's own records there, and their workspaces.
  const load = useCallback(async (user: User, memberships: Membership[]) => {
    const membership = memberships.find((entry) => entry.organisation.status !== 'suspended') ?? null;
    const me: MyRecords = membership
      ? await apiRequest<MyRecords>('/v1/me/staff', { token: token.current, orgId: membership.organisation.id })
      : { staff: null, practitioner: null };
    const workspaces = workspacesFor(membership, me.practitioner);
    setSession({ status: 'signedIn', user, membership, memberships, me, workspaces, workspace: workspaces[0] ?? null });
  }, []);

  useEffect(() => {
    let current = true;
    (async () => {
      const saved = await tokenStore.read().catch(() => null);
      if (!saved) {
        if (current) setSession({ status: 'signedOut' });
        return;
      }
      token.current = saved;
      try {
        const payload = await apiRequest<{ user: User; memberships: Membership[] }>('/v1/auth/session', { token: saved });
        if (current) await load(payload.user, payload.memberships);
      } catch (error) {
        if (!current) return;
        if (sessionOver(error)) await forget();
        else setSession({ status: 'unreachable', message: errorMessage(error) });
      }
    })();
    return () => {
      current = false;
    };
  }, [attempt, forget, load]);

  const signIn = useCallback(
    async ({ token: next, user, memberships }: SignedInPayload) => {
      token.current = next;
      await tokenStore.write(next);
      await load(user, memberships);
    },
    [load],
  );

  const orgId = session.status === 'signedIn' ? (session.membership?.organisation.id ?? null) : null;

  const call = useCallback(
    async <T,>(path: string, options: Omit<RequestOptions, 'token' | 'orgId'> = {}) => {
      try {
        return await apiRequest<T>(path, { ...options, token: token.current, orgId });
      } catch (error) {
        if (sessionOver(error)) await forget();
        throw error;
      }
    },
    [forget, orgId],
  );

  const signOut = useCallback(async () => {
    // The phone forgets the session even if the server cannot be told.
    const ending = token.current;
    await forget();
    if (ending) await apiRequest('/v1/auth/app/logout', { method: 'POST', token: ending }).catch(() => undefined);
  }, [forget]);

  const authorization = useCallback((): Record<string, string> => (token.current ? { Authorization: `Bearer ${token.current}` } : {}), []);
  const permissions = session.status === 'signedIn' ? session.membership?.permissions : undefined;
  const can = useCallback((permission: string) => !!permissions?.includes(permission), [permissions]);
  const switchWorkspace = useCallback(
    (workspace: Workspace) => setSession((current) => (current.status === 'signedIn' && current.workspaces.includes(workspace) ? { ...current, workspace } : current)),
    [],
  );
  const retry = useCallback(() => {
    setSession({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({ session, signIn, signOut, call, authorization, orgId, can, switchWorkspace, retry }),
    [session, signIn, signOut, call, authorization, orgId, can, switchWorkspace, retry],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}

/** The signed-in state, for screens that only render when signed in. */
export function useSignedIn() {
  const { session } = useSession();
  return session.status === 'signedIn' ? session : null;
}
