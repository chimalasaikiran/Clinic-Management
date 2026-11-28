import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { T } from '@/features/consultation/design';
import { useClinicalDay, type ClinicalDay } from '@/features/doctor/clinical';
import { addDays, ageSex, clock, dayLabel, dayOfMonth, localToday, minuteOf, STATUS, TYPE_LABEL, weekdayOf } from '@/features/reception/desk';
import { useStartConsultation } from '@/features/today/FlowCard';
import { cn } from '@/lib/cn';
import { useStaff } from '@/state/StaffState';

type Row = ClinicalDay['appointments'][number];
type Filter = 'all' | 'arrived' | 'in_progress' | 'confirmed' | 'completed';
type Session = 'all' | 'morning' | 'afternoon';
const AFTERNOON = 13 * 60;
const DOT: Partial<Record<Row['status'], string>> = { in_progress: '#000000', arrived: '#4d626a', completed: '#a8cec6' };

function TimelineRow({ time, dot = '#c7dee8', strong, children }: { time: string; dot?: string; strong?: boolean; children: ReactNode }) {
  const [hhmm, half] = time.split(' ');
  return (
    <View className="flex-row gap-3">
      <View className="w-14 pt-1">
        <T v="label" className={cn('text-[13px] text-slate', strong && 'font-pj-bd text-ink')}>{hhmm}</T>
        <Text className="text-[10px] leading-[15px] text-slate">{half}</Text>
      </View>
      <View className="w-2.5 items-center pt-1.5">
        <View className="size-2.5 rounded-full" style={{ backgroundColor: dot }} />
        <View className="w-0.5 flex-1 bg-sky-150" />
      </View>
      <View className="flex-1 pb-3">{children}</View>
    </View>
  );
}

