import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { FilterChips } from '@/components/ui/FilterChips';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import {
  addDays,
  ageSex,
  clinicMinute,
  clock,
  dayLabel,
  DeskHeader,
  minutesSince,
  STATUS,
  TYPE_LABEL,
  useAppointmentAction,
  useDay,
  useNow,
  type DayAppointment,
} from '@/features/reception/desk';
import { ActionButton, Chip, Glyph, RoundButton } from '@/features/reception/ui';
import { cn } from '@/lib/cn';

type Filter = 'all' | 'arrived' | 'confirmed' | 'pending' | 'closed';

const matches = (row: DayAppointment, filter: Filter) =>
  filter === 'all' ||
  (filter === 'arrived' && (row.status === 'arrived' || row.status === 'in_progress')) ||
  (filter === 'closed' && (row.status === 'completed' || row.status === 'cancelled' || row.status === 'no_show')) ||
  row.status === filter;

export default function ReceptionAppointments() {
  const toast = useToast();
  const now = useNow();
  const action = useAppointmentAction();
  const [date, setDate] = useState<string | undefined>(undefined);
  const day = useDay(date);
  const [view, setView] = useState<'list' | 'chambers'>('list');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  const data = day.data;
  const shown = data?.date ?? date;
  const today = data?.today;
  const rows = data?.appointments ?? [];
  const live = rows.filter((row) => row.status !== 'cancelled' && row.status !== 'no_show');
  const count = (status: Filter) => rows.filter((row) => matches(row, status)).length;
  const waiting = rows.filter((row) => row.status === 'arrived');
  const inRoom = rows.filter((row) => row.status === 'in_progress');
  const arrived = rows.filter((row) => row.status === 'arrived' || row.status === 'in_progress' || row.status === 'completed');
  const averageWait = waiting.length ? Math.round(waiting.reduce((sum, row) => sum + minutesSince(row.arrivedAt!, now), 0) / waiting.length) : 0;
  const isToday = !!data && data.date === data.today;
  const minute = data ? clinicMinute(now, data.timeZone) : 0;

  const needle = query.trim().toLowerCase();
  const visible = rows.filter(
    (row) => matches(row, filter) && `${row.patient.fullName} ${row.patient.mrn} ${row.token ?? ''} ${row.reference}`.toLowerCase().includes(needle),
  );

  const stats = [
    { label: 'Total', value: live.length, note: `${rows.filter((row) => row.waitingQueue).length} walk-in`, bar: 'bg-slate' },
    { label: 'Arrived', value: arrived.length, note: live.length ? `${Math.round((arrived.length / live.length) * 100)}%` : '0%', bar: 'bg-deep' },
    { label: 'Waiting', value: waiting.length, note: isToday && waiting.length ? `${averageWait}m avg` : '—', bar: 'bg-[#f59e0b]' },
    { label: 'In Room', value: inRoom.length, note: inRoom.map((row) => row.practitioner.room).filter(Boolean).join(', ') || '—', bar: 'bg-[#059669]' },
  ];

  const checkIn = (row: DayAppointment) =>
    action.run(row.id, 'check-in', {}).then((updated) => {
      if (updated) toast(`${row.patient.fullName} is checked in${updated.queueToken ? ` · Token ${updated.queueToken}` : ''}.`);
      day.reload();
    });
  const confirm = (row: DayAppointment) =>
    action.run(row.id, 'confirm', {}, `Slot confirmed for ${row.patient.fullName}.`).then(day.reload);
  const open = (row: DayAppointment) => router.push(`/reception/appointment/${row.id}`);

  const card = (row: DayAppointment) => {
    const status = STATUS[row.status];
    const closed = row.status === 'cancelled' || row.status === 'no_show';
    const waited = row.status === 'arrived' && row.arrivedAt ? minutesSince(row.arrivedAt, now) : null;
    const overdue = isToday && row.status === 'confirmed' && !row.waitingQueue ? minute - Number(row.time.slice(0, 2)) * 60 - Number(row.time.slice(3)) : 0;
    return (
      <View key={row.id} className={cn('flex-row gap-3', closed && 'opacity-60')}>
        <View className="items-center pt-4">
          <View className="size-3 rounded-full" style={{ backgroundColor: status.rail }} />
          <View className="w-0.5 flex-1" style={{ backgroundColor: status.rail }} />
        </View>
        <View className="mb-3 flex-1 gap-2 rounded-2xl border border-sky-150/60 bg-white p-3.5">
          <View className="flex-row items-start gap-2">
            <Chip label={row.waitingQueue ? 'Walk-in' : clock(row.time)} />
            <Chip label={status.label} tone={status.tone} />
            <View className="flex-1 items-end">
              {row.token ? (
                <View className="items-center rounded-xl bg-mint px-2 py-1">
                  <Text className="font-pj-bd text-[8px] leading-3 text-slate">TKN</Text>
                  <Text className="font-pj-bd text-[13px] leading-4 text-ink">{row.token}</Text>
                </View>
              ) : (
                <Text className="text-right text-[11px] leading-4 text-slate">{row.reference}</Text>
              )}
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Open ${row.patient.fullName}'s appointment`} onPress={() => open(row)}>
            <Text className={cn('font-pj-bd text-[16px] leading-[22px] text-ink', closed && 'line-through')}>
              {row.patient.fullName} <Text className="text-[11px] text-slate">{today ? ageSex(row.patient, today) : ''}</Text>
            </Text>
            <Text className="text-[12px] leading-[17px] text-slate">
              {row.patient.mrn} · {TYPE_LABEL[row.type]}
            </Text>
            <Text className="pt-1 font-pj-bd text-[12px] leading-[17px] text-ink">
              {row.practitioner.displayName}{' '}
              <Text className="text-[12px] text-slate">· {[row.practitioner.department, row.practitioner.room].filter(Boolean).join(' · ')}</Text>
            </Text>
            {waited !== null ? <Chip label={`Waited: ${waited} mins`} tone={waited >= 30 ? 'red' : 'amber'} className="mt-1" /> : null}
            {overdue > 15 ? <Chip label={`Not arrived · +${overdue} min`} tone="red" className="mt-1" /> : null}
            {row.reason ? (
              <Text numberOfLines={2} className="pt-0.5 font-pj-sb text-[11px] leading-4 text-slate">
                {row.reason}
              </Text>
            ) : null}
          </Pressable>
          {row.status === 'pending' || row.status === 'confirmed' ? (
            <View className="flex-row gap-2 pt-1">
              {row.status === 'pending' ? (
                <ActionButton label="Confirm Slot" icon="check" tone="mint" disabled={action.busy} onPress={() => confirm(row)} />
              ) : (
                <ActionButton label="Details" icon="north-east" tone="pale" onPress={() => open(row)} />
              )}
              {isToday ? (
                <ActionButton label="Mark Arrived" icon="how-to-reg" tone="dark" className="flex-1" disabled={action.busy} onPress={() => checkIn(row)} />
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const chambers = [...new Map(visible.map((row) => [row.practitioner.id, row.practitioner])).values()];
  const upcoming = visible.filter((row) => row.status === 'pending' || row.status === 'confirmed');
  const active = visible.filter((row) => row.status === 'arrived' || row.status === 'in_progress');
  const done = visible.filter((row) => row.status === 'completed' || row.status === 'cancelled' || row.status === 'no_show');
  const groups = [
    { key: 'active', title: 'IN CLINIC', rows: active },
    { key: 'upcoming', title: 'UPCOMING', rows: upcoming },
    { key: 'done', title: 'CLOSED', rows: done },
  ];

  const go = (offset: number) => shown && setDate(addDays(shown, offset));
  const chipDays = shown ? [-1, 0, 1].map((offset) => addDays(shown, offset)) : [];

  return (
    <Screen inTabs className="bg-sky-50" header={<DeskHeader date={today} />} contentClassName="gap-3 px-4 pt-3 pb-6">
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text accessibilityRole="header" className="font-pj-bd text-[22px] leading-7 text-ink">
              Appointments
            </Text>
            <Chip label="Live OPD" tone="steel" className="self-center" />
          </View>
          <Text className="text-[12px] leading-[17px] text-slate">{data?.branches.map((branch) => branch.name).join(' · ') ?? ' '}</Text>
        </View>
        <RoundButton icon="sync" label="Refresh schedule" onPress={day.reload} className="rounded-xl bg-white" />
      </View>

      <View className="gap-2.5 rounded-2xl bg-white p-3">
        <View className="flex-row items-center gap-2">
          <RoundButton icon="chevron-left" label="Previous day" onPress={() => go(-1)} className="size-8 rounded-lg bg-sky-150" />
          <Text className="flex-1 font-pj-bd text-[16px] leading-[22px] text-ink">{shown ? dayLabel(shown, true) : 'Loading…'}</Text>
          <RoundButton icon="chevron-right" label="Next day" onPress={() => go(1)} className="size-8 rounded-lg bg-sky-150" />
          {!isToday && today ? <ActionButton label="Today" icon="today" onPress={() => setDate(today)} /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {chipDays.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: value === shown }}
              onPress={() => setDate(value)}
              className={cn('rounded-full px-3 py-1.5', value === shown ? 'bg-black' : 'bg-sky-100')}>
              <Text className={cn('font-pj-bd text-[11px] leading-4', value === shown ? 'text-white' : 'text-slate')}>
                {value === today ? `● Today, ${dayLabel(value)}` : dayLabel(value)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text className="text-[12px] leading-[17px] text-slate">
          ● {live.length} scheduled • {chambers.length} {chambers.length === 1 ? 'doctor' : 'doctors'} · Queue: {waiting.length}
        </Text>
      </View>

      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row rounded-xl bg-sky-100 p-1">
          {([['list', `List View (${visible.length})`, 'view-agenda'], ['chambers', 'Chambers', 'grid-view']] as const).map(([value, label, icon]) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === value }}
              onPress={() => setView(value)}
              className={cn('flex-1 flex-row items-center justify-center gap-1 rounded-lg py-2', view === value && 'bg-white')}>
              <Glyph name={icon} size={13} />
              <Text className="font-pj-bd text-[11px] leading-4 text-ink">{label}</Text>
            </Pressable>
          ))}
        </View>
        <ActionButton label="Book" icon="add" tone="dark" className="min-h-[40px] px-4" onPress={() => router.push('/reception/book')} />
      </View>

      {day.error && !data ? <ErrorState message={day.error.message} onAction={day.reload} /> : null}
      {day.loading && !data ? <LoadingState label="Loading appointments…" /> : null}
      {data ? (
        <>
          <View className="flex-row justify-between">
            {stats.map((stat) => (
              <View key={stat.label} className="w-[23.5%] gap-1 rounded-2xl bg-white p-2.5">
                <Text className="font-pj-sb text-[10px] leading-[15px] text-slate">{stat.label}</Text>
                <Text className="font-pj-bd text-[20px] leading-7 text-ink">{String(stat.value).padStart(2, '0')}</Text>
                <Text numberOfLines={1} className="font-pj-bd text-[9px] leading-3 text-slate">
                  {stat.note}
                </Text>
                <View className={cn('h-1 rounded-full', stat.bar)} />
              </View>
            ))}
          </View>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search patient, MRN, token or reference..." />
          <FilterChips
            options={[
              { value: 'all', label: `All Status (${rows.length})` },
              { value: 'arrived', label: `Arrived • In Queue (${count('arrived')})` },
              { value: 'confirmed', label: `Confirmed (${count('confirmed')})` },
              { value: 'pending', label: `Pending (${count('pending')})` },
              { value: 'closed', label: `Closed (${count('closed')})` },
            ]}
            value={filter}
            onChange={setFilter}
          />

          {visible.length === 0 ? (
            <EmptyState
              title="No appointments found"
              message={rows.length ? 'Try a different search or status.' : `Nothing is booked for ${dayLabel(data.date)}.`}
            />
          ) : null}
          {view === 'chambers'
            ? chambers.map((practitioner) => {
                const mine = visible.filter((row) => row.practitioner.id === practitioner.id);
                return (
                  <View key={practitioner.id}>
                    <Text accessibilityRole="header" className="pb-2 font-pj-bd text-[13px] leading-[18px] text-ink">
                      {practitioner.displayName}
                      {practitioner.room ? ` · ${practitioner.room}` : ''} · {mine.length}
                    </Text>
                    {mine.map(card)}
                  </View>
                );
              })
            : groups.map((group) =>
                group.rows.length === 0 ? null : (
                  <View key={group.key}>
                    <View className="flex-row items-center justify-between gap-2 pb-2">
                      <Text className="font-pj-bd text-[11px] leading-4 text-slate">{group.title}</Text>
                      <Text className="text-[11px] leading-4 text-slate">{group.rows.length}</Text>
                    </View>
                    {group.rows.map(card)}
                  </View>
                ),
              )}
        </>
      ) : null}
    </Screen>
  );
}
