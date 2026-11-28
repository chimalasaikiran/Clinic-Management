import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Chip, IconTile, RoundButton } from '@/components/staff/ui';
import { FilterChips } from '@/components/ui/FilterChips';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { ageSex } from '@/features/reception/desk';
import { openPreparation } from '@/features/nurse/PatientCard';
import { goBackToWard, SectionTitle } from '@/features/nurse/ui';
import { noticeWhen, useNotices, type Notice } from '@/features/common/notices';
import { useWard } from '@/features/nurse/ward';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession } from '@/state/SessionState';

type Filter = 'all' | 'unread' | 'clinical';

export default function NurseAlerts() {
  const toast = useToast();
  const { call } = useSession();
  const { day, present, alerts } = useWard();
  const notices = useNotices();
  const [filter, setFilter] = useState<Filter>('all');

  const unread = notices.items.filter((item) => !item.readAt);
  const shownNotices = filter === 'clinical' ? [] : filter === 'unread' ? unread : notices.items;
  const shownAlerts = filter === 'unread' ? [] : alerts.items;

  const markRead = async (body: { ids: string[] } | { all: true }) => {
    try {
      await call('/v1/notifications/read', { method: 'POST', body });
      notices.reload();
    } catch (error) {
      toast(errorMessage(error));
    }
  };
  const open = (notice: Notice) => {
    if (!notice.readAt) markRead({ ids: [notice.id] });
  };

  const loading = (!day.data && !day.error) || (!notices.data && !notices.error);

  return (
    <Screen
      inTabs
      className="bg-[#f8fafc]"
      header={
        <View className="min-h-[60px] flex-row items-center gap-2 border-b border-[#eef2f6] bg-sky-50 px-4">
          <RoundButton icon="arrow-back" label="Go back" onPress={goBackToWard} className="w-7" />
          <Text accessibilityRole="header" className="font-pj-bd text-[17px] leading-6 text-ink">
            Alerts
          </Text>
          {notices.unread ? (
            <View className="rounded-full bg-teal px-2 py-0.5">
              <Text className="font-pj-bd text-[10px] leading-[15px] text-white">{notices.unread} New</Text>
            </View>
          ) : null}
          <View className="flex-1" />
          {notices.unread ? <RoundButton icon="done-all" label="Mark all as read" onPress={() => markRead({ all: true })} /> : null}
        </View>
      }
      contentClassName="gap-3 px-4 pt-3 pb-6">
      <FilterChips
        options={[
          { value: 'all' as const, label: `All (${alerts.items.length + notices.items.length})` },
          { value: 'unread' as const, label: `Unread (${unread.length})` },
          { value: 'clinical' as const, label: `Chart Alerts (${alerts.items.length})` },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {notices.error && !notices.data ? <ErrorState message={notices.error.message} onAction={notices.reload} /> : null}
      {loading ? <LoadingState label="Loading alerts…" /> : null}
      {!loading && shownAlerts.length === 0 && shownNotices.length === 0 ? <EmptyState title="Nothing to show" message="Serious chart alerts for today's patients and your notifications appear here." /> : null}

      {shownAlerts.length ? (
        <>
          <SectionTitle title="Chart Alerts for Today's Patients" icon="warning-amber" tint="#ba1a1a" />
          {shownAlerts.map((alert) => {
            const row = present.find((entry) => entry.patient.id === alert.patient.id);
            return (
              <View key={alert.id} className={cn('flex-row gap-3 rounded-2xl border bg-white p-4', alert.severity === 'critical' ? 'border-[#fecaca]' : 'border-[#fde68a]')}>
                <IconTile icon="warning-amber" box={alert.severity === 'critical' ? 'bg-[#ffdad6]' : 'bg-[#fffbeb]'} color="#ba1a1a" />
                <View className="flex-1 gap-1">
                  <Text className="font-pj-bd text-[11px] leading-4 text-[#64748b]">
                    {alert.severity.toUpperCase()} · {alert.patient.fullName}
                    {day.data ? ` (${ageSex(alert.patient, day.data.today)})` : ''}
                  </Text>
                  <Text className="font-pj-bd text-[15px] leading-5 text-ink">{alert.title}</Text>
                  <Text className="text-[13px] leading-[19px] text-slate">{alert.detail}</Text>
                  {row ? (
                    <Pressable accessibilityRole="button" hitSlop={8} onPress={() => openPreparation(row)}>
                      <Text className="pt-1 font-pj-bd text-[13px] leading-[18px] text-teal">Open Preparation →</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
          <Text className="text-[11px] leading-4 text-slate">Doctors acknowledge or resolve chart alerts.</Text>
        </>
      ) : null}

      {shownNotices.length ? (
        <>
          <SectionTitle title="Notifications" icon="notifications-none" />
          {shownNotices.map((notice) => {
            const fresh = !notice.readAt;
            return (
              <Pressable
                key={notice.id}
                accessibilityRole="button"
                accessibilityLabel={`${notice.title}${fresh ? ', unread' : ''}`}
                onPress={() => open(notice)}
                className={cn('gap-1.5 rounded-2xl border bg-white p-4', fresh ? 'border-teal-200' : 'border-[#eef2f6]')}>
                <View className="flex-row justify-between gap-2">
                  <Text className="flex-1 font-pj-bd text-[14px] leading-5 text-ink">{notice.title}</Text>
                  {fresh ? <Chip label="New" tone="mint" /> : null}
                </View>
                <Text className="text-[13px] leading-[19px] text-slate">{notice.body}</Text>
                <Text className="text-[11px] leading-4 text-[#64748b]">{noticeWhen(notice.createdAt)}</Text>
              </Pressable>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}