export default function DoctorSchedule() {
  const { me } = useStaff();
  const today = localToday();
  const [date, setDate] = useState(today);
  const [session, setSession] = useState<Session>('all');
  const [filter, setFilter] = useState<Filter>('all');
  const day = useClinicalDay(date);
  const { start, busy } = useStartConsultation();

  const data = day.data;
  const myId = data?.me.practitionerId;
  const rows = (data?.appointments ?? []).filter((row) => row.status !== 'cancelled' && row.status !== 'no_show' && (!myId || row.practitioner.id === myId));
  const inSession = rows.filter((row) => session === 'all' || (session === 'morning' ? minuteOf(row.time) < AFTERNOON : minuteOf(row.time) >= AFTERNOON));
  const matches = (row: Row, value: Filter) => value === 'all' || row.status === value || (value === 'confirmed' && row.status === 'pending');
  const visible = inSession.filter((row) => matches(row, filter));
  const count = (value: Filter) => inSession.filter((row) => matches(row, value)).length;
  const week = Array.from({ length: 7 }, (_, index) => addDays(today, index - 1));
  const filters: { value: Filter; label: string; dot?: string }[] = [
    { value: 'all', label: `All (${count('all')})` },
    { value: 'arrived', label: `Waiting (${count('arrived')})`, dot: '#4d626a' },
    { value: 'in_progress', label: `In Consult (${count('in_progress')})`, dot: '#000000' },
    { value: 'confirmed', label: `Booked (${count('confirmed')})` },
    { value: 'completed', label: `Completed (${count('completed')})` },
  ];

  const openRow = (row: Row) => (row.status === 'arrived' || row.status === 'in_progress' ? start(row) : router.push(`/appointment/${row.id}`));

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <View className="gap-1 border-b border-sky-150/60 bg-sky-50 px-4 py-2.5">
          <Text accessibilityRole="header" className="font-pj-bd text-[19px] leading-6 text-ink">
            My Schedule
          </Text>
          <Text className="text-[12px] leading-4 text-slate">
            {me.name} · {dayLabel(date, true)}
          </Text>
        </View>
      }
      contentClassName="gap-3 px-4 pt-3 pb-6">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {week.map((value) => {
          const active = value === date;
          return (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityLabel={dayLabel(value, true)}
              accessibilityState={{ selected: active }}
              onPress={() => setDate(value)}
              className={cn('w-[52px] items-center rounded-2xl py-2', active ? 'bg-black' : 'bg-white')}>
              <Text className={cn('font-pj-bd text-[10px] leading-[15px]', active ? 'text-white/70' : 'text-slate')}>{weekdayOf(value).toUpperCase()}</Text>
              <Text className={cn('font-pj-bd text-[17px] leading-6', active ? 'text-white' : 'text-ink')}>{dayOfMonth(value)}</Text>
              {value === today ? <View className={cn('size-1.5 rounded-full', active ? 'bg-mint' : 'bg-teal')} /> : <View className="size-1.5" />}
            </Pressable>
          );
        })}
      </ScrollView>

      <View className="flex-row rounded-xl bg-sky-100 p-1">
        {(['all', 'morning', 'afternoon'] as const).map((value) => (
          <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: session === value }} onPress={() => setSession(value)} className={cn('flex-1 items-center rounded-lg py-2', session === value && 'bg-white')}>
            <Text className="font-pj-bd text-[11px] leading-4 text-ink">{value === 'all' ? 'Full Day' : value === 'morning' ? 'Morning' : 'Afternoon'}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {filters.map((item) => (
          <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{ selected: filter === item.value }} onPress={() => setFilter(item.value)} className={cn('flex-row items-center gap-1 rounded-full px-3 py-1.5', filter === item.value ? 'bg-black' : 'bg-white')}>
            {item.dot ? <View className="size-1.5 rounded-full" style={{ backgroundColor: item.dot }} /> : null}
            <Text className={cn('font-pj-bd text-[11px] leading-4', filter === item.value ? 'text-white' : 'text-slate')}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {day.error && !data ? <ErrorState message={day.error.message} onAction={day.reload} /> : null}
      {day.loading && !data ? <LoadingState label="Loading the schedule…" /> : null}
      {data && visible.length === 0 ? <EmptyState title="Nothing here" message={rows.length ? 'No visits match this view.' : `Nothing booked with you on ${dayLabel(date)}.`} /> : null}
      {data
        ? visible.map((row) => {
            const status = STATUS[row.status];
            return (
              <TimelineRow key={row.id} time={row.waitingQueue ? 'Walk in' : clock(row.time)} dot={DOT[row.status]} strong={row.status === 'in_progress'}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${row.patient.fullName}, ${status.label}`} onPress={() => openRow(row)} className={cn('gap-1.5 rounded-2xl p-3.5', row.status === 'in_progress' ? 'bg-black' : 'bg-white')}>
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className={cn('flex-1 font-pj-bd text-[14px] leading-5', row.status === 'in_progress' ? 'text-white' : 'text-ink')}>
                      {row.patient.fullName} <Text className={cn('text-[11px]', row.status === 'in_progress' ? 'text-white/70' : 'text-slate')}>{ageSex(row.patient, data.today)}</Text>
                    </Text>
                    <View className={cn('rounded-full px-2 py-0.5', row.status === 'in_progress' ? 'bg-white/15' : 'bg-sky-150')}>
                      <Text className={cn('font-pj-sb text-[10px] leading-[15px]', row.status === 'in_progress' ? 'text-white' : 'text-[#526871]')}>{busy === row.id ? 'Opening…' : status.label}</Text>
                    </View>
                  </View>
                  <Text className={cn('text-[12px] leading-[17px]', row.status === 'in_progress' ? 'text-white/80' : 'text-slate')}>
                    {TYPE_LABEL[row.type]} · {row.reason}
                  </Text>
                  <View className="flex-row items-center justify-between gap-2">
                    <Text className={cn('text-[11px] leading-4', row.status === 'in_progress' ? 'text-white/60' : 'text-slate')}>
                      {row.patient.mrn}
                      {row.token ? ` · Token ${row.token}` : ''}
                      {row.vitals ? ` · BP ${row.vitals.systolic}/${row.vitals.diastolic}` : ''}
                    </Text>
                    <Icon name="chevron-right-slate" />
                  </View>
                </Pressable>
              </TimelineRow>
            );
          })
        : null}
    </Screen>
  );
}
