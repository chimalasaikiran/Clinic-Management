import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { FilterChips } from '@/components/ui/FilterChips';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import {
  ageSex,
  clinicMinute,
  clock,
  DeskHeader,
  isOpen,
  minuteOf,
  minutesSince,
  practitionerLine,
  STATUS,
  TYPE_LABEL,
  useAppointmentAction,
  useDay,
  useNow,
  type DayAppointment,
} from '@/features/reception/desk';
import { ActionButton, Chip, Glyph, Heading, IconTile, RoundButton, type GlyphName } from '@/features/reception/ui';
import { cn } from '@/lib/cn';
import { useSignedIn } from '@/state/SessionState';
import colors from '@/theme/colors';

const shortcuts: { title: string; body: string; icon: GlyphName; href: Href; dark?: boolean }[] = [
  { title: 'Book Slot', body: 'Scheduled OPD intake', icon: 'edit-calendar', href: '/reception/book', dark: true },
  { title: 'Walk-in Arrived', body: 'Register a new patient', icon: 'bolt', href: '/reception/register' },
  { title: 'Patient Lookup', body: 'Name / Phone / MRN', icon: 'person-search', href: '/reception/patients' },
  { title: 'Live Queue Board', body: 'Tokens by chamber', icon: 'desktop-windows', href: '/reception/queue' },
];

const actions: { label: string; icon: GlyphName; box: string; href: Href }[] = [
  { label: 'Attendance', icon: 'schedule', box: 'bg-mint/60', href: '/me/attendance' },
  { label: 'Leaves', icon: 'event-available', box: 'bg-sky-300', href: '/me/leave' },
  { label: 'Salary', icon: 'payments', box: 'bg-[#ffdad6]', href: '/me/salary' },
];

// A confirmed visit this many minutes past its time without the patient arriving needs a call.
const LATE_MINUTES = 15;
const SOON_MINUTES = 120;

const greeting = (minute: number) => (minute < 12 * 60 ? 'Good morning' : minute < 17 * 60 ? 'Good afternoon' : 'Good evening');
const pad = (count: number) => String(count).padStart(2, '0');
const share = (part: number, whole: number): `${number}%` => `${whole ? Math.round((part / whole) * 100) : 0}%`;

