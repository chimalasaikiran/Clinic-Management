import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SearchField } from '@/components/ui/SearchField';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { AppointmentCard, NextVisitCard } from '@/features/appointments/AppointmentCard';
import { useList } from '@/hooks/useResource';
import { cn } from '@/lib/cn';
import { useAccount } from '@/state/SessionState';
import type { Appointment } from '@/types';

type Tab = 'upcoming' | 'past' | 'cancelled';

const tabs: { value: Tab; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TOPICS = ['appointments', 'app_access'] as const;

export default function MyAppointments() {
  const account = useAccount();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [showActions, setShowActions] = useState(false);
  const upcoming = useList<Appointment>('/v1/patient/appointments?scope=upcoming&pageSize=50', TOPICS);
  const past = useList<Appointment>('/v1/patient/appointments?scope=past&pageSize=50', TOPICS);

  // The server's history includes cancelled visits; they have their own tab here.
  const groups: Record<Tab, Appointment[]> = {
    upcoming: upcoming.data?.data ?? [],
    past: (past.data?.data ?? []).filter((item) => item.status !== 'cancelled'),
    cancelled: (past.data?.data ?? []).filter((item) => item.status === 'cancelled'),
  };
  const source = tab === 'upcoming' ? upcoming : past;
  const needle = query.trim().toLowerCase();
  const list = groups[tab].filter((item) =>
    `${item.clinicName} ${item.serviceName ?? ''} ${item.practitioner.department} ${item.reference}`.toLowerCase().includes(needle),
  );
  const next = tab === 'upcoming' && !needle ? list[0] : undefined;
  const older = (past.data?.meta.total ?? 0) - (past.data?.data.length ?? 0);

  const act = (path: 'reschedule' | 'cancel') => {
    setShowActions(false);
    if (!next) return;
    router.push(path === 'reschedule' ? `/reschedule/${next.id}` : `/appointments/${next.id}/cancel`);
  };

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <View className="flex-row items-center gap-3 border-b border-line/30 bg-sky-50 px-5 py-2">
          <View className="size-9 items-center justify-center rounded-full border border-line/40 bg-sky-300">
            <Icon name="tab-profile" color="#000000" />
          </View>
          <View className="flex-1">
            <Text className="font-pj-sb text-[18px] leading-[23px] tracking-[-0.2px] text-ink">Clinic OS</Text>
            <Text className="font-pj-bd text-[11px] leading-[14px] text-slate">{account?.fullName}</Text>
          </View>
          <IconButton
            icon="search"
            label="Search appointments"
            onPress={() => {
              setSearching(!searching);
              setQuery('');
            }}
          />
          <IconButton icon="bell" label="Notifications" onPress={() => router.push('/health/notifications')} />
        </View>
      }
      contentClassName="gap-4 pt-3 pb-6">
      <View>
        <Text accessibilityRole="header" className="font-pj-bd text-[22px] leading-7 tracking-[-0.6px] text-ink">
          My Appointments
        </Text>
        <Text className="text-[13px] leading-[18px] text-slate">Your visits at connected clinics</Text>
      </View>

      <View accessibilityRole="tablist" className="flex-row rounded-xl border border-line/30 bg-sky-200/60 p-1">
        {tabs.map((item) => {
          const active = item.value === tab;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(item.value)}
              className={cn('flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-1.5', active && 'bg-black')}>
              <Text
                className={cn('text-[13px] leading-4 tracking-[0.3px]', active ? 'font-pj-bd text-white' : 'font-pj-md text-slate')}>
                {item.label}
              </Text>
              <View className={cn('min-w-[18px] items-center rounded-full px-1.5', active ? 'bg-white' : 'bg-sky-250')}>
                <Text className={cn('font-pj-bd text-[10px] leading-4', active ? 'text-black' : 'text-slate')}>
                  {groups[item.value].length}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {searching ? (
        <SearchField value={query} onChangeText={setQuery} placeholder="Search by clinic, service or reference" />
      ) : null}

      {!source.data ? (
        source.error ? (
          <ErrorState message={source.error.message} onAction={source.reload} />
        ) : (
          <LoadingState label="Loading your appointments…" />
        )
      ) : list.length === 0 ? (
        <EmptyState
          title={needle ? 'No matching appointments' : `No ${tab} appointments`}
          message={needle ? 'Try another clinic name or booking reference.' : 'Visits will appear here once you have them.'}
          actionLabel={tab === 'upcoming' && !needle ? 'Book an appointment' : undefined}
          onAction={() => router.push('/clinics')}
        />
      ) : (
        list.map((item) =>
          item === next ? (
            <NextVisitCard key={item.id} appointment={item} onMore={() => setShowActions(true)} />
          ) : (
            <AppointmentCard key={item.id} appointment={item} />
          ),
        )
      )}

      {tab !== 'upcoming' && older > 0 ? (
        <Text className="text-center text-[12px] leading-[18px] text-slate">
          Showing your 50 most recent visits. Ask the clinic for older ones.
        </Text>
      ) : null}

      <View className="flex-row items-center gap-3 rounded-2xl border border-[#a8cec6]/50 bg-sky-300/40 p-4">
        <View className="flex-1">
          <Text className="font-pj-bd text-[15px] leading-5 text-ink">Need another specialist?</Text>
          <Text className="text-[12px] leading-[17px] text-slate">Find a clinic and choose a service.</Text>
        </View>
        <Button label="Book New" iconLeft="plus-white" size="md" className="min-h-[40px]" onPress={() => router.push('/clinics')} />
      </View>

      <Sheet visible={showActions} onClose={() => setShowActions(false)} title="Appointment actions">
        <View className="gap-2.5">
          {next?.canReschedule ? <Button label="Reschedule" onPress={() => act('reschedule')} /> : null}
          {next?.canCancel ? <Button label="Cancel appointment" variant="danger" onPress={() => act('cancel')} /> : null}
        </View>
      </Sheet>
    </Screen>
  );
}
