import { Pressable, ScrollView } from 'react-native';

import { cn } from '@/lib/cn';

import { Text } from './Text';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/** A horizontally scrolling row of single-choice filter pills. */
export function FilterChips<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      className="grow-0"
      contentContainerClassName="gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.value)}
            className={cn(
              'min-h-[32px] justify-center rounded-full border px-3.5',
              active ? 'border-black bg-black' : 'border-edge bg-white',
            )}>
            <Text
              className={cn(
                'font-pj-sb text-[12px] leading-4 tracking-[0.26px]',
                active ? 'text-white' : 'text-slate',
              )}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
