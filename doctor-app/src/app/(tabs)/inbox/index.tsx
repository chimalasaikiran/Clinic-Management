import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Icon } from '@/components/ui/Icon';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { SoftCard, T } from '@/features/consultation/design';
import { useClinicalDay, type ClinicalAlert } from '@/features/doctor/clinical';
import { ageSex, dayLabel, initialsOf, localToday } from '@/features/reception/desk';
import { useResource } from '@/hooks/useResource';
import { cn } from '@/lib/cn';
import type { IconName } from '@/theme/icons';

type Filter = 'all' | 'alerts' | 'results' | 'unsigned' | 'plans';
type Worklist = { alerts: (ClinicalAlert & { patient: { id: string; fullName: string; mrn: string } })[]; ordersAwaitingReview: number; followUpsDue: number };
type Item = { id: string; kind: Exclude<Filter, 'all'>; urgent: boolean; name: string; context: string; title: string; detail: string; action: string; href: Href };

const KIND: Record<Item['kind'], { label: string; icon: IconName }> = {
  alerts: { label: 'ALERT', icon: 'in-urgent' },
  results: { label: 'RESULT', icon: 'in-routine' },
  unsigned: { label: 'TO SIGN', icon: 'in-channels' },
  plans: { label: 'CARE PLAN', icon: 'in-routine' },
};

