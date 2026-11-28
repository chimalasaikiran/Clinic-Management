import { useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ActionButton, Box, Chip, Glyph, Mono } from '@/components/staff/ui';
import { Text } from '@/components/ui/Text';
import { LogoutSheet } from '@/features/common/LogoutSheet';
import { StaffMenu } from '@/features/common/StaffMenu';
import { WorkspaceSwitch } from '@/features/common/WorkspaceSwitch';
import { ForestCard, NurseHeader, SectionTitle } from '@/features/nurse/ui';
import { dayLabel } from '@/features/reception/desk';
import { useSession, useSignedIn } from '@/state/SessionState';
import { useStaff } from '@/state/StaffState';

// What a nurse can do in the app, each shown only when the person's role grants it.
const access: { title: string; permission: string }[] = [
  { title: 'View charts, results and care records', permission: 'clinical.read' },
  { title: 'Record vitals and collect specimens', permission: 'clinical.vitals' },
  { title: 'View patient details', permission: 'patients.view' },
  { title: 'View the appointment list', permission: 'bookings.view' },
];

export default function NurseProfile() {
  const { me } = useStaff();
  const { can } = useSession();
  const signedIn = useSignedIn();
  const staff = signedIn?.me.staff;
  const [confirming, setConfirming] = useState(false);

  const facts: [string, string][] = [
    ['Designation', me.designation],
    ['Department', me.department || 'Not recorded'],
    ['Primary branch', me.branch],
    ['Nursing council', staff?.council ?? 'Not recorded'],
    ['Registration number', staff?.councilNumber ?? 'Not recorded'],
    ...(staff?.qualifications.length ? ([['Qualifications', staff.qualifications.join(', ')]] as [string, string][]) : []),
    ...(staff ? ([['On record since', dayLabel(staff.createdAt.slice(0, 10), true)]] as [string, string][]) : []),
  ];
  const granted = access.filter((item) => can(item.permission));

  return (
    <Screen inTabs className="bg-sky-50" header={<NurseHeader title="Nurse Profile" subtitle={signedIn?.membership?.organisation.name} />} contentClassName="gap-3.5 px-4 pt-3 pb-6">
      <ForestCard>
        <View className="flex-row items-center justify-between gap-3">
          <View className="size-16 items-center justify-center rounded-2xl bg-white/15">
            <Text className="font-pj-bd text-[22px] leading-7 text-white">{me.initials}</Text>
          </View>
          <View className="items-end gap-1">
            <Chip label="Signed in" tone="mint" dot="#34d399" className="self-end" />
            <Mono className="text-white/70">{me.employeeId}</Mono>
          </View>
        </View>
        <View className="gap-1">
          <Text className="font-pj-bd text-[22px] leading-7 text-white">{me.name}</Text>
          <Text className="text-[13px] leading-[18px] text-white/70">{me.designation}</Text>
        </View>
        <View className="gap-2 rounded-2xl bg-sky-100 p-3">
          {[
            { icon: 'call' as const, value: me.phone },
            { icon: 'mail-outline' as const, value: me.email },
          ].map((item) => (
            <View key={item.icon} className="flex-row items-center gap-2">
              <Glyph name={item.icon} size={14} color="#4d626a" />
              <Text numberOfLines={1} className="flex-1 text-[12px] leading-4 text-slate">{item.value}</Text>
            </View>
          ))}
        </View>
      </ForestCard>
      <StaffMenu />
      <WorkspaceSwitch />
      <Box className="p-4">
        <SectionTitle title="Staff Record" icon="badge" right={<Chip label="READ-ONLY" className="self-center" />} />
        {facts.map(([label, value]) => (
          <View key={label} className="gap-1 rounded-xl bg-sky-100 p-3">
            <Text className="text-[11px] leading-4 text-slate">{label}</Text>
            <Text className="font-pj-md text-[13px] leading-[19px] text-ink">{value}</Text>
          </View>
        ))}
        <Text className="text-[11px] leading-4 text-slate">Your clinic administrator updates these in the admin panel.</Text>
      </Box>
      <Box className="p-4">
        <SectionTitle title="What Your Role Allows" icon="admin-panel-settings" />
        <Text className="text-[12px] leading-[17px] text-slate">{signedIn?.membership?.roles.map((role) => role.name).join(', ')}</Text>
        {granted.map((item) => (
          <View key={item.permission} className="flex-row items-center gap-2 rounded-xl bg-sky-50 p-3">
            <Glyph name="check" size={15} color="#047857" />
            <Text className="flex-1 font-pj-md text-[13px] leading-[18px] text-ink">{item.title}</Text>
          </View>
        ))}
      </Box>
      <ActionButton large tone="dangerLine" label="Sign Out" icon="lock-outline" onPress={() => setConfirming(true)} />
      <LogoutSheet visible={confirming} onClose={() => setConfirming(false)} />
    </Screen>
  );
}
