import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppHeader, IconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { TICKET_STATUS } from '@/features/profile/TicketParts';
import { useResource } from '@/hooks/useResource';
import { cn } from '@/lib/cn';
import { dateTime } from '@/lib/dates';
import type { SupportTicket } from '@/types';

const card = 'gap-3 rounded-2xl border border-line/40 bg-white p-4';
const kicker = 'font-pj-bd text-[11px] leading-4 text-slate';

export default function RequestSubmitted() {
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const ticket = useResource<SupportTicket>(id ? `/v1/patient/support-tickets/${encodeURIComponent(id)}` : null, ['requests']);
  const [expanded, setExpanded] = useState(false);
  const toHelp = () => router.dismissTo('/profile/help');
  const data = ticket.data;

  if (!data) {
    return (
      <Screen inTabs header={<AppHeader title="Request Confirmation" />}>
        {!id || ticket.error ? (
          <ErrorState title="Request not found" message={ticket.error?.message ?? 'Send a request to see its confirmation here.'} actionLabel="Help & Support" onAction={toHelp} />
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }

  const steps = [
    { title: 'The clinic reads your request', body: `${data.clinicName} sees it in its help inbox now.` },
    { title: 'They reply in the app', body: 'You get a notification, and the reply appears under Your Help Requests.' },
    { title: 'Reply if you need to', body: 'You can answer them in the same request until it is resolved.' },
  ];

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={<AppHeader title="Request Confirmation" subtitle={`${data.clinicName} · ${data.branchName}`} back={false} right={<IconButton icon="cancel-circle" label="Close" onPress={toHelp} />} />}
      contentClassName="gap-4 pt-4 pb-6">
      <View className="items-center gap-2">
        <View className="size-20 items-center justify-center rounded-full bg-teal-100">
          <View className="size-12 items-center justify-center rounded-full bg-teal">
            <Icon name="check-large-white" />
          </View>
        </View>
        <Text accessibilityRole="header" className="font-pj-bd text-[22px] leading-7 text-ink">
          Request Submitted
        </Text>
        <Text className="text-center text-[14px] leading-5 text-slate">Your request has been sent to {data.clinicName}.</Text>
        <Pill label={TICKET_STATUS[data.status].label} tone={TICKET_STATUS[data.status].tone} className="self-center" />
      </View>

      <View className={card}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className={kicker}>REFERENCE</Text>
            <Text className="font-pj-bd text-[18px] leading-6 text-ink">#{data.reference}</Text>
          </View>
          <Button
            label="Copy"
            iconLeft="copy"
            variant="soft"
            size="sm"
            onPress={async () => {
              await Clipboard.setStringAsync(data.reference);
              toast('Reference copied.');
            }}
          />
        </View>
        <Text className="border-t border-line/30 pt-3 text-[13px] leading-[18px] text-ink">Sent {dateTime(data.createdAt)}</Text>
      </View>

      <View className={card}>
        <Text className="font-pj-bd text-[15px] leading-5 text-ink">Request Summary</Text>
        {[
          ['CATEGORY', data.category],
          ['CLINIC', `${data.clinicName} · ${data.branchName}`],
          ['FOR', data.patientName],
          ['SUBJECT', data.subject],
        ].map(([label, value]) => (
          <View key={label} className="rounded-xl bg-sky-100 p-3">
            <Text className={kicker}>{label}</Text>
            <Text className="font-pj-sb text-[13px] leading-[18px] text-ink">{value}</Text>
          </View>
        ))}
        {data.messages?.[0] ? (
          <View className="rounded-xl bg-sky-100 p-3">
            <Text className={kicker}>YOUR MESSAGE</Text>
            <Text numberOfLines={expanded ? undefined : 2} className="text-[13px] leading-[19px] text-ink">
              {data.messages[0].body}
            </Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setExpanded(!expanded)}>
              <Text className="pt-1 font-pj-bd text-[12px] leading-4 text-ink">{expanded ? 'Show less' : 'Read more'}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View className={card}>
        <Text className="font-pj-bd text-[15px] leading-5 text-ink">What Happens Next</Text>
        {steps.map((step, index) => (
          <View key={step.title} className="flex-row gap-3">
            <View className={cn('size-6 items-center justify-center rounded-full', index === 0 ? 'bg-teal' : 'bg-sky-150')}>
              <Text className={cn('font-pj-bd text-[11px] leading-4', index === 0 ? 'text-white' : 'text-ink')}>{index + 1}</Text>
            </View>
            <View className="flex-1">
              <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{step.title}</Text>
              <Text className="text-[12px] leading-[18px] text-slate">{step.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="gap-2.5">
        <Button label="View All Support Requests" onPress={() => router.replace('/profile/help/requests')} />
        <Button label="Return to Help & Support" variant="soft" className="bg-teal-100" onPress={toHelp} />
      </View>

      <View className="gap-1 rounded-2xl border border-[#ba1a1a]/20 bg-[#ffdad6]/40 p-3.5">
        <Text className="text-center font-pj-bd text-[12px] leading-4 text-[#93000a]">NOT FOR EMERGENCIES</Text>
        <Text className="text-center text-[12px] leading-[18px] text-body">
          If you have severe chest pain, trouble breathing or another emergency, do not wait for a reply. Dial 112 / 108 or go to the nearest emergency department.
        </Text>
      </View>
    </Screen>
  );
}