export default function ClinicalInbox() {
  const today = localToday();
  const day = useClinicalDay();
  const worklist = useResource<Worklist>(`/v1/clinical/worklist?date=${today}`, ['records', 'appointments']);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const clinical = day.data?.clinical;
  const items: Item[] = [
    ...(worklist.data?.alerts ?? []).map((alert) => ({
      id: alert.id,
      kind: 'alerts' as const,
      urgent: alert.severity === 'critical',
      name: alert.patient.fullName,
      context: `${alert.patient.mrn} • ${alert.severity.toUpperCase()} • ${dayLabel(alert.created.date)}`,
      title: alert.title,
      detail: alert.detail,
      action: 'Review',
      href: `/inbox-task/${alert.id}` as Href,
    })),
    ...(clinical?.results.items ?? []).map((order) => ({
      id: order.id,
      kind: 'results' as const,
      urgent: order.resultFlag === 'critical',
      name: order.patient.fullName,
      context: `${order.patient.mrn} • ${ageSex(order.patient, today)}${order.urgent ? ' • URGENT' : ''}`,
      title: order.title,
      detail: order.resultSummary ?? '',
      action: 'Sign Off',
      href: `/results/${order.id}` as Href,
    })),
    ...(clinical?.unsigned.items ?? []).map((encounter) => ({
      id: encounter.id,
      kind: 'unsigned' as const,
      urgent: false,
      name: encounter.patient.fullName,
      context: `${encounter.patient.mrn} • ${encounter.reference}`,
      title: 'Encounter not signed',
      detail: 'Finish the notes and sign to complete the visit.',
      action: 'Open',
      href: { pathname: '/patients/workspace', params: { encounterId: encounter.id } } as Href,
    })),
    ...(clinical?.carePlans.items ?? []).map((plan) => ({
      id: plan.id,
      kind: 'plans' as const,
      urgent: false,
      name: plan.patient.fullName,
      context: `${plan.patient.mrn} • review due ${dayLabel(plan.nextReview)}`,
      title: plan.title,
      detail: 'Care plan review is due.',
      action: 'Chart',
      href: { pathname: '/patients/record', params: { patientId: plan.patient.id } } as Href,
    })),
  ];
  const needle = query.trim().toLowerCase();
  const visible = items.filter((item) => (filter === 'all' || item.kind === filter) && `${item.name} ${item.title} ${item.context}`.toLowerCase().includes(needle));
  const urgent = visible.filter((item) => item.urgent);
  const routine = visible.filter((item) => !item.urgent);
  const count = (kind: Item['kind']) => items.filter((item) => item.kind === kind).length;
  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: `All (${items.length})` },
    { value: 'alerts', label: `Alerts (${count('alerts')})` },
    { value: 'results', label: `Results (${count('results')})` },
    { value: 'unsigned', label: `To Sign (${count('unsigned')})` },
    { value: 'plans', label: `Care Plans (${count('plans')})` },
  ];
  const loading = (!day.data && !day.error) || (!worklist.data && !worklist.error);
  const error = day.error ?? worklist.error;

  const card = (item: Item) => (
    <SoftCard key={`${item.kind}-${item.id}`} className={cn('gap-2', item.urgent && 'border border-[#ba1a1a]/30')}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 flex-row gap-2.5">
          <View className={cn('size-9 items-center justify-center rounded-full', item.urgent ? 'bg-[#ffdad6]' : 'bg-sky-200')}>
            <Text className={cn('font-pj-bd text-[12px] leading-4', item.urgent ? 'text-[#93000a]' : 'text-ink')}>{initialsOf(item.name)}</Text>
          </View>
          <View className="flex-1">
            <Text className="font-pj-bd text-[16px] leading-[22px] text-ink">{item.name}</Text>
            <T v="kicker">{item.context}</T>
          </View>
        </View>
        <View className={cn('flex-row items-center gap-1 rounded-full px-2 py-0.5', item.urgent ? 'bg-[#ffdad6]' : 'bg-sky-150')}>
          <Icon name={KIND[item.kind].icon} />
          <Text className={cn('font-pj-bd text-[10px] leading-[15px]', item.urgent ? 'text-[#93000a]' : 'text-slate')}>{KIND[item.kind].label}</Text>
        </View>
      </View>
      <T v="label">{item.title}</T>
      {item.detail ? <T v="body">{item.detail}</T> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.action}: ${item.title}`} onPress={() => router.push(item.href)} className={cn('items-center rounded-xl py-2.5', item.urgent ? 'bg-black' : 'bg-sky-150')}>
        <Text className={cn('font-pj-bd text-[12px] leading-4', item.urgent ? 'text-white' : 'text-ink')}>{item.action}</Text>
      </Pressable>
    </SoftCard>
  );

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <View className="gap-1 border-b border-sky-150/60 bg-sky-50 px-4 py-2.5">
          <Text accessibilityRole="header" className="font-pj-bd text-[19px] leading-6 text-ink">
            Clinical Inbox
          </Text>
          <Text className="text-[12px] leading-4 text-slate">{items.length ? `${items.length} items need you` : 'Nothing waiting'}</Text>
        </View>
      }
      contentClassName="gap-3 px-4 pt-3 pb-6">
      <SearchField value={query} onChangeText={setQuery} placeholder="Search patient, result or alert..." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {filters.map((item) => (
          <Pressable key={item.value} accessibilityRole="tab" accessibilityState={{ selected: filter === item.value }} onPress={() => setFilter(item.value)} className={cn('rounded-full px-3 py-1.5', filter === item.value ? 'bg-black' : 'bg-white')}>
            <Text className={cn('font-pj-bd text-[11px] leading-4', filter === item.value ? 'text-white' : 'text-slate')}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {error && items.length === 0 ? <ErrorState message={error.message} onAction={() => (day.reload(), worklist.reload())} /> : null}
      {loading ? <LoadingState label="Loading your inbox…" /> : null}
      {!loading && visible.length === 0 ? <EmptyState title="Inbox clear" message={needle ? 'Nothing matches this search.' : 'Alerts, results to review and unsigned encounters appear here.'} /> : null}
      {urgent.length ? (
        <View className="gap-2">
          <View className="flex-row items-center gap-1.5">
            <Icon name="in-urgent" />
            <T v="kicker">URGENT · CRITICAL</T>
          </View>
          {urgent.map(card)}
        </View>
      ) : null}
      {routine.length ? (
        <View className="gap-2">
          <View className="flex-row items-center gap-1.5">
            <Icon name="in-routine" />
            <T v="kicker">TO REVIEW</T>
          </View>
          {routine.map(card)}
        </View>
      ) : null}
    </Screen>
  );
}
