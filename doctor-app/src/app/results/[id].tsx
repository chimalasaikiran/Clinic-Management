import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Share, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Choice } from '@/components/ui/Kit';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { Dock, DocHeader, T } from '@/features/consultation/design';
import { REVIEW_OUTCOMES, useChart, usePatient, type Order } from '@/features/doctor/clinical';
import { ageSex, clock, dayLabel, localToday } from '@/features/reception/desk';
import { useResource } from '@/hooks/useResource';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession } from '@/state/SessionState';
import { useStaff } from '@/state/StaffState';

const outline = 'rounded-2xl border border-sky-150 bg-white p-4';
const FLAG = {
  normal: { label: 'NORMAL', box: 'bg-[#ecfdf5]', text: 'text-[#047857]' },
  abnormal: { label: 'ABNORMAL', box: 'bg-[#fffbeb]', text: 'text-[#b45309]' },
  critical: { label: 'CRITICAL', box: 'bg-[#ffdad6]', text: 'text-[#93000a]' },
} as const;
const STAGE: Record<string, string> = { ordered: 'ORDERED', collected: 'COLLECTED', resulted: 'RESULTED', reviewed: 'REVIEWED', cancelled: 'CANCELLED' };

function Small({ children, className }: { children: ReactNode; className?: string }) {
  return <Text className={cn('text-[11px] leading-4 text-slate', className)}>{children}</Text>;
}

