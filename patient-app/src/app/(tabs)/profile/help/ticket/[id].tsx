import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { TICKET_STATUS } from '@/features/profile/TicketParts';
import { useResource } from '@/hooks/useResource';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { dateTime } from '@/lib/dates';
import { useSession } from '@/state/SessionState';
import type { SupportTicket } from '@/types';

export default function HelpRequestThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { call } = useSession();
  const ticket = useResource<SupportTicket>(`/v1/patient/support-tickets/${encodeURIComponent(id)}`, ['requests', 'app_access']);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState('');
  const data = ticket.data;

  if (!data) {
    const missing = ticket.error?.code === 'NOT_FOUND' || ticket.error?.code === 'VALIDATION_FAILED';
    return (
      <Screen inTabs header={<AppHeader title="Help Request" />}>
        {ticket.error ? (
          <ErrorState
            title={missing ? 'Request not found' : 'Could not load this request'}
            message={missing ? 'This request is not available on your account.' : ticket.error.message}
            actionLabel={missing ? 'Your requests' : 'Try again'}
            onAction={missing ? () => router.replace('/profile/help/requests') : ticket.reload}
          />
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }

  const send = async () => {
    setSending(true);
    setFailure('');
    try {
      await call(`/v1/patient/support-tickets/${data.id}/messages`, { method: 'POST', body: { body: reply.trim() } });
      setReply('');
      ticket.reload();
    } catch (error) {
      setFailure(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={<AppHeader title={`#${data.reference}`} subtitle={`${data.clinicName} · ${data.category}`} />}
      footer={
        data.status === 'resolved' ? (
          <View className="gap-2">
            <Text className="text-center text-[12px] leading-[18px] text-slate">This request is resolved. Send a new one if you still need help.</Text>
            <Button label="Send a New Request" variant="soft" onPress={() => router.push('/profile/help/request')} />
          </View>
        ) : (
          <View className="gap-2">
            <TextField label="Reply" placeholder="Write a reply to the clinic" value={reply} onChangeText={setReply} maxLength={2000} multiline inputClassName="min-h-[56px] text-[14px]" />
            {failure ? (
              <Text accessibilityRole="alert" className="text-[12px] leading-4 text-[#ba1a1a]">
                {failure}
              </Text>
            ) : null}
            <Button label="Send Reply" loading={sending} disabled={!reply.trim()} onPress={send} />
          </View>
        )
      }
      contentClassName="gap-3 pt-4 pb-6">
      <View className="gap-1 rounded-2xl border border-line/40 bg-white p-4">
        <Pill label={TICKET_STATUS[data.status].label} tone={TICKET_STATUS[data.status].tone} />
        <Text className="font-pj-bd text-[16px] leading-6 text-ink">{data.subject}</Text>
        <Text className="text-[12px] leading-[18px] text-slate">For {data.patientName} · sent {dateTime(data.createdAt)}</Text>
      </View>
      {(data.messages ?? []).map((message) => (
        <View
          key={message.id}
          className={cn('max-w-[88%] gap-1 rounded-2xl border p-3', message.by === 'you' ? 'self-end border-teal-200 bg-teal-100' : 'self-start border-line/40 bg-white')}>
          <Text className="font-pj-bd text-[11px] leading-4 text-slate">
            {message.by === 'you' ? 'You' : data.clinicName} · {dateTime(message.at)}
          </Text>
          <Text className="text-[14px] leading-[21px] text-ink">{message.body}</Text>
        </View>
      ))}
    </Screen>
  );
}
