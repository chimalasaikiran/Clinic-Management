import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import type { Resource } from '@/hooks/useResource';
import { cn } from '@/lib/cn';
import { clock } from '@/lib/visit';
import type { Slots } from '@/types';

const GROUPS = [
  { label: 'Morning', icon: 'morning', from: '00:00', to: '12:00' },
  { label: 'Afternoon', icon: 'afternoon', from: '12:00', to: '17:00' },
  { label: 'Evening', icon: 'evening', from: '17:00', to: '24:00' },
] as const;

type Props = {
  slots: Resource<Slots>;
  selected: string | null;
  onSelect: (time: string) => void;
};

/** The open times for one day, as the clinic's schedule currently has them. */
export function SlotPicker({ slots, selected, onSelect }: Props) {
  if (!slots.data) {
    return slots.error ? <ErrorState message={slots.error.message} onAction={slots.reload} /> : <LoadingState label="Checking open times…" />;
  }
  const day = slots.data.days[0];
  if (!day || day.slots.length === 0) {
    return (
      <EmptyState
        title={day?.closed !== undefined ? 'Clinic closed' : 'No times on this day'}
        message={day?.closed ? `${day.closed}. Choose another date.` : 'Choose another date to see open times.'}
      />
    );
  }

  return (
    <View className="gap-4">
      {GROUPS.map((group) => {
        const items = day.slots.filter((slot) => slot.time >= group.from && slot.time < group.to);
        if (!items.length) return null;
        const open = items.filter((slot) => slot.available).length;
        return (
          <View key={group.label} className="gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1 flex-row items-center gap-1">
                <Icon name={group.icon} />
                <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{group.label}</Text>
              </View>
              <View className="rounded bg-sky-150 px-2 py-0.5">
                <Text className="font-pj-md text-[11px] leading-[18px] text-[#526871]">
                  {open} open
                </Text>
              </View>
            </View>
            <View accessibilityRole="radiogroup" className="flex-row flex-wrap justify-between gap-y-2">
              {items.map((slot) => {
                const active = slot.time === selected;
                return (
                  <Pressable
                    key={slot.time}
                    accessibilityRole="radio"
                    accessibilityLabel={slot.available ? clock(slot.time) : `${clock(slot.time)}, fully booked`}
                    accessibilityState={{ checked: active, disabled: !slot.available }}
                    disabled={!slot.available}
                    onPress={() => onSelect(slot.time)}
                    className={cn(
                      'h-10 w-[31.5%] flex-row items-center justify-center gap-1 rounded-xl border',
                      active ? 'border-black bg-black' : !slot.available ? 'border-line/20 bg-sky-150' : 'border-line/50 bg-white',
                    )}>
                    <Text
                      className={cn(
                        'text-[13px] leading-4 tracking-[0.3px]',
                        active ? 'font-pj-bd text-white' : !slot.available ? 'font-pj-sb text-line' : 'font-pj-md text-ink',
                      )}>
                      {clock(slot.time)}
                    </Text>
                    {active ? <Icon name="check-circle-mint" /> : null}
                  </Pressable>
                );
              })}
              {/* Keeps a short last row aligned to the left. */}
              {Array.from({ length: (3 - (items.length % 3)) % 3 }, (_, i) => (
                <View key={i} className="w-[31.5%]" />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
