import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { apiRequest, ApiError, errorMessage, type RequestOptions } from '@/lib/api';
import { tokenStore } from '@/lib/tokenStore';

export type Account = {
  id: string;
  mobile: string;
  fullName: string;
  email: string | null;
  dateOfBirth: string | null;
  gender: 'male' | 'female' | 'other' | null;
  bloodGroup: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  pinCode: string | null;
  emergencyName: string | null;
  emergencyRelation: string | null;
  emergencyPhone: string | null;
  language: string;
};

export type SignedIn = { token: string; account: Account };

type Session =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** A saved sign-in could not be checked, usually because the phone is offline. */
  | { status: 'unreachable'; message: string }
  | { status: 'signedIn'; account: Account };

type SessionContextValue = {
  session: Session;
  signIn: (result: SignedIn) => Promise<void>;
  signOut: () => Promise<void>;
  /** An authenticated request. A session the server has ended signs the app out. */
  call: <T>(path: string, options?: Omit<RequestOptions, 'token'>) => Promise<T>;
  updateAccount: (account: Account) => void;
  /** The header for requests that cannot go through `call`, such as the live event stream. */
  authorization: () => Record<string, string>;
  retry: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const sessionOver = (error: unknown) => error instanceof ApiError && (error.status === 401 || error.code === 'ACCOUNT_DISABLED');

export function SessionProvider({ children }: { children: ReactNode }) {
  const token = useRef<string | null>(null);
  const [session, setSession] = useState<Session>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const forget = useCallback(async () => {
    token.current = null;
    setSession({ status: 'signedOut' });
    await tokenStore.clear().catch(() => undefined);
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
        const account = await apiRequest<Account>('/v1/patient/me', { token: saved });
        if (current) setSession({ status: 'signedIn', account });
      } catch (error) {
        if (!current) return;
        if (sessionOver(error)) await forget();
        else setSession({ status: 'unreachable', message: errorMessage(error) });
      }
    })();
    return () => {
      current = false;
    };
  }, [attempt, forget]);

  const signIn = useCallback(async ({ token: next, account }: SignedIn) => {
    token.current = next;
    await tokenStore.write(next);
    setSession({ status: 'signedIn', account });
  }, []);

  const call = useCallback(
    async <T,>(path: string, options: Omit<RequestOptions, 'token'> = {}) => {
      try {
        return await apiRequest<T>(path, { ...options, token: token.current });
      } catch (error) {
        if (sessionOver(error)) await forget();
        throw error;
      }
    },
    [forget],
  );

  const authorization = useCallback((): Record<string, string> => (token.current ? { Authorization: `Bearer ${token.current}` } : {}), []);

  const signOut = useCallback(async () => {
    // The phone forgets the session even if the server cannot be told.
    const ending = token.current;
    await forget();
    if (ending) await apiRequest('/v1/patient/auth/logout', { method: 'POST', token: ending }).catch(() => undefined);
  }, [forget]);

  const updateAccount = useCallback((account: Account) => setSession({ status: 'signedIn', account }), []);
  const retry = useCallback(() => {
    setSession({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({ session, signIn, signOut, call, updateAccount, authorization, retry }),
    [session, signIn, signOut, call, updateAccount, authorization, retry],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}

/** For screens that only render when signed in. */
export function useAccount(): Account | null {
  const { session } = useSession();
  return session.status === 'signedIn' ? session.account : null;
}