export default function ReceptionCockpit() {
  const toast = useToast();
  const now = useNow();
  const signedIn = useSignedIn();
  const day = useDay();
  const action = useAppointmentAction();
  const [filter, setFilter] = useState('all');

  const data = day.data;
  const minute = data ? clinicMinute(now, data.timeZone) : 0;
  const all = data?.appointments ?? [];
  const booked = all.filter((row) => row.status !== 'cancelled');
  const present = booked.filter((row) => row.status === 'arrived' || row.status === 'in_progress' || row.status === 'completed');
  const waiting = booked.filter((row) => row.status === 'arrived').sort((a, b) => (a.arrivedAt ?? '').localeCompare(b.arrivedAt ?? ''));
  const completed = booked.filter((row) => row.status === 'completed');
  const walkIns = booked.filter((row) => row.waitingQueue).length;
  const averageWait = waiting.length ? Math.round(waiting.reduce((sum, row) => sum + minutesSince(row.arrivedAt!, now), 0) / waiting.length) : 0;

  const pending = booked.filter((row) => row.status === 'pending');
  const late = booked.filter((row) => row.status === 'confirmed' && !row.waitingQueue && minute - minuteOf(row.time) > LATE_MINUTES);

  // The two practitioners with the most visits today get a filter of their own.
  const counts = new Map<string, { name: string; count: number }>();
  for (const row of booked) counts.set(row.practitioner.id, { name: row.practitioner.displayName, count: (counts.get(row.practitioner.id)?.count ?? 0) + 1 });
  const busiest = [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 2);
  const soon = (row: DayAppointment) => minuteOf(row.time) >= minute - LATE_MINUTES && minuteOf(row.time) <= minute + SOON_MINUTES;
  const filters = [
    { value: 'all', label: `All (${booked.length})` },
    { value: 'soon', label: `Next 2 Hours (${booked.filter(soon).length})` },
    ...busiest.map(([id, entry]) => ({ value: id, label: `${entry.name} (${entry.count})` })),
  ];
  const visible = booked.filter((row) => filter === 'all' || (filter === 'soon' ? soon(row) : row.practitioner.id === filter));

  const stats: { label: string; icon: GlyphName; value: string; suffix: string; note: string; share: `${number}%`; bar: string }[] = [
    { label: 'Scheduled', icon: 'calendar-today', value: pad(booked.length), suffix: 'visits', note: walkIns ? `+${walkIns} walk-in tokens` : 'No walk-in tokens', share: '100%', bar: 'bg-slate' },
    { label: 'Arrived', icon: 'check-circle', value: pad(present.length), suffix: share(present.length, booked.length), note: 'Intake progress', share: share(present.length, booked.length), bar: 'bg-deep' },
    { label: 'In Waiting', icon: 'schedule', value: pad(waiting.length), suffix: 'Active', note: waiting.length ? `Avg wait: ${averageWait} mins` : 'Lounge is empty', share: share(waiting.length, booked.length), bar: 'bg-[#d97706]' },
    { label: 'Completed', icon: 'check-circle-outline', value: pad(completed.length), suffix: `/ ${booked.length}`, note: 'Visits closed', share: share(completed.length, booked.length), bar: 'bg-[#059669]' },
  ];

  const open = (row: { id: string }) => router.push(`/reception/appointment/${row.id}`);
  const firstName = signedIn?.user.fullName.split(/\s+/)[0] ?? '';
  const attention = pending.length + late.length;

  return (
    <Screen inTabs className="bg-sky-50" header={<DeskHeader date={data?.date} />} contentClassName="gap-3.5 px-4 pt-3 pb-6">
      {day.error && !data ? <ErrorState message={day.error.message} onAction={day.reload} /> : null}
      {!data && !day.error ? <LoadingState label="Loading today's desk…" /> : null}
      {data ? (
        <>
          <View className="flex-row items-center gap-2 rounded-xl bg-sky-100 px-3 py-2.5">
            <Glyph name="desktop-windows" size={15} color={colors.slate} />
            <Text numberOfLines={1} className="flex-1 font-pj-bd text-[11px] leading-4 text-ink">
              {data.branches.map((branch) => branch.name).join(' · ') || 'No branch in your role'}
            </Text>
            <Text className="font-pj-bd text-[10px] leading-[15px] text-slate">● LIVE</Text>
          </View>

          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <Text accessibilityRole="header" className="font-pj-bd text-[19px] leading-6 text-ink">
                {greeting(minute)}
                {firstName ? `, ${firstName}` : ''}
              </Text>
              <Text className="text-[12px] leading-[17px] text-slate">
                {waiting.length === 1 ? '1 patient is waiting in the lounge.' : `${waiting.length} patients are waiting in the lounge.`}
              </Text>
            </View>
            <RoundButton icon="sync" label="Refresh" onPress={day.reload} className="rounded-xl bg-white" />
          </View>

          <View className="flex-row flex-wrap justify-between gap-y-3">
            {stats.map((stat) => (
              <View key={stat.label} className="w-[48.3%] overflow-hidden rounded-2xl border border-sky-150/50 bg-white">
                <LinearGradient colors={stat.label === 'Arrived' ? ['#e0f3ee', '#ffffff'] : ['#ffffff', '#ffffff']}>
                  <View className="gap-1.5 p-3.5">
                    <View className="flex-row items-center justify-between">
                      <Text className="font-pj-md text-[13px] leading-[18px] text-slate">{stat.label}</Text>
                      <IconTile icon={stat.icon} className="size-7" />
                    </View>
                    <Text className="font-pj-bd text-[24px] leading-8 text-ink">
                      {stat.value} <Text className="font-pj-md text-[11px] text-slate">{stat.suffix}</Text>
                    </Text>
                    <Text className="font-pj-sb text-[11px] leading-4 text-ink">{stat.note}</Text>
                    <View className="mt-1 h-1 rounded-full bg-sky-150">
                      <View className={cn('h-1 rounded-full', stat.bar)} style={{ width: stat.share }} />
                    </View>
                  </View>
                </LinearGradient>
              </View>
            ))}
          </View>

          <Text className="font-pj-bd text-[12px] leading-[18px] text-slate">QUICK DESK ACTIONS</Text>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {shortcuts.map((item) => (
              <Pressable
                key={item.title}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                onPress={() => router.push(item.href)}
                className={cn(
                  'min-h-[92px] w-[48.3%] justify-between rounded-2xl border p-3.5 active:opacity-80',
                  item.dark ? 'border-black bg-black' : 'border-sky-150/50 bg-white',
                )}>
                <View className="flex-row items-center justify-between">
                  <IconTile
                    icon={item.icon}
                    box={item.dark ? 'bg-white/10' : item.icon === 'bolt' ? 'bg-mint' : 'bg-sky-150'}
                    color={item.dark ? '#ffffff' : colors.ink}
                    className="size-7"
                  />
                  <Glyph name="arrow-forward" size={15} color={item.dark ? '#ffffff' : colors.slate} />
                </View>
                <View className="pt-2">
                  <Text className={cn('font-pj-bd text-[14px] leading-[18px]', item.dark ? 'text-white' : 'text-ink')}>{item.title}</Text>
                  <Text className={cn('font-pj-sb text-[11px] leading-4', item.dark ? 'text-white/60' : 'text-slate')}>{item.body}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          <View className="flex-row items-center gap-2">
            <View className="size-2.5 rounded-full bg-danger" />
            <Heading
              title="Needs Attention"
              className="flex-1"
              right={<Chip label={`${attention} pending items`} tone={attention ? 'red' : 'mint'} className="self-center" />}
            />
          </View>
          {attention === 0 ? <EmptyState title="All clear" message="Nothing is waiting for the desk right now." /> : null}
          {pending.map((row) => (
            <View key={row.id} className="gap-2.5 rounded-2xl border-l-4 border-sky-150 bg-white p-3.5">
              <View className="flex-row items-center gap-2.5">
                <IconTile icon="phone-callback" box="bg-[#fef3c7]" color="#b45309" />
                <View className="flex-1">
                  <View className="flex-row items-center gap-1.5">
                    <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">Pending Confirmation</Text>
                    <Chip label={clock(row.time)} tone="amber" className="self-center" />
                  </View>
                  <Text className="text-[12px] leading-[17px] text-slate">
                    {row.patient.fullName} · {row.practitioner.displayName}
                  </Text>
                </View>
              </View>
              <View className="flex-row gap-2">
                <ActionButton label="Open & Call" icon="call" tone="dark" className="flex-1" onPress={() => open(row)} />
                <ActionButton
                  label="Confirm"
                  tone="mint"
                  disabled={action.isBusy(row.id, 'confirm')}
                  onPress={() => action.run(row.id, 'confirm', {}, `${row.patient.fullName}'s ${clock(row.time)} slot is confirmed.`).then(day.reload)}
                />
              </View>
            </View>
          ))}
          {late.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${row.patient.fullName}'s appointment`}
              onPress={() => open(row)}
              className="flex-row items-center gap-2.5 rounded-2xl border-l-4 border-sky-150 bg-white p-3.5">
              <IconTile icon="timelapse" box="bg-[#ffdad6]" color="#ba1a1a" />
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">Not Arrived</Text>
                  <Chip label={`+${minute - minuteOf(row.time)} min`} tone="red" className="self-center" />
                </View>
                <Text className="text-[12px] leading-[17px] text-slate">
                  {row.patient.fullName} · {clock(row.time)} · {row.practitioner.displayName}
                </Text>
              </View>
              <Glyph name="chevron-right" size={18} color={colors.slate} />
            </Pressable>
          ))}

          <Heading
            title="Waiting Lounge"
            right={
              <View className="flex-row items-center gap-2">
                <Chip label={`${waiting.length} Present`} tone="mint" className="self-center" />
                <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push('/reception/queue')}>
                  <Text className="font-pj-bd text-[11px] leading-4 text-slate">Queue board ↗</Text>
                </Pressable>
              </View>
            }
          />
          {waiting.length === 0 ? <EmptyState title="Lounge is empty" message="Checked-in patients waiting for their doctor appear here." /> : null}
          {waiting.map((row, index) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${row.patient.fullName}'s appointment`}
              onPress={() => open(row)}
              className="flex-row items-center gap-3 rounded-2xl border border-sky-150/50 bg-white p-3">
              <View className={cn('size-11 items-center justify-center rounded-xl', index === 0 ? 'bg-mint' : 'bg-sky-150')}>
                <Text className="font-pj-bd text-[8px] leading-3 text-slate">TKN</Text>
                <Text className="font-pj-bd text-[13px] leading-4 text-ink">{row.token ?? '—'}</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">
                  {row.patient.fullName} <Text className="text-[10px] text-slate">{ageSex(row.patient, data.today)}</Text>
                </Text>
                <View className="flex-row flex-wrap items-center gap-1.5">
                  <Chip label={[row.practitioner.room, row.practitioner.displayName].filter(Boolean).join(' · ')} />
                  <Text className="font-pj-sb text-[11px] leading-4 text-slate">Wait {row.arrivedAt ? minutesSince(row.arrivedAt, now) : 0}m</Text>
                </View>
              </View>
              <Glyph name="chevron-right" size={18} color={colors.slate} />
            </Pressable>
          ))}

          <Heading
            title="Today's Schedule"
            right={
              <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.navigate('/reception/appointments')}>
                <Text className="font-pj-bd text-[11px] leading-4 text-slate">View all {booked.length} ›</Text>
              </Pressable>
            }
          />
          <FilterChips options={filters} value={filters.some((option) => option.value === filter) ? filter : 'all'} onChange={setFilter} />
          {visible.length === 0 ? <EmptyState title="No visits here" message={booked.length ? 'No visits match this filter.' : 'Nothing is booked for today yet.'} /> : null}
          {visible.map((row) => {
            const status = STATUS[row.status];
            const label = row.status === 'arrived' && row.token ? `Arrived · Tkn ${row.token}` : status.label;
            return (
              <View key={row.id} className="gap-1.5 rounded-2xl border border-sky-150/60 bg-white p-3.5">
                <View className="flex-row items-center gap-2">
                  <Text className="font-pj-bd text-[14px] leading-5 text-ink">{row.waitingQueue ? 'Walk-in' : clock(row.time)}</Text>
                  <Chip label={label} tone={status.tone} className="self-center" />
                  <Text className="flex-1 text-right text-[11px] leading-4 text-slate">{TYPE_LABEL[row.type]}</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable accessibilityRole="button" accessibilityLabel={`Open ${row.patient.fullName}'s appointment`} onPress={() => open(row)} className="flex-1">
                    <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{row.patient.fullName}</Text>
                    <Text className="text-[12px] leading-[17px] text-slate">{practitionerLine(row.practitioner)}</Text>
                  </Pressable>
                  {isOpen(row.status) ? (
                    <ActionButton
                      label="Check In"
                      tone="dark"
                      disabled={action.isBusy(row.id, 'check-in')}
                      onPress={() =>
                        action
                          .run(row.id, 'check-in', {})
                          .then((updated) => {
                            if (updated) toast(`${row.patient.fullName} is checked in${updated.queueToken ? ` · Token ${updated.queueToken}` : ''}.`);
                            day.reload();
                          })
                      }
                    />
                  ) : (
                    <RoundButton icon="chevron-right" label={`Open ${row.patient.fullName}'s appointment`} onPress={() => open(row)} className="rounded-xl bg-mint" />
                  )}
                </View>
              </View>
            );
          })}

          <Text className="pt-2 font-pj-bd text-[12px] leading-[18px] text-ink">ACTIONS</Text>
          <View className="flex-row gap-3">
            {actions.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => router.push(item.href)}
                className="w-[27%] items-center gap-1.5 rounded-2xl border border-sky-150 bg-white py-3">
                <IconTile icon={item.icon} box={item.box} className="size-9 rounded-xl" />
                <Text className="font-pj-bd text-[11px] leading-4 text-ink">{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}
