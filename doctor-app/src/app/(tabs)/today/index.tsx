import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { FilterChips } from '@/components/ui/FilterChips';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useClinicalDay } from '@/features/doctor/clinical';
import { ageSex, clinicMinute, dayLabel, minutesSince, useNow } from '@/features/reception/desk';
import { FlowCard, useStartConsultation } from '@/features/today/FlowCard';
import { cn } from '@/lib/cn';
import { useStaff } from '@/state/StaffState';
import type { IconName } from '@/theme/icons';

const actions: { label: string; icon: IconName; tile: string; href: Href }[][] = [
  [
    { label: 'Lookup', icon: 'action-lookup', tile: 'bg-mint/50', href: '/patients/search' },
    { label: 'OPD Roster', icon: 'action-roster', tile: 'bg-sky-300', href: '/schedule' },
    { label: 'Inbox', icon: 'action-lab', tile: 'bg-[#ffdad6]', href: '/inbox' },
  ],
  [
    { label: 'Attendance', icon: 'action-attendance', tile: 'bg-mint/50', href: '/me/attendance' },
    { label: 'Leaves', icon: 'action-leaves', tile: 'bg-sky-300', href: '/me/leave' },
    { label: 'Salary', icon: 'action-salary', tile: 'bg-[#ffdad6]', href: '/me/salary' },
  ],
];

type Filter = 'all' | 'waiting' | 'scheduled' | 'completed';
const chip = 'flex-row items-center gap-1 rounded-full px-2 py-0.5';
const SEVERITY_CHIP = { critical: 'CRITICAL', high: 'HIGH', moderate: 'MODERATE', low: 'LOW' } as const;

const clockNow = (minute: number) => {
  const hours = Math.floor(minute / 60);
  return `${String(hours % 12 || 12).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')} ${hours < 12 ? 'AM' : 'PM'}`;
};

