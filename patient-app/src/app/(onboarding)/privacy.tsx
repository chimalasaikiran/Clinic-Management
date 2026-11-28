import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { OnboardingHeader } from '@/components/layout/OnboardingHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession } from '@/state/SessionState';
import type { IconName } from '@/theme/icons';

type Permission = {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  recommended?: boolean;
};

const permissions: Permission[] = [
  {
    id: 'abha',
    icon: 'permission-shield',
    title: 'ABHA Health Records Sync',
    description:
      'ABHA linking is not available yet. Switch this on to record that you want it when it is.',
    recommended: true,
  },
  {
    id: 'alerts',
    icon: 'permission-bell',
    title: 'Critical Visit & Medication Alerts',
    description:
      'Timely reminders about upcoming appointments, fasting instructions, and prescription refills.',
  },
  {
    id: 'checkin',
    icon: 'permission-location',
    title: 'Geofenced Clinic Check-in',
    description: 'Arrival detection is not available yet. Switch this on to record that you want it when it is.',
  },
  {
    id: 'biometric',
    icon: 'fingerprint',
    title: 'Face ID / Biometric Lock',
    description: 'Locking the app with Face ID or fingerprint is not available yet.',
  },
];

export default function Privacy() {
  const [granted, setGranted] = useState<Record<string, boolean>>({
    abha: false,
    alerts: false,
    checkin: false,
    biometric: false,
  });
  const toast = useToast();
  const { call } = useSession();
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    try {
      await call('/v1/patient/consents', {
        method: 'PUT',
        body: {
          consents: [
            { purpose: 'abha_sync', granted: granted.abha },
            { purpose: 'visit_alerts', granted: granted.alerts },
            { purpose: 'location_checkin', granted: granted.checkin },
          ],
        },
      });
      router.dismissAll();
      router.replace('/home');
    } catch (failure) {
      toast(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };
  const [showTerms, setShowTerms] = useState(false);

  return (
    <Screen header={<OnboardingHeader progress={1} pill="Final Step" />}>
      <View className="flex-row items-center gap-1.5">
        <Icon name="sovereignty-shield" />
        <Text className="font-pj-sb text-[13px] leading-4 tracking-[0.26px] text-black">
          Patient Data Sovereignty
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        className="pt-3 font-pj-bd text-[26px] leading-[33px] tracking-[-0.65px] text-ink">
        Your privacy, your control
      </Text>
      <Text className="pt-2 text-[14px] leading-[23px] text-slate">
        Clinic OS puts you in charge of your health data. Choose what permissions you want to grant
        now. You can adjust these anytime in Settings.
      </Text>

      <View className="gap-3 pt-6">
        {permissions.map((item) => (
          <View
            key={item.id}
            className="flex-row gap-3.5 rounded-xl border border-line/50 bg-white p-[17px]">
            <View
              className={cn(
                'size-10 items-center justify-center rounded-xl border border-line/40',
                item.recommended ? 'bg-mint/60' : 'bg-sky-150',
              )}>
              <Icon name={item.icon} />
            </View>
            <View className="flex-1 gap-1">
              <View className="flex-row items-center gap-2">
                <Text className="shrink font-pj-md text-[16px] leading-[22px] text-ink">
                  {item.title}
                </Text>
                {item.recommended ? (
                  <View className="rounded-full border border-line/40 bg-sky-200 px-2 py-0.5">
                    <Text className="font-pj-bd text-[11px] leading-[14px] text-black">Rec</Text>
                  </View>
                ) : null}
              </View>
              <Text className="text-[13px] leading-[21px] text-slate">{item.description}</Text>
            </View>
            <Toggle
              label={item.title}
              value={granted[item.id]}
              onValueChange={(value) =>
                item.id === 'biometric'
                  ? toast('App lock is not available yet.')
                  : setGranted({ ...granted, [item.id]: value })
              }
            />
          </View>
        ))}
      </View>

      <View className="mt-6 flex-row items-center gap-3 rounded-xl border border-line/40 bg-sky-100 p-[15px]">
        <View className="size-8 items-center justify-center rounded-full bg-mint">
          <Icon name="health-shield" />
        </View>
        <View className="flex-1">
          <Text className="font-pj-sb text-[13px] leading-[18px] text-ink">
            Your data stays yours
          </Text>
          <Text className="font-pj-bd text-[11px] leading-4 tracking-[0.55px] text-slate">
            We will never sell your health data or send promotional spam.
          </Text>
        </View>
      </View>

      <Button
        label="Complete Setup & Enter Clinic OS"
        iconRight="arrow-forward-white"
        className="mt-10"
        loading={saving}
        onPress={finish}
      />
      <Pressable accessibilityRole="button" onPress={() => setShowTerms(true)} className="py-3">
        <Text className="text-center font-pj-sb text-[13px] leading-4 tracking-[0.26px] text-slate">
          Review Detailed Data Sharing Terms
        </Text>
      </Pressable>

      <Sheet visible={showTerms} onClose={() => setShowTerms(false)} title="Data sharing terms">
        <Text className="pb-4 text-[14px] leading-[22px] text-body">
          Each permission can be turned off at any time in Settings. The full data sharing terms will
          appear here once they are published.
        </Text>
        <Button label="Close" onPress={() => setShowTerms(false)} />
      </Sheet>
    </Screen>
  );
}
