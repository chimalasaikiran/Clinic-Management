import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Text } from '@/components/ui/Text';
import { LogoutSheet } from '@/features/common/LogoutSheet';
import { StaffMenu } from '@/features/common/StaffMenu';
import { WorkspaceSwitch } from '@/features/common/WorkspaceSwitch';
import { ActionButton, Box, Chip, Glyph, IconTile, Mono, ReceptionHeader, type GlyphName } from '@/features/reception/ui';
import { useSession, useSignedIn } from '@/state/SessionState';
import { useStaff } from '@/state/StaffState';

// What the front desk can do here, each shown only when the person's role grants it.
const scopes: { title: string; note: string; icon: GlyphName; permission: string }[] = [
  { title: 'Bookings', note: 'Book & check in', icon: 'edit-calendar', permission: 'bookings.create' },
  { title: 'Reschedule', note: 'Move visits', icon: 'event-repeat', permission: 'bookings.reschedule' },
  { title: 'Cancel', note: 'Cancel & no-show', icon: 'event-busy', permission: 'bookings.cancel' },
  { title: 'Registration', note: 'New patients', icon: 'person-add-alt', permission: 'patients.create' },
];

export default function StaffProfile() {
  const { me } = useStaff();
  const { can } = useSession();
  const signedIn = useSignedIn();
  const [confirming, setConfirming] = useState(false);
  const roles = signedIn?.membership?.roles.map((role) => role.name) ?? [];
  const branches = signedIn?.me.staff?.branches ?? [];
  const granted = scopes.filter((scope) => can(scope.permission));

  return (
    <Screen className="bg-[#f8fafc]" header={<ReceptionHeader title="Staff Profile" subtitle="Front Desk" />} contentClassName="gap-3.5 px-4 pt-3 pb-8">
      <View className="overflow-hidden rounded-3xl">
        <LinearGradient colors={['#0c2420', '#0f2c27', '#071614']}>
          <View className="gap-3.5 p-5">
            <View className="flex-row items-center justify-between gap-2">
              <Chip label="Signed in" tone="green" dot="#10b981" className="self-center" />
              <Mono className="text-white/60">{me.employeeId}</Mono>
            </View>
            <View className="h-px bg-white/10" />
            <View className="flex-row items-center gap-3.5">
              <View className="size-16 items-center justify-center rounded-2xl bg-[#0b5c45]">
                <Text className="font-pj-bd text-[22px] leading-7 text-white">{me.initials}</Text>
              </View>
              <View className="flex-1">
                <Text className="font-pj-bd text-[21px] leading-7 text-white">{me.name}</Text>
                <Text className="text-[13px] leading-[18px] text-white/80">{me.designation}</Text>
                <Mono className="text-white/50">{me.branch}</Mono>
              </View>
            </View>
            <View className="h-px bg-white/10" />
            <View className="flex-row gap-2">
              <View className="flex-1 rounded-xl bg-white/10 px-3 py-2">
                <Mono className="text-white/80">{me.phone}</Mono>
              </View>
              <View className="flex-1 rounded-xl bg-white/10 px-3 py-2">
                <Mono className="text-white/80">{me.email}</Mono>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      <StaffMenu />
      <WorkspaceSwitch />

      <Box className="p-4">
        <View className="flex-row items-center gap-2 border-b border-[#eef2f6] pb-3">
          <Glyph name="verified" size={17} color="#047857" />
          <View className="flex-1">
            <Text className="font-pj-bd text-[14px] leading-5 text-ink">What your role allows</Text>
            <Text className="text-[11px] leading-4 text-[#64748b]">{roles.join(', ') || 'No role assigned'}</Text>
          </View>
          <Chip label="READ-ONLY" tone="pale" className="self-center" />
        </View>
        {granted.length ? (
          <View className="flex-row flex-wrap justify-between gap-y-2">
            {granted.map((item) => (
              <View key={item.title} className="w-[48.5%] flex-row items-center gap-2 rounded-xl border border-[#eef2f6] bg-[#f8fafc] p-2.5">
                <IconTile icon={item.icon} box="bg-white" color="#047857" />
                <View className="flex-1">
                  <Text className="font-pj-bd text-[12px] leading-4 text-ink">{item.title}</Text>
                  <Mono>{item.note}</Mono>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <Text className="text-[11px] leading-[18px] text-[#64748b]">Roles are set by your clinic administrator in the admin panel.</Text>
      </Box>

      {branches.length ? (
        <Box className="p-4">
          <Text className="font-pj-bd text-[12px] leading-[17px] text-slate">BRANCHES</Text>
          {branches.map((branch) => (
            <View key={branch.id} className="flex-row justify-between gap-3 border-b border-[#eef2f6] py-1.5">
              <Text className="text-[12px] leading-[17px] text-ink">{branch.name}</Text>
              {branch.primary ? <Chip label="Primary" tone="mint" /> : null}
            </View>
          ))}
        </Box>
      ) : null}

      <ActionButton large tone="dangerLine" label="Sign Out" icon="lock-outline" onPress={() => setConfirming(true)} />
      <LogoutSheet visible={confirming} onClose={() => setConfirming(false)} />
    </Screen>
  );
}
