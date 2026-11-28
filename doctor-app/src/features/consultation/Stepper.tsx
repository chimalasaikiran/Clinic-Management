import { Pressable, View } from 'react-native';

import { Kicker, Panel } from '@/components/ui/Kit';
import { Text } from '@/components/ui/Text';

type Props = {
  label: string;
  value: number;
  unit: string;
  step: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};

export function Stepper({ label, value, unit, step, min, max, onChange }: Props) {
  const button = (symbol: string, next: number, name: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} ${label.toLowerCase()}`}
      accessibilityState={{ disabled: next < min || next > max }}
      disabled={next < min || next > max}
      hitSlop={6}
      onPress={() => onChange(next)}
      className={`size-8 items-center justify-center rounded-lg bg-white ${next < min || next > max ? 'opacity-40' : ''}`}>
      <Text className="font-pj-bd text-[18px] leading-6 text-ink">{symbol}</Text>
    </Pressable>
  );
  return (
    <Panel className="flex-1 border-sky-150 bg-sky-100">
      <Kicker>{label}</Kicker>
      <View className="flex-row items-center justify-between gap-1">
        {button('−', value - step, 'Decrease')}
        <Text className="font-pj-bd text-[13px] leading-5 text-ink">
          {value} {unit}
        </Text>
        {button('+', value + step, 'Increase')}
      </View>
    </Panel>
  );
}
