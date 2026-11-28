import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { FilterChips } from '@/components/ui/FilterChips';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { recordCard, recordKicker, recordMeta, recordTitle } from '@/features/health/RecordKit';
import { useList } from '@/hooks/useResource';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { addDays, dateTime, toIsoDay } from '@/lib/dates';
import { useSession } from '@/state/SessionState';
import type { IconName } from '@/theme/icons';
import type { Notice } from '@/types';

type Filter = 'all' | 'unread';

// Where a notice opens, and what its link says.
const TARGETS: Record<string, { href: (id: string) => Href; label: string; icon: IconName }> = {
  appointment: { href: (id) => `/appointments/${id}`, label: 'View Appointment', icon: 'calendar-outline' },
  encounter: { href: (id) => `/health/consultations/${id}`, label: 'View Consultation', icon: 'module-consultations' },
  prescription: { href: (id) => `/health/prescriptions/${id}`, label: 'View Prescription', icon: 'module-prescriptions' },
  order: { href: (id) => `/health/orders/${id}`, label: 'View Result', icon: 'module-lab' },
  care_plan: { href: (id) => `/health/care-plans/${id}`, label: 'View Care Plan', icon: 'module-careplans' },
  support_ticket: { href: (id) => `/profile/help/ticket/${id}`, label: 'View Request', icon: 'help-circle' },
};
const targetOf = (item: Notice) => (item.entityType && item.entityId ? TARGETS[item.entityType] : undefined);

/** Newest first, split by the phone's calendar day. */
function grouped(items: Notice[]) {
  const today = toIsoDay(new Date());
  const yesterday = addDays(today, -1);
  const day = (item: Notice) => toIsoDay(new Date(item.createdAt));
  return [
    { label: 'TODAY', rows: items.filter((item) => day(item) === today) },
    { label: 'YESTERDAY', rows: items.filter((item) => day(item) === yesterday) },
    { label: 'EARLIER', rows: items.filter((item) => day(item) < yesterday) },
  ].filter((group) => group.rows.length);
}

export default function Notifications() {
  const toast = useToast();
  const { call } = useSession();
  const [filter, setFilter] = useState<Filter>('all');
  const notices = useList<Notice>('/v1/patient/notifications?pageSize=50', ['notifications', 'records', 'requests', 'app_access']);
  const items = notices.data?.data ?? [];
  const unread = notices.data?.meta.unread ?? 0;
  const visible = filter === 'unread' ? items.filter((item) => !item.readAt) : items;
  const filters: { value: Filter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: `Unread (${unread})` },
  ];

  const markRead = async (body: { ids: string[] } | { all: true }) => {
    try {
      await call('/v1/patient/notifications/read', { method: 'POST', body });
      notices.reload();
    } catch (error) {
      toast(errorMessage(error));
    }
  };

  const open = (item: Notice) => {
    if (!item.readAt) markRead({ ids: [item.id] });
    const target = targetOf(item);
    if (target) router.push(target.href(item.entityId!));
  };

  return (
    <Screen
      inTabs
      className="bg-[#f4f7f6]"
      header={
        <AppHeader
          title="Notifications"
          badge={unread > 0 ? <Pill label={`${unread} New`} tone="dark" /> : undefined}
          right={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
              hitSlop={8}
              disabled={unread === 0}
              onPress={() => markRead({ all: true })}
              className={cn('px-2 py-1', unread === 0 && 'opacity-40')}>
              <Text className="font-pj-sb text-[12px] leading-4 text-teal">Mark all read</Text>
            </Pressable>
          }
        />
      }
      contentClassName="gap-3 pt-3 pb-6">
      <FilterChips options={filters} value={filter} onChange={setFilter} />

      {!notices.data ? (
        notices.error ? (
          <ErrorState message={notices.error.message} onAction={notices.reload} />
        ) : (
          <LoadingState label="Loading notifications…" />
        )
      ) : visible.length === 0 ? (
        <EmptyState
          title="You're all caught up"
          message={filter === 'unread' ? 'There are no unread notifications.' : 'Updates about your appointments and records appear here.'}
          actionLabel={filter !== 'all' ? 'Show all' : undefined}
          onAction={() => setFilter('all')}
        />
      ) : (
        grouped(visible).map((group) => (
          <View key={group.label} className="gap-2.5">
            <Text className={cn(recordKicker, 'pt-1')}>
              {group.label} · {group.rows.length} {group.rows.length === 1 ? 'UPDATE' : 'UPDATES'}
            </Text>
            {group.rows.map((item) => (
              <View key={item.id} className={cn(recordCard, !item.readAt && 'border-l-4 border-l-teal')}>
                <View className="flex-row gap-3">
                  <View className="size-9 items-center justify-center rounded-xl bg-teal-100">
                    <Icon name={targetOf(item)?.icon ?? 'calendar-outline'} color="#006a61" />
                  </View>
                  <View className="flex-1 gap-1">
                    <Text className="text-[11px] leading-4 text-[#566b74]">{dateTime(item.createdAt)}</Text>
                    <Text accessibilityLabel={item.readAt ? item.title : `Unread: ${item.title}`} className={recordTitle}>
                      {item.title}
                    </Text>
                    <Text className={recordMeta}>{item.body}</Text>
                  </View>
                </View>
                {targetOf(item) || !item.readAt ? (
                  <View className="border-t border-edge/60 pt-2.5">
                    <Pressable accessibilityRole="link" hitSlop={8} onPress={() => open(item)}>
                      <Text className="font-pj-bd text-[13px] leading-[18px] text-heading">
                        {targetOf(item) ? `${targetOf(item)!.label} →` : 'Mark as read'}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ))
      )}

      <View className="gap-1 rounded-[20px] border border-edge bg-white p-4">
        <Text className={recordTitle}>Delivery</Text>
        <Text className={recordMeta}>
          Updates appear here in the app. Push, SMS and WhatsApp alerts from the app are not set up yet.
        </Text>
      </View>
    </Screen>
  );
}
