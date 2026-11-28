import { Pressable, View } from 'react-native';

import { cn } from '@/lib/cn';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
};

/** The black pill switch from the design, identical on both platforms. */
export function Toggle({ value, onValueChange, label, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => onValueChange(!value)}
      className={cn(
        'h-7 w-12 justify-center rounded-full px-0.5',
        value ? 'bg-black' : 'bg-line',
        disabled && 'opacity-50',
      )}>
      <View className={cn('size-6 rounded-full bg-white', value && 'self-end')} />
    </Pressable>
  );
}