export default function Today() {
  const { me } = useStaff();
  const now = useNow();
  const day = useClinicalDay();
  const { start, busy } = useStartConsultation();
  const [filter, setFilter] = useState<Filter>('all');
  const [tokenAscending, setTokenAscending] = useState(true);

  const data = day.data;
  const myId = data?.me.practitionerId;
  // A doctor's own list; a clinician without a practitioner profile sees everyone in their care scope.
  const rows = (data?.appointments ?? []).filter((row) => row.status !== 'cancelled' && row.status !== 'no_show' && (!myId || row.practitioner.id === myId));
  const waiting = rows.filter((row) => row.status === 'arrived').sort((a, b) => (a.arrivedAt ?? '').localeCompare(b.arrivedAt ?? ''));
  const scheduled = rows.filter((row) => row.status === 'pending' || row.status === 'confirmed');
  const completed = rows.filter((row) => row.status === 'completed');
  const inRoom = rows.find((row) => row.status === 'in_progress');
  const averageWait = waiting.length ? Math.round(waiting.reduce((sum, row) => sum + minutesSince(row.arrivedAt!, now), 0) / waiting.length) : 0;
  const clinical = data?.clinical;
  const unsigned = clinical?.unsigned.total ?? 0;

  const byFilter = { all: rows, waiting, scheduled, completed }[filter];
  const visible = filter === 'all' ? [...waiting, ...rows.filter((row) => row.status === 'in_progress'), ...scheduled, ...completed] : byFilter;
  const ordered = tokenAscending ? visible : [...visible].reverse();
  const filters = [
    { value: 'all' as const, label: `All (${rows.length})` },
    { value: 'waiting' as const, label: `Waiting (${waiting.length})` },
    { value: 'scheduled' as const, label: `Scheduled (${scheduled.length})` },
    { value: 'completed' as const, label: `Completed (${completed.length})` },
  ];
  const stats: { label: string; value: string; note: string; icon: IconName; alert?: boolean }[] = [
    { label: 'WAITING', value: String(waiting.length), note: waiting.length ? `Avg ${averageWait} mins` : 'Lounge clear', icon: 'hourglass-teal' },
    { label: 'CLOSED', value: String(completed.length), note: rows.length ? `${Math.round((completed.length / rows.length) * 100)}% completed` : 'No visits', icon: 'check-circle' },
    { label: 'TO SIGN', value: String(unsigned), note: unsigned ? 'Encounters open' : 'All signed', icon: 'pending-rx-red', alert: unsigned > 0 },
  ];
  const attention = [
    ...(clinical?.alerts.items ?? []).map((alert) => ({ key: alert.id, kind: SEVERITY_CHIP[alert.severity], critical: alert.severity === 'critical', who: alert.patient, title: alert.title, detail: alert.detail, action: 'Review', href: `/inbox-task/${alert.id}` as Href })),
    ...(clinical?.results.items ?? []).map((order) => ({ key: order.id, kind: order.resultFlag === 'critical' ? 'CRITICAL RESULT' : 'RESULT', critical: order.resultFlag === 'critical', who: order.patient, title: order.title, detail: order.resultSummary ?? '', action: 'Review', href: `/results/${order.id}` as Href })),
  ];
  const minute = data ? clinicMinute(now, data.timeZone) : null;

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <View className="flex-row items-center gap-2.5 border-b border-sky-250/60 bg-sky-50/90 px-4 py-2.5">
          <LinearGradient colors={['#00201c', '#294d47']} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
            <Text className="font-pj-bd text-[13px] leading-4 text-white">{me.initials}</Text>
          </LinearGradient>
          <Pressable accessibilityRole="button" accessibilityLabel="Open your profile" onPress={() => router.push('/profile')} className="flex-1">
            <Text numberOfLines={1} className="font-pj-bd text-[14px] leading-5 text-ink">
              {me.name}
            </Text>
            <View className="flex-row items-center gap-1">
              <View className="size-1.5 rounded-full bg-teal" />
              <Text numberOfLines={1} className="font-pj-md text-[11px] leading-4 text-slate">
                {me.branch}
              </Text>
            </View>
          </Pressable>
          <IconButton icon="search" label="Search patients" className="rounded-xl border border-sky-300 bg-white" onPress={() => router.push('/patients/search')} />
          <IconButton icon="bell" label="Clinical inbox" className="rounded-xl border border-sky-300 bg-white" onPress={() => router.push('/inbox')} />
        </View>
      }
      contentClassName="gap-4 px-4 pt-3 pb-6">
      {day.error && !data ? <ErrorState message={day.error.message} onAction={day.reload} /> : null}
      {!data && !day.error ? <LoadingState label="Loading today's patients…" /> : null}
      {data ? (
        <>
          <View className="gap-2.5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5 rounded-full border border-[#a8cec6]/60 bg-mint/50 px-2.5 py-1">
                <View className="size-2 rounded-full bg-teal" />
                <Text className="font-pj-sb text-[11px] leading-4 text-deep">LIVE · {dayLabel(data.date).toUpperCase()}</Text>
              </View>
              {minute !== null ? (
                <View className="flex-row items-center gap-1 rounded-full border border-sky-300 bg-white px-2.5 py-1">
                  <Icon name="clock-slate" />
                  <Text className="font-pj-sb text-[11px] leading-4 text-ink">{clockNow(minute)}</Text>
                </View>
              ) : null}
            </View>
            <View className="flex-row flex-wrap items-end justify-between gap-1">
              <Text accessibilityRole="header" className="font-pj-bd text-[22px] leading-7 text-ink">
                {me.department ? `${me.department} OPD` : 'OPD'}
              </Text>
              <Text className="font-pj-md text-[12px] leading-[18px] text-slate">
                {rows.length} booked · <Text className="font-pj-bd text-[12px] text-ink">{waiting.length + scheduled.length} left</Text>
              </Text>
            </View>
          </View>

          {inRoom ? (
            <LinearGradient colors={['#12242b', '#1a343d', '#0c181d']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 16, gap: 8 }}>
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                  <View className={cn(chip, 'bg-teal')}>
                    <View className="size-1.5 rounded-full bg-[#a8cec6]" />
                    <Text className="font-pj-bd text-[10px] leading-[15px] text-mint">IN CONSULTATION</Text>
                  </View>
                  {inRoom.token ? <Text className="font-pj-md text-[11px] leading-4 text-white/60">Token {inRoom.token}</Text> : null}
                </View>
              </View>
              <View className="gap-0.5 pt-1">
                <View className="flex-row items-end gap-2">
                  <Text className="font-pj-bd text-[19px] leading-6 text-white">{inRoom.patient.fullName}</Text>
                  <Text className="font-pj-md text-[12px] leading-5 text-white/70">
                    {ageSex(inRoom.patient, data.today)} · {inRoom.patient.mrn}
                  </Text>
                </View>
                <Text className="text-[12px] leading-[18px] text-white/80">{inRoom.reason}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => start(inRoom)} className="flex-row items-center justify-center gap-2 rounded-xl bg-teal py-2.5 active:opacity-80">
                <Icon name="play-white" />
                <Text className="font-pj-sb text-[13px] leading-4 text-white">{busy === inRoom.id ? 'Opening…' : 'Resume Consultation'}</Text>
              </Pressable>
            </LinearGradient>
          ) : null}

          <View className="flex-row gap-2.5">
            {stats.map((stat) => (
              <View key={stat.label} accessible accessibilityLabel={`${stat.label}: ${stat.value}, ${stat.note}`} className="flex-1 gap-1.5 rounded-2xl border border-sky-300 bg-white p-3">
                <View className="flex-row items-center justify-between">
                  <Text className="font-pj-bd text-[10px] leading-[15px] text-slate">{stat.label}</Text>
                  <Icon name={stat.icon} />
                </View>
                <View>
                  <Text className={cn('font-pj-bd text-[18px] leading-6', stat.alert ? 'text-danger' : 'text-ink')}>{stat.value}</Text>
                  <Text className={cn('text-[10px] leading-[15px]', stat.alert ? 'font-pj-sb text-danger' : stat.label === 'WAITING' ? 'font-pj-sb text-teal' : 'font-pj-md text-slate')}>{stat.note}</Text>
                </View>
              </View>
            ))}
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-1.5">
                <View className="size-2 rounded-full bg-danger" />
                <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">CLINICAL ATTENTION REQUIRED</Text>
              </View>
              <View className="rounded-full bg-[#ffdad6] px-2 py-0.5">
                <Text className="font-pj-bd text-[10px] leading-[15px] text-[#93000a]">{(clinical?.alerts.total ?? 0) + (clinical?.results.total ?? 0)} Open</Text>
              </View>
            </View>
            {attention.length === 0 ? <EmptyState title="Nothing needs you" message="Serious alerts and results waiting for review appear here." /> : null}
            {attention.map((item) => (
              <View key={item.key} className={cn('flex-row items-start gap-3 rounded-2xl border border-l-4 border-sky-300 bg-white p-3.5', item.critical ? 'border-l-danger' : 'border-l-slate')}>
                <View className="flex-1 gap-1">
                  <View className={cn(chip, 'self-start', item.critical ? 'bg-[#ffdad6]' : 'bg-sky-300')}>
                    <Text className={cn('font-pj-bd text-[10px] leading-[15px]', item.critical ? 'text-[#93000a]' : 'text-ink')}>{item.kind}</Text>
                  </View>
                  <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">
                    {item.who.fullName} ({ageSex(item.who, data.today)}) · {item.who.mrn}
                  </Text>
                  <Text className="text-[12px] leading-[18px] text-[#4c4546]">
                    {item.title}
                    {item.detail ? ` — ${item.detail}` : ''}
                  </Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.action}: ${item.title}`} onPress={() => router.push(item.href)} className="flex-row items-center gap-1 rounded-xl bg-ink px-2.5 py-1.5">
                  <Text className="font-pj-bd text-[11px] leading-4 text-white">{item.action}</Text>
                  <Icon name="arrow-xs-white" />
                </Pressable>
              </View>
            ))}
            {(clinical?.unsigned.items ?? []).map((item) => (
              <View key={item.id} className="flex-row items-start gap-3 rounded-2xl border border-l-4 border-sky-300 border-l-slate bg-white p-3.5">
                <View className="flex-1 gap-1">
                  <View className={cn(chip, 'self-start bg-sky-300')}>
                    <Text className="font-pj-bd text-[10px] leading-[15px] text-ink">UNSIGNED ENCOUNTER</Text>
                  </View>
                  <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">
                    {item.patient.fullName} · {item.reference}
                  </Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.reference}`} onPress={() => router.push({ pathname: '/patients/workspace', params: { encounterId: item.id } })} className="rounded-xl bg-sky-300 px-2.5 py-1.5">
                  <Text className="font-pj-bd text-[11px] leading-4 text-ink">Open</Text>
                </Pressable>
              </View>
            ))}
          </View>

          <View className="gap-2.5 pt-1">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                <Text className="font-pj-bd text-[16px] leading-6 text-ink">Today&apos;s Patient Flow</Text>
                <View className="rounded-full bg-sky-300 px-2 py-0.5">
                  <Text className="font-pj-bd text-[11px] leading-4 text-ink">{waiting.length} In Queue</Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`Order ${tokenAscending ? 'first to last' : 'last to first'}`} hitSlop={8} onPress={() => setTokenAscending(!tokenAscending)}>
                <Text className="font-pj-sb text-[12px] leading-4 text-slate">Order {tokenAscending ? '↑' : '↓'}</Text>
              </Pressable>
            </View>
            <FilterChips options={filters} value={filter} onChange={setFilter} />
            {ordered.length === 0 ? (
              <EmptyState title="No patients in this view" message={rows.length ? 'Try another filter.' : 'Nothing is booked with you today.'} actionLabel={filter !== 'all' ? 'Show all' : undefined} onAction={filter !== 'all' ? () => setFilter('all') : undefined} />
            ) : (
              ordered.map((row) => <FlowCard key={row.id} row={row} today={data.today} next={row.id === waiting[0]?.id} now={now} />)
            )}
          </View>

          <View className="gap-2.5 pt-1">
            <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">ACTIONS</Text>
            {actions.map((row, rowIndex) => (
              <View key={rowIndex} className="flex-row gap-2.5">
                {row.map((action) => (
                  <Pressable key={action.label} accessibilityRole="button" onPress={() => router.push(action.href)} className="flex-1 items-center gap-1.5 rounded-2xl border border-sky-300 bg-white py-3">
                    <View className={cn('size-10 items-center justify-center rounded-xl', action.tile)}>
                      <Icon name={action.icon} />
                    </View>
                    <Text numberOfLines={1} className="font-pj-bd text-[11px] leading-4 text-ink">
                      {action.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
