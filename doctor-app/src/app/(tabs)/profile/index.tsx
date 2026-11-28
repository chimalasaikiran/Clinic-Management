import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { LogoutSheet } from '@/features/common/LogoutSheet';
import { StaffMenu } from '@/features/common/StaffMenu';
import { WorkspaceSwitch } from '@/features/common/WorkspaceSwitch';
import { useClinicalDay } from '@/features/doctor/clinical';
import { cn } from '@/lib/cn';
import { useSignedIn } from '@/state/SessionState';
import { useStaff } from '@/state/StaffState';
import type { IconName } from '@/theme/icons';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const card = 'gap-4 rounded-[20px] border border-sky-250/60 bg-white p-5';
const kicker = 'font-pj-bd text-[11px] leading-4';
const small = 'text-[11px] leading-4 text-slate';

function CardHead({ icon, title, subtitle }: { icon: IconName; title: string; subtitle: string }) {
  return (
    <View className="flex-row items-center gap-2">
      <Icon name={icon} />
      <View className="flex-1">
        <Text accessibilityRole="header" className="font-pj-bd text-[17px] leading-[21px] text-ink">
          {title}
        </Text>
        <Text className={small}>{subtitle}</Text>
      </View>
    </View>
  );
}

export default function PhysicianProfile() {
  const { me } = useStaff();
  const signedIn = useSignedIn();
  const staff = signedIn?.me.staff;
  const practitioner = signedIn?.me.practitioner;
  const day = useClinicalDay();
  const [confirming, setConfirming] = useState(false);

  const myId = day.data?.me.practitionerId;
  const rows = (day.data?.appointments ?? []).filter((row) => row.status !== 'cancelled' && row.status !== 'no_show' && (!myId || row.practitioner.id === myId));
  const stats: { label: string; value: string; note: string }[] = [
    { label: 'TODAY', value: String(rows.length), note: 'Booked' },
    { label: 'SEEN', value: String(rows.filter((row) => row.status === 'completed').length), note: 'Completed' },
    { label: 'TO SIGN', value: String(day.data?.clinical?.unsigned.total ?? 0), note: 'Open encounters' },
  ];
  const directives: { icon: IconName; title: string; body: string; status: string; route: Href }[] = [
    { icon: 'pf-nav-credentials', title: 'Professional Credentials', body: 'Council registration and qualifications', status: staff?.councilNumber ? 'Recorded' : 'Missing', route: '/account/credentials' },
    { icon: 'pf-nav-branches', title: 'Clinic & Branch Access', body: 'Where you work and what your role can see', status: `${staff?.branches.length ?? 0} Linked`, route: '/account/branches' },
    { icon: 'pf-nav-availability', title: 'Availability & Working Hours', body: 'Weekly consulting hours', status: `${new Set((practitioner?.availability ?? []).map((window) => window.weekday)).size} days`, route: '/account/availability' },
    { icon: 'pf-nav-security', title: 'Account Security', body: 'Password and signed-in devices', status: 'Manage', route: '/account/security' },
  ];

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <View className="min-h-[64px] flex-row items-center gap-2 border-b border-sky-250/60 bg-sky-50 px-3.5">
          <Icon name="pf-hdr-logo" />
          <View className="flex-1">
            <Text accessibilityRole="header" numberOfLines={1} className="font-pj-sb text-[18px] leading-6 text-ink">
              My Profile
            </Text>
            <Text numberOfLines={1} className={cn(kicker, 'text-[10px] text-[#294d47]')}>
              {signedIn?.membership?.organisation.name ?? ''}
            </Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Notifications" onPress={() => router.push('/notifications')} className="size-10 items-center justify-center">
            <Icon name="pf-hdr-bell" />
          </Pressable>
          <View className="size-9 items-center justify-center rounded-xl bg-ink">
            <Text className="font-pj-bd text-[12px] leading-4 text-white">{me.initials}</Text>
          </View>
        </View>
      }
      contentClassName="gap-4 px-5 pt-4 pb-6">
      <View className="overflow-hidden rounded-[20px] border border-[#10b981]/20">
        <LinearGradient colors={['#0d3a33', '#06211f', '#041716']} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}>
          <View className="gap-4 p-5">
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <View className="flex-row items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1">
                <Icon name="pf-doc-id" />
                <Text className={cn(kicker, 'text-white/90')}>{me.employeeId}</Text>
              </View>
              <View className="flex-row items-center gap-1.5 rounded-full border border-[#34d399]/30 bg-[#10b981]/20 px-2.5 py-1">
                <View className="size-2 rounded-full bg-[#34d399]" />
                <Text className="font-pj-sb text-[11px] leading-4 text-[#a7f3d0]">{practitioner?.status === 'active' ? 'Accepting bookings' : 'Signed in'}</Text>
              </View>
            </View>
            <View className="flex-row items-center gap-3.5">
              <View className="size-16 items-center justify-center rounded-2xl bg-sky-250">
                <Text className="font-pj-bd text-[16px] leading-6 text-ink">{me.initials}</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <View className="flex-row flex-wrap items-center gap-1.5">
                  <Text className="font-pj-bd text-[18px] leading-6 text-white">{me.name}</Text>
                  {practitioner?.credentials ? (
                    <View className="rounded bg-white/15 px-1.5 py-0.5">
                      <Text className={cn(kicker, 'text-[10px] leading-[15px] text-white')}>{practitioner.credentials}</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="font-pj-md text-[14px] leading-5 text-[#e2e8f0]">{me.designation}</Text>
                <Text className="text-[12px] leading-[18px] text-[#cbd5e1]">{[practitioner?.specialty, me.department].filter(Boolean).join(' · ')}</Text>
              </View>
            </View>
            <View className="flex-row gap-2 border-t border-white/10 pt-2">
              {stats.map((stat) => (
                <View key={stat.label} className="flex-1 gap-px rounded-xl border border-white/5 bg-white/5 p-2">
                  <Text className="text-[10px] leading-[15px] text-[#94a3b8]">{stat.label}</Text>
                  <Text className="font-pj-bd text-[16px] leading-6 text-white">{stat.value}</Text>
                  <Text className="text-[9px] leading-[14px] text-[#cbd5e1]">{stat.note}</Text>
                </View>
              ))}
            </View>
          </View>
        </LinearGradient>
      </View>

      <View className={card}>
        <CardHead icon="pf-credentials" title="Registration & Qualifications" subtitle={staff?.council ?? 'Medical council not recorded'} />
        <View className="flex-row justify-between gap-2">
          <Text className={small}>Registration</Text>
          <Text className="font-pj-sb text-[12px] leading-4 text-ink">{staff?.councilNumber ?? 'Not recorded'}</Text>
        </View>
        <View className="flex-row flex-wrap gap-1.5">
          {(staff?.qualifications ?? []).map((item) => (
            <View key={item} className="rounded-lg bg-sky-100 px-2.5 py-1">
              <Text className="font-pj-sb text-[12px] leading-4 text-ink">{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className={card}>
        <CardHead icon="pf-branch-main" title="Branches" subtitle={me.branch} />
        {(staff?.branches ?? []).map((branch) => {
          const days = [...new Set((practitioner?.availability ?? []).filter((window) => window.branch.id === branch.id).map((window) => WEEKDAYS[window.weekday]))];
          return (
            <View key={branch.id} className="flex-row items-center justify-between gap-2 rounded-xl bg-sky-100 p-3">
              <View className="flex-1">
                <Text className="font-pj-sb text-[13px] leading-[18px] text-ink">{branch.name}</Text>
                <Text className={small}>{days.length ? days.join(', ') : 'No consulting hours'}</Text>
              </View>
              {branch.primary ? <Text className={cn(kicker, 'text-[10px] text-deep')}>PRIMARY</Text> : null}
            </View>
          );
        })}
      </View>

      <StaffMenu />
      <WorkspaceSwitch />

      <View className="gap-2">
        <Text className={cn(kicker, 'px-1 text-slate')}>ACCOUNT</Text>
        {directives.map((item) => (
          <Pressable key={item.title} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => router.push(item.route)} className="flex-row items-center gap-3 rounded-[20px] border border-sky-250/60 bg-white p-3.5">
            <Icon name={item.icon} />
            <View className="flex-1">
              <Text className="font-pj-sb text-[13px] leading-[18px] text-ink">{item.title}</Text>
              <Text className={small}>{item.body}</Text>
            </View>
            <Text className={cn(kicker, 'text-[10px] text-[#526871]')}>{item.status}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable accessibilityRole="button" onPress={() => setConfirming(true)} className="items-center rounded-2xl border border-[#fecaca] bg-white py-3.5">
        <Text className="font-pj-bd text-[14px] leading-5 text-danger">Sign Out</Text>
      </Pressable>
      <LogoutSheet visible={confirming} onClose={() => setConfirming(false)} />
    </Screen>
  );
}
