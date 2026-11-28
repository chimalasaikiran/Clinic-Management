import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TICKET_STATUS } from '@/features/profile/TicketParts';
import { useList } from '@/hooks/useResource';
import { dateTime } from '@/lib/dates';
import type { SupportTicket } from '@/types';

export default function HelpRequests() {
  const tickets = useList<SupportTicket>('/v1/patient/support-tickets?pageSize=50', ['requests', 'app_access']);
  const items = tickets.data?.data ?? [];

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={<AppHeader title="Your Help Requests" subtitle="Requests you sent to your clinics" />}
      footer={<Button label="Send a New Request" onPress={() => router.push('/profile/help/request')} />}
      contentClassName="gap-3 pt-4 pb-6">
      {!tickets.data ? (
        tickets.error ? <ErrorState message={tickets.error.message} onAction={tickets.reload} /> : <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState title="No requests yet" message="Requests you send to your clinics appear here, with their replies." />
      ) : (
        items.map((ticket) => (
          <Pressable
            key={ticket.id}
            accessibilityRole="button"
            onPress={() => router.push(`/profile/help/ticket/${ticket.id}`)}
            className="gap-2 rounded-2xl border border-line/40 bg-white p-4 active:opacity-80">
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Pill label={TICKET_STATUS[ticket.status].label} tone={TICKET_STATUS[ticket.status].tone} />
              <Text className="text-[11px] leading-4 text-slate">#{ticket.reference}</Text>
            </View>
            <Text className="font-pj-bd text-[15px] leading-5 text-ink">{ticket.subject}</Text>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 text-[12px] leading-[18px] text-slate">
                {ticket.clinicName} · {ticket.category} · {dateTime(ticket.updatedAt)}
              </Text>
              <Icon name="chevron-right-slate" />
            </View>
          </Pressable>
        ))
      )}
    </Screen>
  );
}
