import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Select } from '@/components/form/Select';
import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { LogoutSheet } from '@/features/profile/LogoutSheet';
import { errorMessage } from '@/lib/api';
import { dateTime } from '@/lib/dates';
import { useSession } from '@/state/SessionState';
import type { DeviceSession } from '@/types';

const card = 'gap-3 rounded-2xl border border-line/40 bg-white p-4';
const kicker = 'font-pj-bd text-[11px] leading-4 tracking-[0.5px] text-slate';

export default function SecurityAndLogin() {
  const toast = useToast();
  const { session, call } = useSession();
  const [devices, setDevices] = useState<DeviceSession[] | null>(null);
  const [deviceError, setDeviceError] = useState('');
  const [ending, setEnding] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    try {
      setDevices(await call<DeviceSession[]>('/v1/patient/auth/sessions'));
      setDeviceError('');
    } catch (failure) {
      setDeviceError(errorMessage(failure));
    }
  }, [call]);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  if (session.status !== 'signedIn') return <Redirect href="/" />;
  const { account } = session;
  const others = devices?.filter((device) => !device.current) ?? [];

  const end = async (path: string, method: 'DELETE' | 'POST', done: string) => {
    setEnding(true);
    try {
      await call(path, { method });
      toast(done);
      await load();
    } catch (failure) {
      toast(errorMessage(failure));
    } finally {
      setEnding(false);
    }
  };
  const notYet = () => toast('This is not available yet.');

  const control = (
    title: string,
    body: string,
    value: boolean,
    onChange: (value: boolean) => void,
  ) => (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <Text className="font-pj-bd text-[14px] leading-5 text-ink">{title}</Text>
        <Text className="text-[12px] leading-[18px] text-slate">{body}</Text>
      </View>
      <Toggle label={title} value={value} onValueChange={onChange} />
    </View>
  );

  return (
    <Screen
      className="bg-sky-50"
      header={<AppHeader title="Security & Login" subtitle="PA-38 · Account Settings" />}
      contentClassName="gap-4 pt-4 pb-6">
      <Text className="text-[14px] leading-5 text-slate">
        Manage how you securely access your account and protected health records.
      </Text>
      <View className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-line/40 bg-white p-3">
        <Text className="text-[12px] leading-[18px] text-slate">
          <Text className="font-pj-bd text-[12px] text-ink">{account.fullName}</Text> · ABHA: Not
          linked
        </Text>
      </View>

      <View className="flex-row gap-3 rounded-2xl border border-line/40 bg-sky-100 p-4">
        <View className="size-10 items-center justify-center rounded-xl bg-mint">
          <Icon name="health-shield" />
        </View>
        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="font-pj-bd text-[15px] leading-5 text-ink">
              Account Protection
            </Text>
          </View>
          <Text className="text-[12px] leading-[18px] text-slate">
            You sign in with a one-time code sent to your mobile number. Check the signed-in
            devices below and sign out any you do not recognise.
          </Text>
        </View>
      </View>

      <View className={card}>
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className={kicker}>PRIMARY LOGIN METHOD</Text>
          <Pill label="Verified by SMS code" />
        </View>
        <View className="flex-row items-center gap-3">
          <View className="size-10 items-center justify-center rounded-xl bg-sky-150">
            <Icon name="phone" />
          </View>
          <View className="flex-1">
            <Text className="font-pj-bd text-[16px] leading-6 text-ink">
              +91 ••••• {account.mobile.slice(5)}
            </Text>
            <Text className="text-[12px] leading-[18px] text-slate">SMS one-time code</Text>
          </View>
          <Button
            label="Change"
            variant="soft"
            size="sm"
            onPress={() => router.push('/profile/help/request')}
          />
        </View>
      </View>

      <View className={card}>
        <Text className={kicker}>LINKED IDENTITY & ABHA</Text>
        <View className="flex-row items-center gap-3 rounded-xl bg-sky-100 p-3">
          <View className="flex-1">
            <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">ABHA not linked</Text>
            <Text className="text-[12px] leading-[18px] text-slate">ABHA linking is not available yet</Text>
          </View>
        </View>
        {account.email ? (
          <View className="flex-row items-center gap-3 rounded-xl bg-sky-100 p-3">
            <View className="flex-1">
              <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{account.email}</Text>
              <Text className="text-[12px] leading-[18px] text-slate">Contact email · Not verified</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View className={card}>
        <Text className={kicker}>DEVICE LEVEL CONTROLS</Text>
        {control(
          'Biometric Face ID / Fingerprint',
          'App lock is not available yet.',
          false,
          notYet,
        )}
        <View className="border-t border-line/30 pt-3">
          {control('Screen Shield', 'Blocking screenshots is not available yet.', false, notYet)}
        </View>
      </View>

      <View className={card}>
        <View className="flex-row items-center justify-between">
          <Text className={kicker}>ACTIVE SESSIONS</Text>
          {devices ? <Pill label={devices.length === 1 ? '1 Device' : `${devices.length} Devices`} tone="sky" /> : null}
        </View>
        {deviceError ? (
          <Pressable accessibilityRole="button" onPress={load}>
            <Text accessibilityRole="alert" className="text-[12px] leading-[18px] text-[#ba1a1a]">
              {deviceError} Tap to try again.
            </Text>
          </Pressable>
        ) : null}
        {devices?.map((device) => (
          <View
            key={device.id}
            className={`flex-row items-center gap-3 rounded-xl border border-line/40 p-3 ${device.current ? 'bg-sky-100' : ''}`}>
            <View className="flex-1 gap-1">
              <View className="flex-row flex-wrap items-center gap-2">
                <Text className="font-pj-bd text-[14px] leading-5 text-ink">{device.deviceName}</Text>
                {device.current ? <Pill label="This Device" /> : null}
              </View>
              <Text className="text-[12px] leading-[18px] text-slate">
                Last active: {dateTime(device.lastSeenAt)}
              </Text>
            </View>
            {device.current ? null : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Sign out of ${device.deviceName}`}
                disabled={ending}
                hitSlop={8}
                onPress={() => end(`/v1/patient/auth/sessions/${device.id}`, 'DELETE', 'Signed out of that device.')}>
                <Text className="font-pj-sb text-[13px] text-[#ba1a1a]">Sign Out</Text>
              </Pressable>
            )}
          </View>
        ))}
        <Button
          label="Sign Out of All Other Devices"
          variant="outline"
          size="md"
          disabled={ending || others.length === 0}
          onPress={() => end('/v1/patient/auth/sessions/revoke-others', 'POST', 'Signed out of all other devices.')}
        />
      </View>

      <View className="gap-1 rounded-2xl border border-line/40 bg-sky-150 p-4">
        <Text className="font-pj-bd text-[14px] leading-5 text-ink">
          Zero-Phishing Patient Advisory
        </Text>
        <Text className="text-[13px] leading-[19px] text-slate">
          Clinic OS staff, lab partners, or doctors will{' '}
          <Text className="font-pj-bd text-[13px] text-ink">NEVER</Text> request your OTP, ABHA PIN,
          or password over voice call, SMS, or WhatsApp.
        </Text>
      </View>

      <Button
        label="Download Security Audit Log"
        iconLeft="download"
        variant="outline"
        onPress={() => toast('Downloading the audit log is not available yet.')}
      />
      <Button
        label="Log Out of Clinic OS"
        variant="outline"
        textClassName="text-[#ba1a1a]"
        onPress={() => setLoggingOut(true)}
      />
      <Text className="text-center text-[12px] leading-[19px] text-slate">
        Need account recovery or want to delete your profile?{' '}
        <Text
          className="font-pj-bd text-[12px] text-ink underline"
          onPress={() => router.push('/profile/help')}>
          Visit Help & Support
        </Text>
      </Text>

      <LogoutSheet visible={loggingOut} onClose={() => setLoggingOut(false)} />
    </Screen>
  );
}
