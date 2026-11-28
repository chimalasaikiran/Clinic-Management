import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { FilterChips } from '@/components/ui/FilterChips';
import { Icon } from '@/components/ui/Icon';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { BookingHeader } from '@/features/booking/BookingHeader';
import { useResource } from '@/hooks/useResource';
import { cn } from '@/lib/cn';
import { rupees } from '@/lib/visit';
import { useBooking } from '@/state/BookingState';
import type { ClinicDetail } from '@/types';

export default function ChooseService() {
  const { branchId, serviceId, setServiceId } = useBooking();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const clinic = useResource<ClinicDetail>(branchId ? `/v1/patient/clinics/${branchId}` : null);

  const services = clinic.data?.services ?? [];
  const selected = services.find((service) => service.id === serviceId);
  const categories = [
    { value: 'all', label: 'All Services' },
    ...[...new Set(services.map((service) => service.category))].map((value) => ({ value, label: value })),
  ];
  const needle = query.trim().toLowerCase();
  const results = services.filter(
    (service) =>
      (category === 'all' || service.category === category) &&
      `${service.name} ${service.description} ${service.department}`.toLowerCase().includes(needle),
  );

  if (!branchId || !clinic.data) {
    return (
      <Screen header={<BookingHeader step={1} />}>
        {!branchId ? (
          <EmptyState
            title="Choose a clinic first"
            message="Pick the clinic you want to visit, then the service."
            actionLabel="Find a clinic"
            onAction={() => router.dismissTo('/clinics')}
          />
        ) : clinic.error ? (
          <ErrorState message={clinic.error.message} onAction={clinic.reload} />
        ) : (
          <LoadingState label="Loading services…" />
        )}
      </Screen>
    );
  }

  return (
    <Screen
      header={<BookingHeader step={1} />}
      footer={
        <View className="gap-2.5">
          <View className="flex-row justify-between gap-3 px-1">
            <View className="flex-1">
              <Text className="text-[11px] leading-[17px] tracking-[0.55px] text-slate">SELECTED SERVICE</Text>
              <Text numberOfLines={1} className="font-pj-md text-[16px] leading-6 text-heading">
                {selected?.name ?? 'None'}
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-[11px] leading-[17px] tracking-[0.55px] text-slate">CONSULT FEE</Text>
              <Text className="font-pj-sb text-[18px] leading-6 text-teal">{selected ? rupees(selected.fee) : '—'}</Text>
            </View>
          </View>
          <Button
            label="Continue to Schedule"
            iconRight="arrow-forward-white"
            disabled={!selected}
            onPress={() => router.push('/booking/schedule')}
          />
        </View>
      }
      contentClassName="gap-5 pt-1 pb-6">
      <View className="flex-row items-center gap-3 rounded-2xl border border-edge bg-sky-50 p-3">
        <View className="size-11 items-center justify-center rounded-xl bg-teal-100">
          <Icon name="hospital-teal" />
        </View>
        <View className="flex-1">
          <Text numberOfLines={1} className="font-pj-md text-[14px] leading-5 text-heading">
            {clinic.data.clinicName}
          </Text>
          <Text numberOfLines={1} className="text-[13px] leading-[18px] text-slate">
            {clinic.data.name} · {clinic.data.city}
          </Text>
        </View>
        <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.dismissTo('/clinics')}>
          <Text className="font-pj-sb text-[13px] leading-4 text-teal">Change</Text>
        </Pressable>
      </View>

      <View className="gap-1">
        <Text accessibilityRole="header" className="font-pj-bd text-[26px] leading-[34px] tracking-[-0.65px] text-heading">
          Choose a Service
        </Text>
        <Text className="text-[14px] leading-5 text-slate">
          Select the care you need. You are given a free specialist for the time you choose.
        </Text>
      </View>

      <SearchField value={query} onChangeText={setQuery} placeholder="Search services or departments" />
      {categories.length > 2 ? <FilterChips options={categories} value={category} onChange={setCategory} /> : null}

      <View accessibilityRole="radiogroup" className="gap-3">
        {results.length === 0 ? (
          <EmptyState
            title={services.length ? 'No matching services' : 'No services open for booking'}
            message={services.length ? 'Try another service or department name.' : 'Call the clinic to book a visit.'}
            actionLabel={services.length ? 'Clear search' : undefined}
            onAction={() => {
              setQuery('');
              setCategory('all');
            }}
          />
        ) : null}
        {results.map((service) => {
          const active = service.id === serviceId;
          const tag = cn('rounded-md px-2.5 py-1', active ? 'border border-teal-200 bg-white/90' : 'bg-sky-200/40');
          const tagText = cn('font-pj-bd text-[11px] leading-[14px] tracking-[0.55px]', active ? 'text-heading' : 'text-slate');
          return (
            <Pressable
              key={service.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${service.name}, ${rupees(service.fee)}`}
              onPress={() => setServiceId(service.id)}
              className={cn('gap-3 rounded-[20px] border-2 p-4', active ? 'border-teal bg-teal-100' : 'border-edge bg-white')}>
              <View className="flex-row gap-3">
                <View
                  className={cn(
                    'size-11 items-center justify-center rounded-xl border',
                    active ? 'border-teal-200 bg-white' : 'border-edge bg-sky-100',
                  )}>
                  <Icon name="svc-medicine" />
                </View>
                <View className="flex-1">
                  <Text className="font-pj-sb text-[18px] leading-6 tracking-[-0.18px] text-heading">{service.name}</Text>
                  {service.description ? (
                    <Text className="text-[13px] leading-[18px] text-slate">{service.description}</Text>
                  ) : null}
                </View>
                <View
                  className={cn('size-6 items-center justify-center rounded-full', active ? 'bg-teal' : 'border-2 border-line/60')}>
                  {active ? <Icon name="check-bold-white" /> : null}
                </View>
              </View>
              <View className="flex-row flex-wrap gap-1.5 border-t border-edge/50 pt-3">
                <View className={tag}>
                  <Text className={tagText}>{service.department}</Text>
                </View>
                <View className={tag}>
                  <Text className={tagText}>{service.slotMinutes} min</Text>
                </View>
                <View className={cn('rounded-md px-2.5 py-1', active ? 'bg-teal' : 'bg-sky-100')}>
                  <Text className={cn('font-pj-bd text-[11px] leading-[14px] tracking-[0.55px]', active ? 'text-white' : 'text-heading')}>
                    {rupees(service.fee)}
                    {service.gstRate > 0 ? ` + ${service.gstRate}% GST` : ''}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
