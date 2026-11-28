import { useRef, useState, type ComponentRef } from 'react';
import { TextInput, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Glyph, RoundButton } from '@/components/staff/ui';
import { FilterChips } from '@/components/ui/FilterChips';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useNow } from '@/features/reception/desk';
import { PatientCard } from '@/features/nurse/PatientCard';
import { ForestCard, NurseProfileButton } from '@/features/nurse/ui';
import { groupOf, useWard, type WardGroup } from '@/features/nurse/ward';
import { cn } from '@/lib/cn';
import { useSignedIn } from '@/state/SessionState';
import colors from '@/theme/colors';

type Filter = 'all' | 'attention' | 'vitals' | 'ready' | 'expected';
const ORDER: WardGroup[] = ['attention', 'vitals', 'ready', 'consult', 'expected', 'done'];

export default function NurseQueue() {
  const now = useNow();
  const signedIn = useSignedIn();
  const { day, rows, needsVitals, abnormal, ready } = useWard();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const searchBox = useRef<ComponentRef<typeof TextInput>>(null);

  const data = day.data;
  const query = search.trim().toLowerCase();
  const visible = rows
    .filter((row) => (filter === 'all' || groupOf(row) === filter) && `${row.patient.fullName} ${row.token ?? ''} ${row.patient.mrn} ${row.practitioner.displayName} ${row.practitioner.room ?? ''}`.toLowerCase().includes(query))
    .sort((a, b) => ORDER.indexOf(groupOf(a)) - ORDER.indexOf(groupOf(b)) || (a.arrivedAt ?? a.time).localeCompare(b.arrivedAt ?? b.time));
  const count = (group: WardGroup) => rows.filter((row) => groupOf(row) === group).length;
  const options = [
    { value: 'all' as const, label: `All  ${rows.length}` },
    { value: 'attention' as const, label: `Attention  ${count('attention')}` },
    { value: 'vitals' as const, label: `Vitals Pending  ${count('vitals')}` },
    { value: 'ready' as const, label: `Ready  ${count('ready')}` },
    { value: 'expected' as const, label: `Not Arrived  ${count('expected')}` },
  ];
  const stats = [
    { value: rows.length, label: 'ON LIST', color: 'text-white' },
    { value: abnormal.length, label: 'FLAGGED', color: 'text-[#fda4af]' },
    { value: needsVitals.length, label: 'VITALS DUE', color: 'text-[#fcd34d]' },
    { value: ready.length, label: 'READY', color: 'text-[#6ee7b7]' },
  ];

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <View className="flex-row items-center gap-2 border-b border-sky-150/60 bg-sky-50 px-4 py-2.5">
          <View className="flex-1">
            <Text accessibilityRole="header" className="font-pj-bd text-[18px] leading-6 text-ink">
              ● Patient Queue
            </Text>
            <Text numberOfLines={1} className="text-[12px] leading-4 text-slate">
              {signedIn?.membership?.organisation.name ?? ''}
            </Text>
          </View>
          <RoundButton icon="search" label="Search the queue" onPress={() => searchBox.current?.focus()} className="bg-sky-100" />
          <NurseProfileButton />
        </View>
      }
      contentClassName="gap-3.5 px-4 pt-3 pb-6">
      <ForestCard>
        <Text className="font-pj-bd text-[17px] leading-6 text-white">Preparation Queue</Text>
        <Text className="text-[12px] leading-[17px] text-white/60">{data?.branches.map((branch) => branch.name).join(' · ') ?? ' '}</Text>
        <View className="flex-row gap-2 border-t border-white/10 pt-3">
          {stats.map((stat) => (
            <View key={stat.label} className="flex-1 items-center rounded-xl bg-white/5 py-2">
              <Text className={cn('font-pj-bd text-[20px] leading-7', stat.color)}>{stat.value}</Text>
              <Text className="font-pj-bd text-[9px] leading-[13px] text-white/70">{stat.label}</Text>
            </View>
          ))}
        </View>
      </ForestCard>

      <View className="min-h-[42px] flex-row items-center gap-2 rounded-2xl bg-white px-3">
        <Glyph name="search" size={17} color={colors.slate} />
        <TextInput
          ref={searchBox}
          accessibilityLabel="Search patient, token or doctor"
          placeholder="Search patient, token, or doctor"
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          className="flex-1 py-2 font-pj text-[13px] text-ink"
        />
        {search ? <RoundButton icon="close" label="Clear search" onPress={() => setSearch('')} className="size-6" /> : null}
      </View>
      <FilterChips options={options} value={filter} onChange={setFilter} />
      {day.error && !data ? <ErrorState message={day.error.message} onAction={day.reload} /> : null}
      {!data && !day.error ? <LoadingState label="Loading the queue…" /> : null}
      {data && visible.length === 0 ? (
        <EmptyState
          title="No patients found"
          message={rows.length ? 'Try a name, token, patient ID or doctor.' : 'Nobody is booked for today yet.'}
          actionLabel={rows.length ? 'Clear search' : undefined}
          onAction={() => {
            setSearch('');
            setFilter('all');
          }}
        />
      ) : null}
      {data ? visible.map((row) => <PatientCard key={row.id} row={row} today={data.today} now={now} />) : null}
    </Screen>
  );
}
