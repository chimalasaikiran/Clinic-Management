import { Pressable, View } from 'react-native';

import { Card, Tag } from '@/components/ui/Kit';
import { Text } from '@/components/ui/Text';
import type { RxDraft } from '@/state/ConsultationState';

type Props = { item: RxDraft; index: number; onRemove?: () => void };

/** Quantity to dispense: one dose per administration, every day of the course. */
export const quantityOf = (item: Pick<RxDraft, 'dose' | 'frequencyPerDay' | 'durationDays'>) => item.dose * item.frequencyPerDay * item.durationDays;

export function RxItemCard({ item, index, onRemove }: Props) {
  return (
    <Card className="gap-2">
      <View className="flex-row items-start gap-2">
        <View className="size-6 items-center justify-center rounded-full bg-sky-300">
          <Text className="font-pj-bd text-[11px] text-ink">{index}</Text>
        </View>
        <Text className="flex-1 font-pj-bd text-[13px] leading-[18px] text-ink">
          {item.form === 'Capsule' ? 'Cap.' : 'Tab.'} {item.name} {item.strength}
        </Text>
        {onRemove ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name}`} hitSlop={10} onPress={onRemove}>
            <Text className="font-pj-bd text-[11px] leading-[18px] text-danger">Remove</Text>
          </Pressable>
        ) : null}
      </View>
      <Text className="text-[11px] leading-4 text-slate">
        {item.route} • {item.frequency} • {item.food} • {item.durationDays} days (Qty: {quantityOf(item)})
      </Text>
      {item.instructions ? (
        <View className="rounded-lg bg-sky-100 p-2.5">
          <Text className="text-[11px] leading-4 text-ink">Instructions: {item.instructions}</Text>
        </View>
      ) : null}
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Tag label={item.drugClass ? item.drugClass.toUpperCase() : 'MEDICINE'} />
        <Text className="text-[11px] leading-4 text-slate">For: {item.indication}</Text>
      </View>
    </Card>
  );
}
