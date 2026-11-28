import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { dateTime } from '@/lib/dates';
import { cn } from '@/lib/cn';
import { FLAG, STEP_LABEL } from '@/lib/records';
import type { DiagnosticOrder } from '@/types';

import { CardLink, recordCard, recordMeta, recordTitle } from './RecordKit';

const body = 'text-[13px] leading-[19px] text-[#566b74]';

/** The released result, or what is still to happen before it is released. */
export function ResultCard({ order }: { order: DiagnosticOrder }) {
  const result = order.result;
  if (!result) {
    return (
      <View className={recordCard}>
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className={recordTitle}>Result</Text>
          <Pill label={order.status === 'cancelled' ? 'Cancelled' : 'Not released yet'} tone={order.status === 'cancelled' ? 'red' : 'amber'} />
        </View>
        <Text className={body}>
          {order.status === 'cancelled'
            ? 'This test was cancelled by the clinic.'
            : 'Your result appears here once the test is done and your doctor has reviewed it.'}
        </Text>
      </View>
    );
  }
  const flag = result.flag ? FLAG[result.flag] : null;
  return (
    <View className={recordCard}>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className={recordTitle}>Result</Text>
        {flag ? <Pill label={flag.label} tone={flag.tone} /> : null}
      </View>
      <View className="rounded-xl border border-teal-200 bg-teal-50 p-3">
        <Text className="text-[14px] leading-[21px] text-heading">{result.summary}</Text>
      </View>
      {result.reviewedAt ? <Text className={recordMeta}>Reviewed by your doctor on {dateTime(result.reviewedAt)}</Text> : null}
      {result.followUp ? (
        <View className="flex-row gap-2 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
          <Icon name="info" color="#92400e" />
          <Text className="flex-1 text-[13px] leading-[19px] text-[#92400e]">
            Your doctor wants to follow up on this result. Book a visit or call {order.clinicName}.
          </Text>
        </View>
      ) : null}
      {order.consultation ? (
        <CardLink label={`From consultation #${order.consultation.reference}`} onPress={() => router.push(`/health/consultations/${order.consultation!.id}`)} />
      ) : null}
    </View>
  );
}

/** Where the order has got to, oldest step first. */
export function OrderProgress({ order }: { order: DiagnosticOrder }) {
  return (
    <View className={recordCard}>
      <Text className={recordTitle}>Progress</Text>
      {order.steps.map((step, index) => (
        <View key={`${step.action}-${step.at}`} className="flex-row gap-3">
          <View className="items-center">
            <View className={cn('size-5 items-center justify-center rounded-full border', step.action === 'cancelled' ? 'border-[#ba1a1a] bg-[#ba1a1a]' : 'border-teal bg-teal')}>
              <Icon name="check-white" size={9} />
            </View>
            {index < order.steps.length - 1 ? <View className="w-px flex-1 bg-edge" /> : null}
          </View>
          <View className="flex-1 pb-1">
            <Text className="font-pj-bd text-[13px] leading-[18px] text-heading">{STEP_LABEL[step.action]}</Text>
            <Text className="text-[12px] leading-[18px] text-[#566b74]">{dateTime(step.at)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}
