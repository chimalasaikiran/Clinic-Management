import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { goBack } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Options } from '@/components/ui/Kit';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { Dock, DockButton, DocHeader, HeaderStatus, Pill, SealedDock, SoftCard, T, type } from '@/features/consultation/design';
import { PatientBanner } from '@/features/consultation/PatientBanner';
import { ORDER_CATALOG, ORDER_PRIORITIES, useActiveEncounter, type OrderCategory } from '@/features/doctor/clinical';
import { addDays, dayLabel, localToday } from '@/features/reception/desk';
import { cn } from '@/lib/cn';
import { useConsultation, type OrderDraft } from '@/state/ConsultationState';
import colors from '@/theme/colors';

const DUPLICATE_DAYS = 14;
const FLAG_TONE = { normal: 'bg-mint', abnormal: 'bg-[#fef3c7]', critical: 'bg-[#ffdad6]' } as const;

export default function InvestigationOrders() {
  const { orders, addOrder, removeOrder, clearOrders } = useConsultation();
  const { encounter, chart, orders: ordered, sealed } = useActiveEncounter();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | OrderCategory>('all');
  const [editing, setEditing] = useState<OrderDraft | null>(null);
  const [priority, setPriority] = useState(ORDER_PRIORITIES[0]!);

  if (!encounter.data) {
    return (
      <Screen className="bg-sky-50" header={<DocHeader title="Investigation Orders" />} contentClassName="px-4 pt-6">
        {encounter.loading ? <LoadingState label="Opening the consultation…" /> : <EmptyState title="No consultation open" message="Start or resume a consultation from Today's patient list." actionLabel="Open Today" onAction={() => router.replace('/today')} />}
      </Screen>
    );
  }

  const history = chart.data?.orders ?? [];
  const since = addDays(localToday(), -DUPLICATE_DAYS);
  // Tests already ordered for this patient recently, by code, so a repeat is a deliberate choice.
  const recentByCode = new Map<string, (typeof history)[number]>();
  for (const order of history) {
    if (order.status === 'cancelled' || order.created.date < since) continue;
    for (const item of order.items) if (!recentByCode.has(item.code)) recentByCode.set(item.code, order);
  }
  const staged = (code: string) => orders.some((order) => order.code === code);
  const needle = query.trim().toLowerCase();
  const catalog = ORDER_CATALOG.filter((item) => item.name.toLowerCase().includes(needle) && (filter === 'all' || item.category === filter));
  const counts = (category: OrderCategory) => ORDER_CATALOG.filter((item) => item.category === category).length;
  const filters: { value: 'all' | OrderCategory; label: string }[] = [
    { value: 'all', label: `All Tests (${ORDER_CATALOG.length})` },
    { value: 'Laboratory', label: `Laboratory (${counts('Laboratory')})` },
    { value: 'Imaging', label: `Imaging (${counts('Imaging')})` },
    { value: 'Special Diagnostics', label: `Special Diagnostics (${counts('Special Diagnostics')})` },
  ];
  const resulted = history.filter((order) => order.result).slice(0, 5);
  const duplicates = orders.filter((order) => recentByCode.has(order.code));

  const add = (item: (typeof ORDER_CATALOG)[number]) => addOrder({ code: item.code, name: item.name, category: item.category, loinc: item.loinc, destination: item.destination, priority: ORDER_PRIORITIES[0]! });

  return (
    <Screen
      className="bg-sky-50"
      header={
        <DocHeader
          title="Investigation Orders"
          badge={<Pill label={ordered.length ? `${ordered.length} ORDERED` : 'IN PROGRESS'} className="max-w-[110px] self-center bg-mint" textClassName="text-deep" />}
          below={<HeaderStatus text={orders.length ? `${orders.length} picked, not yet ordered` : 'Pick tests, then review and send'} />}
        />
      }
      bareFooter
      footer={
        sealed ? (
          <SealedDock />
        ) : (
          <Dock>
            <View className="flex-row items-center justify-between gap-2 px-1">
              <View className="flex-row items-center gap-1.5">
                <View className="size-2 rounded-full bg-[#a8cec6]" />
                <T v="body" className="text-ink">{`${orders.length} Selected`}</T>
              </View>
              <T v="kicker" className="tracking-[-0.3px]">{duplicates.length ? `${duplicates.length} REPEAT${duplicates.length > 1 ? 'S' : ''}` : 'READY'}</T>
            </View>
            <View className="flex-row gap-2">
              <DockButton label={orders.length ? 'Back' : 'Skip'} tone="soft" onPress={() => (orders.length ? goBack() : router.push('/consultation/referral'))} />
              <DockButton label="Review Orders" iconRight="arrow-white-md" disabled={orders.length === 0} onPress={() => router.push('/consultation/orders-review')} className="flex-1" />
            </View>
          </Dock>
        )
      }
      contentClassName="gap-0 p-0">
      <View className="gap-3.5 px-5 pb-5 pt-1">
        <PatientBanner framed />
        {!sealed ? (
          <>
            <View className="min-h-[52px] flex-row items-center gap-3 rounded-xl bg-white px-1.5 shadow-sm">
              <Icon name="inv-search" />
              <TextInput
                accessibilityLabel="Search tests"
                value={query}
                onChangeText={setQuery}
                placeholder="Search tests (e.g. Lipid, Creatinine, ECG)"
                placeholderTextColor={colors.slate}
                autoCorrect={false}
                className="flex-1 py-3 font-pj text-[14px] text-ink"
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mr-5 grow-0" contentContainerClassName="gap-2 pr-5">
              {filters.map((option) => {
                const active = filter === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => setFilter(option.value)}
                    className={cn('h-8 justify-center rounded-full px-3 shadow-sm', active ? 'bg-black' : 'bg-white')}>
                    <Text className={cn(type.strong, active ? 'text-white' : 'text-slate')}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View className="gap-2 pt-1.5">
              <View className="flex-row items-center justify-between gap-2">
                <View className="flex-1 flex-row items-center gap-1.5">
                  <Icon name="inv-compass" />
                  <T v="subheading" className="shrink">Clinic Test Catalogue</T>
                </View>
                <T v="kicker">FAST ADD</T>
              </View>
              {catalog.length === 0 ? (
                <SoftCard>
                  <T v="body" className="text-center">No tests in the catalogue match this search.</T>
                </SoftCard>
              ) : null}
              {catalog.map((item) => {
                const added = staged(item.code);
                const recent = recentByCode.get(item.code);
                return (
                  <SoftCard key={item.code} className="flex-row gap-2">
                    <View className="flex-1 gap-1">
                      <View className="self-start rounded bg-sky-200 px-1.5 py-0.5">
                        <T v="kicker" className="text-[#526871]">{item.category.toUpperCase()}</T>
                      </View>
                      <T v="item">{item.name}</T>
                      <T v="body">
                        {item.destination}
                        {item.loinc ? ` • LOINC ${item.loinc}` : ''}
                      </T>
                      {recent ? <T v="body" className="text-[#93000a]">{`Ordered ${dayLabel(recent.created.date)} (${recent.reference})`}</T> : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={added ? `${item.name} added` : `Add ${item.name}`}
                      accessibilityState={{ disabled: added }}
                      disabled={added}
                      onPress={() => add(item)}
                      className="h-10 flex-row items-center gap-1 self-start rounded-lg bg-sky-100 px-3.5">
                      {added ? null : <Icon name="inv-plus" />}
                      <T v="strong">{added ? 'Added' : 'Add'}</T>
                    </Pressable>
                  </SoftCard>
                );
              })}
            </View>
          </>
        ) : null}

        {duplicates.length ? (
          <View className="mt-3.5 flex-row gap-2 rounded-xl bg-[#ffdad6] p-4 shadow-sm">
            <Icon name="inv-warning" />
            <View className="flex-1 gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <T v="subheading" className="flex-1 font-pj-bd text-[#93000a]">Repeat Order Precaution</T>
                <View className="rounded bg-white px-1.5 py-0.5">
                  <T v="kicker" className="text-danger">{`${DUPLICATE_DAYS}D WINDOW`}</T>
                </View>
              </View>
              {duplicates.map((order) => {
                const earlier = recentByCode.get(order.code)!;
                return (
                  <T key={order.code} v="body" className="text-[#93000a]">
                    {`${order.name} was ordered on ${dayLabel(earlier.created.date)} (${earlier.reference}, ${earlier.result ? `result: ${earlier.result.summary}` : earlier.status.replace('_', ' ')}). Remove it unless a repeat is needed.`}
                  </T>
                );
              })}
            </View>
          </View>
        ) : null}

        <View className="gap-2 pt-3.5">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-2">
              <T v="subheading">Picked for This Order</T>
              <View accessibilityLabel={`Picked for this order (${orders.length})`} className="size-5 items-center justify-center rounded-full bg-black">
                <T v="kicker" className="text-white">{orders.length}</T>
              </View>
            </View>
            {orders.length > 0 && !sealed ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={clearOrders}>
                <T v="kicker">Clear All</T>
              </Pressable>
            ) : null}
          </View>
          {orders.length === 0 ? (
            <SoftCard>
              <T v="body" className="text-center">Nothing picked yet. Use Fast Add above.</T>
            </SoftCard>
          ) : null}
          {orders.map((order) => (
            <SoftCard key={order.code} className="gap-2">
              <View className="gap-1">
                <View className="flex-row items-center gap-2">
                  <View className="size-2 rounded-full bg-[#a8cec6]" />
                  <T v="kicker">{order.category.toUpperCase()}</T>
                </View>
                <T v="item">{order.name}</T>
                <View className="flex-row flex-wrap gap-1.5 pb-1.5 pt-1">
                  {[order.destination, order.priority].map((detail) => (
                    <View key={detail} className="rounded bg-sky-150 px-2 py-0.5">
                      <T v="body" className="text-[#526871]">{detail}</T>
                    </View>
                  ))}
                </View>
              </View>
              {!sealed ? (
                <View className="flex-row items-center justify-end gap-2 border-t border-sky-150 pt-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Change priority for ${order.name}`}
                    hitSlop={6}
                    onPress={() => {
                      setEditing(order);
                      setPriority(order.priority);
                    }}
                    className="flex-row items-center gap-1 rounded bg-sky-100 px-2.5 py-1">
                    <Icon name="inv-edit" />
                    <T v="strong" className="text-slate">Priority</T>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${order.name}`} hitSlop={6} onPress={() => removeOrder(order.code)} className="flex-row items-center gap-1 px-2.5 py-1">
                    <Icon name="inv-trash" />
                    <T v="strong" className="text-danger">Remove</T>
                  </Pressable>
                </View>
              ) : null}
            </SoftCard>
          ))}
        </View>

        {ordered.length ? (
          <View className="gap-2 pt-3.5">
            <T v="subheading">Ordered This Visit</T>
            {ordered.map((order) => (
              <SoftCard key={order.id}>
                <T v="item">{order.title}</T>
                <T v="body">{`${order.reference} • ${order.status.replace('_', ' ')}`}</T>
              </SoftCard>
            ))}
          </View>
        ) : null}

        <View className="gap-2 pt-3.5">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-row items-center gap-1.5">
              <Icon name="inv-history" />
              <T v="subheading">Recent Results</T>
            </View>
          </View>
          {resulted.length === 0 ? (
            <SoftCard>
              <T v="body" className="text-center">No results on file yet.</T>
            </SoftCard>
          ) : (
            <SoftCard className="p-0">
              {resulted.map((order, index) => (
                <Pressable
                  key={order.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${order.title}`}
                  onPress={() => router.push(`/results/${order.id}`)}
                  className={cn('flex-row items-center gap-2 p-4', index > 0 && 'border-t border-sky-200')}>
                  <View className="flex-1 gap-0.5">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <T v="item">{order.title}</T>
                      <View className={cn('rounded-full px-2', FLAG_TONE[order.result!.flag])}>
                        <T v="kicker" className="text-ink">{order.result!.flag.toUpperCase()}</T>
                      </View>
                    </View>
                    <T v="body">{`${order.result!.summary} • ${dayLabel(order.created.date)}`}</T>
                  </View>
                  <Icon name="inv-open" />
                </Pressable>
              ))}
            </SoftCard>
          )}
        </View>
      </View>
      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.name}>
        <Options options={ORDER_PRIORITIES.map((value) => ({ value, label: value }))} value={priority} onChange={setPriority} />
        <Button
          label="Save Priority"
          className="mt-3"
          onPress={() => {
            if (editing) addOrder({ ...editing, priority });
            setEditing(null);
          }}
        />
      </Sheet>
    </Screen>
  );
}
