import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { FilterChips } from '@/components/ui/FilterChips';
import { Icon } from '@/components/ui/Icon';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useClinicalDay } from '@/features/doctor/clinical';
import { dayLabel, minutesSince, useNow } from '@/features/reception/desk';
import { FlowCard } from '@/features/today/FlowCard';
import { useStaff } from '@/state/StaffState';

type Filter = 'active' | 'waiting' | 'in-room' | 'completed';

export default function PatientQueue() {
  const { me } = useStaff();
  const now = useNow();
  const day = useClinicalDay();
  const [filter, setFilter] = useState<Filter>('active');
  const [query, setQuery] = useState('');
  const [byName, setByName] = useState(false);

  const data = day.data;
  const myId = data?.me.practitionerId;
  const rows = (data?.appointments ?? []).filter((row) => row.status !== 'cancelled' && row.status !== 'no_show' && (!myId || row.practitioner.id === myId));
  const waiting = rows.filter((row) => row.status === 'arrived').sort((a, b) => (a.arrivedAt ?? '').localeCompare(b.arrivedAt ?? ''));
  const inRoom = rows.filter((row) => row.status === 'in_progress');
  const completed = rows.filter((row) => row.status === 'completed');
  const scheduled = rows.filter((row) => row.status === 'pending' || row.status === 'confirmed');
  const averageWait = waiting.length ? Math.round(waiting.reduce((sum, row) => sum + minutesSince(row.arrivedAt!, now), 0) / waiting.length) : 0;
  const alerts = data?.clinical?.alerts.total ?? 0;

  const needle = query.trim().toLowerCase();
  const base = { active: [...inRoom, ...waiting, ...scheduled], waiting, 'in-room': inRoom, completed }[filter];
  const matched = base.filter((row) => `${row.patient.fullName} ${row.token ?? ''} ${row.patient.mrn}`.toLowerCase().includes(needle));
  const ordered = byName ? [...matched].sort((a, b) => a.patient.fullName.localeCompare(b.patient.fullName)) : matched;
  const filters = [
    { value: 'active' as const, label: `All Active (${inRoom.length + waiting.length + scheduled.length})` },
    { value: 'waiting' as const, label: `Waiting (${waiting.length})` },
    { value: 'in-room' as const, label: `In Room (${inRoom.length})` },
    { value: 'completed' as const, label: `Completed (${completed.length})` },
  ];

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <View className="flex-row items-center gap-2.5 border-b border-sky-150/60 bg-sky-50/90 px-4 py-2.5">
          <View className="size-10 items-center justify-center rounded-2xl bg-black">
            <Text className="font-pj-bd text-[14px] leading-5 text-white">{me.initials}</Text>
          </View>
          <View className="flex-1">
            <Text numberOfLines={1} className="font-pj-bd text-[14px] leading-5 text-ink">
              {me.name}
            </Text>
            <Text numberOfLines={1} className="font-pj-md text-[11px] leading-4 text-slate">
              {me.branch}
            </Text>
          </View>
          <IconButton icon="search" label="Search all patients" className="rounded-xl border border-sky-250/40 bg-white" onPress={() => router.push('/patients/search')} />
        </View>
      }
      contentClassName="gap-3 px-4 pt-3 pb-6">
      {day.error && !data ? <ErrorState message={day.error.message} onAction={day.reload} /> : null}
      {!data && !day.error ? <LoadingState label="Loading your queue…" /> : null}
      {data ? (
        <>
          <View className="flex-row items-center gap-3 rounded-2xl border border-sky-250/40 bg-white p-3.5">
            <View className="size-10 items-center justify-center rounded-xl bg-mint">
              <Icon name="vitals" color="#00201c" size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-pj-bd text-[14px] leading-5 text-ink">{me.department ? `${me.department} OPD` : 'OPD'}</Text>
              <Text className="font-pj-md text-[12px] leading-[18px] text-slate">
                {dayLabel(data.date)} · {rows.length} booked · {completed.length} seen
              </Text>
            </View>
          </View>

          <View className="flex-row gap-2">
            <SearchField value={query} onChangeText={setQuery} placeholder="Search patient, token, MRN..." className="min-h-[40px] flex-1 border-sky-250/40" />
            <Pressable accessibilityRole="button" accessibilityLabel={`Sorted by ${byName ? 'name' : 'arrival'}`} onPress={() => setByName(!byName)} className="flex-row items-center gap-1 rounded-xl border border-sky-250/40 bg-white px-3">
              <Text className="font-pj-sb text-[12px] leading-4 text-ink">⇅ {byName ? 'Name' : 'Arrival'}</Text>
            </Pressable>
          </View>

          <View className="flex-row gap-2">
            <View className="flex-1 rounded-2xl border border-mint bg-mint/80 p-2.5">
              <Text className="font-pj-bd text-[10px] leading-[15px] text-deep">WAITING</Text>
              <View className="flex-row items-end gap-1">
                <Text className="font-pj-bd text-[20px] leading-7 text-deep">{waiting.length}</Text>
                {waiting.length ? <Text className="pb-1 font-pj-sb text-[10px] leading-[15px] text-deep">~{averageWait}m avg</Text> : null}
              </View>
            </View>
            <View className="flex-1 rounded-2xl border border-sky-250/40 bg-white p-2.5">
              <Text className="font-pj-bd text-[10px] leading-[15px] text-slate">DONE</Text>
              <Text className="font-pj-bd text-[20px] leading-7 text-ink">{completed.length}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={`${alerts} serious alerts`} onPress={() => router.push('/inbox')} className="flex-1 rounded-2xl border border-[#fecaca] bg-[#fff5f5] p-2.5">
              <Text className="font-pj-bd text-[10px] leading-[15px] text-[#93000a]">ALERTS</Text>
              <Text className="font-pj-bd text-[20px] leading-7 text-[#93000a]">{alerts}</Text>
            </Pressable>
          </View>

          <FilterChips options={filters} value={filter} onChange={setFilter} />
          {ordered.length === 0 ? <EmptyState title="No patients here" message={needle ? 'No patient matches this search.' : 'Nobody in this view right now.'} /> : null}
          {ordered.map((row) => (
            <FlowCard key={row.id} row={row} today={data.today} next={row.id === waiting[0]?.id} now={now} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