export default function ResultReview() {
  const toast = useToast();
  const { call } = useSession();
  const { me } = useStaff();
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useResource<Order>(`/v1/orders/${id}`, ['records']);
  const patient = usePatient(order.data?.patientId);
  const chart = useChart(order.data?.patientId);
  const [outcome, setOutcome] = useState<(typeof REVIEW_OUTCOMES)[number]['id'] | null>(null);
  const [note, setNote] = useState('');
  const [attested, setAttested] = useState(false);
  const [signing, setSigning] = useState(false);

  if (!order.data) {
    return (
      <Screen className="bg-sky-50" header={<AppHeader title="Result" />} contentClassName="px-4 pt-6">
        {order.error ? (
          order.error.code === 'NOT_FOUND' ? (
            <EmptyState title="Result not found" message="It may be outside your patients." actionLabel="Open Inbox" onAction={() => router.navigate('/inbox')} />
          ) : (
            <ErrorState message={order.error.message} onAction={order.reload} />
          )
        ) : (
          <LoadingState label="Loading the result…" />
        )}
      </Screen>
    );
  }

  const item = order.data;
  const flag = item.result ? FLAG[item.result.flag] : null;
  const toReview = item.status === 'awaiting_review';
  const codes = new Set(item.items.map((entry) => entry.code));
  // Earlier results of the same tests, newest first, as the trend.
  const earlier = (chart.data?.orders ?? []).filter((other) => other.id !== item.id && other.result && other.items.some((entry) => codes.has(entry.code)));
  const ready = !!outcome && note.trim().length >= 10 && attested;

  const sign = async () => {
    if (!ready) return;
    setSigning(true);
    try {
      await call(`/v1/orders/${item.id}/review`, { method: 'POST', body: { outcome, note: note.trim() } });
      order.reload();
      chart.reload();
      toast('Result reviewed. Its alerts are cleared and the patient can see it.');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setSigning(false);
    }
  };

  return (
    <Screen
      className="bg-sky-50"
      bareFooter={!toReview}
      header={
        <DocHeader
          title={item.title}
          below={<T v="body">{`${item.reference} • ${item.category}`}</T>}
          actions={
            <Pressable accessibilityRole="button" accessibilityLabel="Share result" onPress={() => Share.share({ message: `${item.title}: ${item.result?.summary ?? 'No result yet'}` }).catch(() => toast('This device cannot share.'))}>
              <Icon name="share" />
            </Pressable>
          }
        />
      }
      footer={
        toReview ? (
          <Dock>
            <Button label={signing ? 'Signing…' : 'Sign Off Result'} loading={signing} disabled={!ready} onPress={sign} />
            <T v="kicker" className="text-center">The patient sees the result once you sign it off.</T>
          </Dock>
        ) : undefined
      }
      contentClassName="gap-3 px-4 pt-3 pb-6">
      {patient.data ? (
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/patients/record', params: { patientId: patient.data!.id } })} className={outline}>
          <T v="heading">{patient.data.fullName}</T>
          <Small>{`${ageSex(patient.data, localToday())} • ${patient.data.mrn} • ordered by ${item.orderingName}`}</Small>
        </Pressable>
      ) : null}

      <View className={cn(outline, 'gap-2')}>
        <T v="kicker">PROGRESS</T>
        {[{ action: 'ordered', actor: item.orderingName, at: item.created, note: null }, ...[...item.events].reverse()].map((event, index) => (
          <View key={`${event.action}-${index}`} className="flex-row gap-2">
            <View className="mt-1.5 size-2 rounded-full bg-slate" />
            <View className="flex-1">
              <Text className="font-pj-bd text-[11px] leading-4 text-ink">{STAGE[event.action] ?? event.action.toUpperCase()}</Text>
              <Small>{`${dayLabel(event.at.date)} ${clock(event.at.time)} • ${event.actor}`}</Small>
            </View>
          </View>
        ))}
      </View>

      {item.result && flag ? (
        <View className={cn(outline, 'gap-2', item.result.flag === 'critical' && 'border-[#ba1a1a]/30')}>
          <View className="flex-row items-center justify-between gap-2">
            <T v="kicker">RESULT</T>
            <View className={cn('rounded-full px-2 py-0.5', flag.box)}>
              <Text className={cn('font-pj-bd text-[10px] leading-[15px]', flag.text)}>{flag.label}</Text>
            </View>
          </View>
          <Text className="text-[15px] leading-[22px] text-ink">{item.result.summary}</Text>
          {item.items.map((entry) => (
            <Small key={entry.id}>{`${entry.name}${entry.loinc ? ` • LOINC ${entry.loinc}` : ''} • ${entry.destination}`}</Small>
          ))}
        </View>
      ) : (
        <View className={outline}>
          <T v="body">No result has been recorded yet.</T>
        </View>
      )}

      <View className={cn(outline, 'gap-2')}>
        <T v="kicker">EARLIER RESULTS OF THESE TESTS</T>
        {earlier.length === 0 ? <T v="body">This is the first result on file.</T> : null}
        {earlier.map((other) => (
          <View key={other.id} className="gap-0.5 border-l-2 border-sky-250 pl-3">
            <Text className="font-pj-bd text-[12px] leading-[18px] text-ink">{`${dayLabel(other.created.date, true)} • ${FLAG[other.result!.flag].label}`}</Text>
            <Small>{other.result!.summary}</Small>
          </View>
        ))}
      </View>

      <View className={cn(outline, 'gap-1')}>
        <T v="kicker">INDICATION</T>
        <T v="body">{item.indication}</T>
      </View>

      {item.review ? (
        <View className={cn(outline, 'gap-1 bg-[#ecfdf5]')}>
          <T v="kicker">REVIEWED{item.review.by ? ` BY ${item.review.by.toUpperCase()}` : ''}</T>
          <T v="label">{REVIEW_OUTCOMES.find((entry) => entry.id === item.review!.outcome)?.title ?? item.review.outcome}</T>
          <T v="body">{item.review.note}</T>
        </View>
      ) : null}

      {toReview ? (
        <View className={cn(outline, 'gap-3')}>
          <T v="heading">Sign Off</T>
          {REVIEW_OUTCOMES.map((entry) => (
            <Choice key={entry.id} kind="radio" title={entry.title} body={entry.detail} checked={outcome === entry.id} onPress={() => setOutcome(entry.id)} />
          ))}
          <TextField label="Clinical note" value={note} onChangeText={setNote} multiline maxLength={2000} hint="At least 10 characters, for example what you will change." />
          <Choice title="Reviewed" body={`I, ${me.name}, have reviewed this result.`} checked={attested} onPress={() => setAttested(!attested)} />
        </View>
      ) : null}
    </Screen>
  );
}
