import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { AccountHeader } from '@/features/account/AccountHeader';
import { LogoutSheet } from '@/features/common/LogoutSheet';
import { dayLabel } from '@/features/reception/desk';
import { useResource } from '@/hooks/useResource';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { passwordProblem } from '@/lib/password';
import { useSession, useSignedIn } from '@/state/SessionState';

type Session = { id: string; createdAt: string; lastSeenAt: string; expiresAt: string; ip: string | null; userAgent: string | null; kind: 'browser' | 'app'; deviceName: string | null; current: boolean };

const card = 'gap-3 rounded-[20px] border border-sky-250/60 bg-white p-4';
const when = (iso: string) => {
  const date = new Date(iso);
  const local = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `${dayLabel(local)}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
// A short, readable name for where a session is signed in.
const deviceOf = (session: Session) => {
  if (session.kind === 'app') return session.deviceName ?? 'Staff app';
  const agent = session.userAgent ?? '';
  const browser = /Edg\//.test(agent) ? 'Edge' : /Chrome\//.test(agent) ? 'Chrome' : /Firefox\//.test(agent) ? 'Firefox' : /Safari\//.test(agent) ? 'Safari' : 'Browser';
  return `${browser} · admin panel`;
};

export default function Security() {
  const toast = useToast();
  const { call } = useSession();
  const signedIn = useSignedIn();
  const sessions = useResource<Session[]>('/v1/auth/sessions');
  const [sheet, setSheet] = useState<'password' | 'sign-out' | null>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const problem = passwordProblem(next);
  const mismatch = confirm !== next;
  const others = (sessions.data ?? []).filter((session) => !session.current);

  const close = () => {
    setSheet(null);
    setCurrent('');
    setNext('');
    setConfirm('');
  };

  const end = async (session: Session) => {
    setBusy(session.id);
    try {
      await call(`/v1/auth/sessions/${session.id}`, { method: 'DELETE' });
      sessions.reload();
      toast(`${deviceOf(session)} signed out.`);
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const endOthers = async () => {
    setBusy('others');
    try {
      for (const session of others) await call(`/v1/auth/sessions/${session.id}`, { method: 'DELETE' });
      sessions.reload();
      toast('Other sessions signed out.');
    } catch (error) {
      toast(errorMessage(error));
      sessions.reload();
    } finally {
      setBusy(null);
    }
  };

  const changePassword = async () => {
    setBusy('password');
    try {
      await call('/v1/auth/password/change', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      close();
      sessions.reload();
      toast('Password changed. Your other sessions were signed out.');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen className="bg-sky-50" header={<AccountHeader title="Account Security" subtitle={signedIn?.user.email ?? ''} back="sec-hdr-back" profile="hdr-avatar" />} contentClassName="gap-4 px-4 pt-2 pb-8">
      <View className={card}>
        <Text className="font-pj-bd text-[11px] leading-4 text-slate">HOW YOU SIGN IN</Text>
        <Text className="text-[13px] leading-[19px] text-ink">On this app: the mobile number on your staff record, your password, then a code sent by SMS. Sessions here end after 12 hours idle or 7 days.</Text>
        <Button label="Change Password" variant="soft" onPress={() => setSheet('password')} />
      </View>

      <View className={card}>
        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-pj-bd text-[11px] leading-4 text-slate">SIGNED IN ON</Text>
          {others.length ? (
            <Pressable accessibilityRole="button" disabled={busy === 'others'} onPress={endOthers}>
              <Text className="font-pj-bd text-[12px] leading-4 text-danger">{busy === 'others' ? 'Signing out…' : 'Sign out others'}</Text>
            </Pressable>
          ) : null}
        </View>
        {sessions.error && !sessions.data ? <ErrorState message={sessions.error.message} onAction={sessions.reload} /> : null}
        {!sessions.data && !sessions.error ? <LoadingState label="Loading sessions…" /> : null}
        {sessions.data?.length === 0 ? <EmptyState title="No sessions" message="Nothing is signed in." /> : null}
        {sessions.data?.map((session) => (
          <View key={session.id} className={cn('gap-0.5 rounded-xl p-3', session.current ? 'bg-mint/50' : 'bg-sky-100')}>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 font-pj-sb text-[13px] leading-[18px] text-ink">{deviceOf(session)}</Text>
              {session.current ? (
                <Text className="font-pj-bd text-[10px] leading-[15px] text-deep">THIS DEVICE</Text>
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Sign out ${deviceOf(session)}`} disabled={busy === session.id} onPress={() => end(session)}>
                  <Text className="font-pj-bd text-[12px] leading-4 text-danger">{busy === session.id ? '…' : 'Sign out'}</Text>
                </Pressable>
              )}
            </View>
            <Text className="text-[11px] leading-4 text-slate">
              Last active {when(session.lastSeenAt)} · signed in {when(session.createdAt)}
              {session.ip ? ` · ${session.ip}` : ''}
            </Text>
          </View>
        ))}
      </View>

      <Button label="Sign Out of This Device" variant="outline" onPress={() => setSheet('sign-out')} />

      <Sheet visible={sheet === 'password'} onClose={close} title="Change password">
        <View className="gap-3">
          <TextField label="Current password" value={current} onChangeText={setCurrent} secureTextEntry />
          <TextField label="New password" value={next} onChangeText={setNext} secureTextEntry error={next ? problem : ''} />
          <TextField label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry error={confirm && mismatch ? 'The passwords do not match.' : ''} />
          <Button label="Update Password" loading={busy === 'password'} disabled={!current || !!problem || mismatch} onPress={changePassword} />
        </View>
      </Sheet>
      <LogoutSheet visible={sheet === 'sign-out'} onClose={close} />
    </Screen>
  );
}
