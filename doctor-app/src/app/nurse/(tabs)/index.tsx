import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Chip, Glyph, IconTile, RoundButton, type GlyphName } from '@/components/staff/ui';
import { FilterChips } from '@/components/ui/FilterChips';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { ageSex, clinicMinute, dayLabel, initialsOf, useNow } from '@/features/reception/desk';
import { openPreparation, PatientCard } from '@/features/nurse/PatientCard';
import { ForestCard, NurseProfileButton, SectionTitle } from '@/features/nurse/ui';
import { useNotices } from '@/features/common/notices';
import { flagsOf, useWard } from '@/features/nurse/ward';
import { cn } from '@/lib/cn';
import { useSignedIn } from '@/state/SessionState';
import { useStaff } from '@/state/StaffState';

const shortcuts: { label: string; icon: GlyphName; box: string; href: Href }[] = [
  { label: 'Attendance', icon: 'schedule', box: 'bg-mint/60', href: '/me/attendance' },
  { label: 'Leaves', icon: 'event-available', box: 'bg-sky-300', href: '/me/leave' },
  { label: 'Salary', icon: 'payments', box: 'bg-[#ffdad6]', href: '/me/salary' },
];

const greeting = (minute: number) => (minute < 12 * 60 ? 'Good morning' : minute < 17 * 60 ? 'Good afternoon' : 'Good evening');

