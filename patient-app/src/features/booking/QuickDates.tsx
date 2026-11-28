import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { addDays, dayMonth, weekday } from '@/lib/dates';
import { clinicToday } from '@/lib/visit';

type Props = { selected: string; onSelect: (iso: string) => void };

export function QuickDates({ selected, onSelect }: Props) {
  const today = clinicToday();
  const quickDates = Array.from({ length: 7 }, (_, offset) => addDays(today, offset));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {quickDates.map((iso) => {
        const active = iso === selected;
        const label = iso === today ? 'Today' : iso === addDays(today, 1) ? 'Tomorrow' : weekday(iso);
        return (
          <Pressable
            key={iso}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(iso)}
            className={cn(
              'min-w-[74px] items-center rounded-xl border px-3.5 py-1.5',
              active ? 'border-black bg-black' : 'border-line/50 bg-white',
            )}>
            <Text
              className={cn('text-[11px] leading-[17px]', active ? 'text-[#e2e2e2]' : 'text-slate')}>
              {active ? `${weekday(iso)} · Selected` : label}
            </Text>
            <Text
              className={cn('font-pj-bd text-[13px] leading-5', active ? 'text-white' : 'text-ink')}>
              {dayMonth(iso)}
            </Text>
            <View className={cn('size-1.5 rounded-full', active ? 'bg-mint' : 'bg-line')} />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
