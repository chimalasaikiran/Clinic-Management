import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { FilterChips } from '@/components/ui/FilterChips';
import { Pill } from '@/components/ui/Pill';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { DiscoverCard } from '@/features/clinics/ClinicCards';
import { useList } from '@/hooks/useResource';
import { cn } from '@/lib/cn';
import type { Clinic } from '@/types';

const filters = [
  { value: 'all', label: 'All Clinics' },
  { value: 'saved', label: 'Saved' },
] as const;

const SEARCH_DELAY_MS = 300;

const kicker = 'font-pj-bd text-[13px] leading-5 tracking-[0.65px]';

export default function FindClinic() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<(typeof filters)[number]['value']>('all');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const params = [`pageSize=50`, search ? `query=${encodeURIComponent(search)}` : '', filter === 'saved' ? 'saved=true' : ''].filter(Boolean).join('&');
  const clinics = useList<Clinic>(`/v1/patient/clinics?${params}`, ['app_access']);
  const results = clinics.data?.data ?? [];
  const total = clinics.data?.meta.total ?? results.length;
  const connected = results.filter((clinic) => clinic.connected);
  const others = results.filter((clinic) => !clinic.connected);

  const card = (clinic: Clinic, outlined = false) => (
    <DiscoverCard key={clinic.id} clinic={clinic} outlined={outlined} onPress={() => router.push(`/clinic/${clinic.id}`)} />
  );

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <View className="gap-3 bg-sky-50 px-5 pb-3 pt-3">
          <View>
            <Text accessibilityRole="header" className="font-pj-bd text-[22px] leading-7 tracking-[-0.33px] text-ink">
              Find a Clinic
            </Text>
            <Text className="text-[14px] leading-5 text-slate">Find a clinic and see your connected practices.</Text>
          </View>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search by clinic, city or PIN code" />
          <FilterChips options={filters} value={filter} onChange={setFilter} />
        </View>
      }
      contentClassName="gap-6 pt-2 pb-6">
      {!clinics.data ? (
        clinics.error ? (
          <ErrorState message={clinics.error.message} onAction={clinics.reload} />
        ) : (
          <LoadingState label="Finding clinics…" />
        )
      ) : results.length === 0 ? (
        <EmptyState
          title="No clinics found"
          message={
            search
              ? 'Try a different name, city or PIN code.'
              : filter === 'saved'
                ? 'Save a clinic from its page to find it here.'
                : 'No clinic has opened itself to the patient app yet.'
          }
          actionLabel={search || filter !== 'all' ? 'Clear filters' : undefined}
          onAction={() => {
            setQuery('');
            setFilter('all');
          }}
        />
      ) : (
        <>
          {connected.length ? (
            <View className="gap-3">
              <View className="flex-row items-center gap-2">
                <View className="size-2 rounded-full bg-teal" />
                <Text className={cn(kicker, 'text-heading')}>CONNECTED CLINICS</Text>
                <Pill label={`${connected.length} shown`} />
              </View>
              {connected.map((clinic) => card(clinic))}
            </View>
          ) : null}
          {others.length ? (
            <View className="gap-3.5">
              <Text className={cn(kicker, 'text-slate')}>
                DISCOVER CLINICS{search || filter !== 'all' ? '' : ` (${total - connected.length})`}
              </Text>
              {others.map((clinic, index) => card(clinic, index === others.length - 1 && others.length > 1))}
            </View>
          ) : null}
          {total > results.length ? (
            <Text className="text-center text-[12px] leading-[18px] text-slate">
              Showing {results.length} of {total}. Search to narrow the list.
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}