export default function NurseToday() {
  const now = useNow();
  const signedIn = useSignedIn();
  const { me } = useStaff();
  const { day, present, needsVitals, abnormal, ready, specimens, alerts } = useWard();
  const { unread } = useNotices(1);
  const [filter, setFilter] = useState('all');

  const data = day.data;
  // The two doctors with the most patients waiting get a filter of their own.
  const counts = new Map<string, { name: string; count: number }>();
  for (const row of present) counts.set(row.practitioner.id, { name: row.practitioner.displayName, count: (counts.get(row.practitioner.id)?.count ?? 0) + 1 });
  const busiest = [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 2);
  const options = [
    { value: 'all', label: `All (${present.length})` },
    { value: 'vitals', label: `Pending Vitals (${needsVitals.length})` },
    ...busiest.map(([id, entry]) => ({ value: id, label: `${entry.name} (${entry.count})` })),
  ];
  const active = options.some((option) => option.value === filter) ? filter : 'all';
  const visible = present.filter((row) => active === 'all' || (active === 'vitals' ? needsVitals.includes(row) : row.practitioner.id === active));

  const workload: { value: number; unit: string; label: string; icon: GlyphName; box: string; urgent?: boolean }[] = [
    { value: needsVitals.length, unit: 'Patients', label: 'Awaiting Vitals', icon: 'airline-seat-recline-normal', box: 'bg-mint/70' },
    { value: abnormal.length, unit: 'Flagged', label: 'Abnormal Vitals', icon: 'monitor-heart', box: 'bg-[#ffdad6]', urgent: abnormal.length > 0 },
    { value: ready.length, unit: 'Ready', label: 'Ready for Doctor', icon: 'how-to-reg', box: 'bg-sky-300' },
    { value: specimens.total, unit: 'Open', label: 'Specimens to Collect', icon: 'science', box: 'bg-sky-300' },
  ];
  const attention = abnormal.length + alerts.items.length;
  const firstName = signedIn?.user.fullName.split(/\s+/)[0] ?? '';
  const branches = data?.branches.map((branch) => branch.name).join(' · ') ?? '';

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <View className="flex-row items-center gap-2 border-b border-sky-150/60 bg-sky-50 px-4 py-2.5">
          <View className="flex-1">
            <Text className="font-pj-bd text-[10px] leading-[15px] text-slate">NURSING ●</Text>
            <Text accessibilityRole="header" className="font-pj-bd text-[18px] leading-6 text-ink">
              Today
            </Text>
            <View className="flex-row items-center gap-1">
              <Glyph name="add-box" size={12} color="#4d626a" />
              <Text numberOfLines={1} className="shrink text-[12px] leading-4 text-slate">
                {signedIn?.membership?.organisation.name ?? 'ClinicOS'}
              </Text>
            </View>
          </View>
          <RoundButton icon="notifications-none" label="Notifications" dot={unread > 0} onPress={() => router.navigate('/nurse/alerts')} className="bg-sky-100" />
          <NurseProfileButton />
        </View>
      }
      contentClassName="gap-3.5 px-4 pt-3 pb-6">
      {day.error && !data ? <ErrorState message={day.error.message} onAction={day.reload} /> : null}
      {!data && !day.error ? <LoadingState label="Loading today's patients…" /> : null}
      {data ? (
        <>
          <ForestCard>
            <View className="flex-row items-center gap-2 border-b border-white/10 pb-3">
              <View className="size-2 rounded-full bg-[#34d399]" />
              <Text className="flex-1 font-pj-bd text-[11px] leading-4 text-white">LIVE · {dayLabel(data.date).toUpperCase()}</Text>
              <Text numberOfLines={1} className="shrink text-[11px] leading-4 text-white/60">
                {branches}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="flex-1 gap-0.5">
                <Chip label={me.employeeId} tone="green" />
                <Text className="font-pj-bd text-[21px] leading-7 text-white">
                  {greeting(clinicMinute(now, data.timeZone))}
                  {firstName ? `, ${firstName}` : ''}
                </Text>
                <Text className="text-[12px] leading-4 text-white/70">{me.designation}</Text>
              </View>
              <View className="size-[52px] items-center justify-center rounded-2xl bg-white/15">
                <Text className="font-pj-bd text-[17px] leading-6 text-white">{initialsOf(me.name)}</Text>
              </View>
            </View>
          </ForestCard>

          <SectionTitle title="Workload" icon="speed" right={<Text className="font-pj-sb text-[11px] leading-4 text-slate">✓ Live</Text>} />
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {workload.map((item) => (
              <View key={item.label} className={cn('w-[48.3%] gap-1.5 rounded-2xl border bg-white p-3.5', item.urgent ? 'border-[#fecaca]' : 'border-sky-150/50')}>
                <IconTile icon={item.icon} box={item.box} color={item.urgent ? '#ba1a1a' : '#081e26'} />
                <Text className={cn('font-pj-bd text-[24px] leading-8', item.urgent ? 'text-danger' : 'text-ink')}>
                  {item.value} <Text className="font-pj-md text-[12px] text-slate">{item.unit}</Text>
                </Text>
                <Text className="font-pj-sb text-[13px] leading-[18px] text-ink">{item.label}</Text>
              </View>
            ))}
          </View>

          {attention ? (
            <View className="gap-3 rounded-3xl border border-[#fecaca] bg-white p-3">
              <View className="flex-row items-center gap-2">
                <IconTile icon="gps-fixed" box="bg-[#ffdad6]" color="#ba1a1a" className="rounded-full" />
                <View className="flex-1">
                  <Text accessibilityRole="header" className="font-pj-bd text-[15px] leading-5 text-ink">
                    Needs Clinical Attention
                  </Text>
                  <Text className="text-[11px] leading-4 text-slate">Tell the doctor directly; ClinicOS does not send escalations.</Text>
                </View>
              </View>
              {abnormal.map((row) => (
                <Pressable key={row.id} accessibilityRole="button" onPress={() => openPreparation(row)} className="gap-1 rounded-2xl border border-[#fecaca] bg-[#fff5f5] p-3">
                  <Text className="font-pj-bd text-[14px] leading-5 text-ink">
                    {row.patient.fullName} <Text className="text-[11px] text-slate">{row.patient.mrn}</Text>
                  </Text>
                  <Text className="font-pj-bd text-[13px] leading-[18px] text-danger">{flagsOf(row.vitals).join(' · ')}</Text>
                  <Text className="text-[11px] leading-4 text-slate">{row.practitioner.displayName}</Text>
                </Pressable>
              ))}
              {alerts.items.map((alert) => (
                <View key={alert.id} className="gap-1 rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-3">
                  <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">
                    {alert.patient.fullName} ({ageSex(alert.patient, data.today)}) · {alert.severity.toUpperCase()}
                  </Text>
                  <Text className="text-[12px] leading-[17px] text-slate">{alert.title}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <SectionTitle title="Patients in the Clinic" icon="assignment-ind" right={<Chip label={`${present.length} Present`} className="self-center" />} />
          <FilterChips options={options} value={active} onChange={setFilter} />
          {visible.length === 0 ? <EmptyState title="No patients here" message={present.length ? 'Nobody matches this filter right now.' : 'Patients appear here once reception checks them in.'} /> : null}
          {visible.map((row) => (
            <PatientCard key={row.id} row={row} today={data.today} now={now} />
          ))}

          <SectionTitle
            title="Specimens to Collect"
            icon="science"
            right={
              <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.navigate('/nurse/tasks')}>
                <Text className="font-pj-bd text-[11px] leading-4 text-ink">Open Tasks →</Text>
              </Pressable>
            }
          />
          {specimens.items.length === 0 ? <Text className="text-[12px] leading-[17px] text-slate">No lab orders are waiting for a specimen.</Text> : null}
          {specimens.items.slice(0, 3).map((order) => (
            <Pressable key={order.id} accessibilityRole="button" onPress={() => router.navigate('/nurse/tasks')} className="flex-row items-center gap-3 rounded-2xl border border-sky-150/50 bg-white p-3">
              <IconTile icon="science" box={order.urgent ? 'bg-[#ffdad6]' : 'bg-sky-300'} color={order.urgent ? '#ba1a1a' : '#081e26'} />
              <View className="flex-1">
                <Text numberOfLines={1} className="font-pj-sb text-[13px] leading-[18px] text-ink">{order.title}</Text>
                <Text numberOfLines={1} className="text-[12px] leading-[17px] text-slate">{order.patient.fullName} · {order.patient.mrn}</Text>
              </View>
              {order.urgent ? <Chip label="Urgent" tone="red" className="self-center" /> : null}
            </Pressable>
          ))}

          <Text className="font-pj-bd text-[12px] leading-[18px] text-slate">ACTIONS</Text>
          <View className="flex-row gap-2.5">
            {shortcuts.map((item) => (
              <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={item.label} onPress={() => router.push(item.href)} className="w-[27%] items-center gap-1.5 rounded-2xl border border-sky-150/50 bg-white py-3">
                <IconTile icon={item.icon} box={item.box} />
                <Text className="font-pj-bd text-[11px] leading-4 text-ink">{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
