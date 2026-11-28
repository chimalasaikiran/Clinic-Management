import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Glyph, RoundButton, type GlyphName } from '@/components/staff/ui';
import { FilterChips } from '@/components/ui/FilterChips';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { noticeWhen, useNotices, type Notice } from '@/features/common/notices';
import { PageHeader } from '@/features/common/PageHeader';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession, useSignedIn, type Workspace } from '@/state/SessionState';

const muted = 'text-[#566b74]';
const ICON: Record<string, GlyphName> = { appointment: 'event', refill_request: 'medication', support_ticket: 'help-outline', prescription: 'medication' };

/** The screen a notice is about, if this workspace has one. */
function screenFor(notice: Notice, workspace: Workspace | null): Href | null {
  if (notice.entityType !== 'appointment' || !notice.entityId) return null;
  if (workspace === 'reception') return `/reception/appointment/${notice.entityId}`;
  if (workspace === 'nurse') return { pathname: '/nurse/preparation', params: { id: notice.entityId } };
  return `/appointment/${notice.entityId}`;
}

export default function Notifications() {
  const toast = useToast();
  const { call } = useSession();
  const workspace = useSignedIn()?.workspace ?? null;
  const notices = useNotices(50);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [shownNotice, setShownNotice] = useState<Notice | null>(null);

  const unreadItems = notices.items.filter((item) => !item.readAt);
  const shown = filter === 'unread' ? unreadItems : notices.items;

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
    const href = screenFor(notice, workspace);
    if (href) router.push(href);
    else setShownNotice(notice);
  };

  return (
    <Screen
      className="bg-[#f7f9fb]"
      header={
        <PageHeader
          title="Notifications"
          badge={
            notices.unread ? (
              <View className="rounded-full bg-teal px-2">
                <Text className="font-pj-bd text-[11px] leading-[18px] text-white">{notices.unread} New</Text>
              </View>
            ) : null
          }
          right={notices.unread ? <RoundButton icon="done-all" label="Mark all as read" onPress={() => markRead({ all: true })} /> : undefined}
        />
      }
      contentClassName="gap-3 px-5 pt-3 pb-8">
      <FilterChips
        options={[
          { value: 'all' as const, label: `All (${notices.items.length})` },
          { value: 'unread' as const, label: `Unread (${unreadItems.length})` },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {notices.error && !notices.data ? <ErrorState message={notices.error.message} onAction={notices.reload} /> : null}
      {!notices.data && !notices.error ? <LoadingState label="Loading notifications…" /> : null}
      {notices.data && shown.length === 0 ? <EmptyState title="You’re all caught up" message={filter === 'unread' ? 'Nothing is unread.' : 'Notifications about your work appear here.'} /> : null}
      {shown.map((notice) => {
        const fresh = !notice.readAt;
        return (
          <Pressable
            key={notice.id}
            accessibilityRole="button"
            accessibilityLabel={`${notice.title}${fresh ? ', unread' : ''}`}
            onPress={() => open(notice)}
            className={cn('flex-row gap-3 rounded-2xl border border-[#dce5e8] p-4', fresh ? 'bg-white' : 'bg-[#fbfdfd]')}>
            <View className={cn('size-10 items-center justify-center rounded-xl', fresh ? 'bg-[#eaf5f3]' : 'bg-[#f0f4f6]')}>
              <Glyph name={ICON[notice.entityType ?? ''] ?? 'notifications-none'} size={20} color={fresh ? '#006a61' : '#566b74'} />
            </View>
            <View className="flex-1 gap-1">
              <Text className="font-pj-bd text-[15px] leading-5 text-[#182d35]">{notice.title}</Text>
              <Text className={cn('text-[13px] leading-[19px]', muted)}>{notice.body}</Text>
              <Text className={cn('text-[11px] leading-4', muted)}>{noticeWhen(notice.createdAt)}</Text>
            </View>
          </Pressable>
        );
      })}
      <Text className={cn('text-center text-[12px] leading-[17px]', muted)}>Push, WhatsApp and SMS alerts to staff, and delivery settings, are not available yet.</Text>
      <Sheet visible={!!shownNotice} onClose={() => setShownNotice(null)} title={shownNotice?.title}>
        <Text className="pb-3 text-[14px] leading-5 text-ink">{shownNotice?.body}</Text>
        {shownNotice?.entityType === 'refill_request' || shownNotice?.entityType === 'support_ticket' ? (
          <Text className="pb-3 text-[13px] leading-5 text-slate">Answer it in the ClinicOS admin panel.</Text>
        ) : null}
      </Sheet>
    </Screen>
  );
}
