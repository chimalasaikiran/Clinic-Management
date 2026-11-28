import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';

type Props<T extends string | number> = {
  label: string;
  /** Null until something is chosen. */
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
};

/** A dropdown that opens its options in a bottom sheet. */
export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <View className={cn('gap-1', className)}>
      <Text className="text-[11px] uppercase leading-4 tracking-[0.55px] text-slate">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? 'not selected'}`}
        onPress={() => setOpen(true)}
        className="h-[52px] flex-row items-center justify-between gap-1 rounded-xl border border-[#dce5e8] bg-white px-3">
        <Text numberOfLines={1} className="flex-1 text-[16px] leading-6 text-heading">
          {selected?.label ?? 'Select'}
        </Text>
        <Icon name="chevron-down" />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="menuitem"
            accessibilityState={{ selected: option.value === value }}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
            className={cn('rounded-xl px-3 py-3', option.value === value && 'bg-sky-100')}>
            <Text
              className={cn(
                'text-[16px] leading-6 text-heading',
                option.value === value && 'font-pj-bd',
              )}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}
