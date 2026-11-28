import type { ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import colors from '@/theme/colors';

type Props = TextInputProps & {
  label?: string;
  labelClassName?: string;
  /** Right side of the label row. */
  labelAccessory?: ReactNode;
  optionalLabel?: boolean;
  hint?: string;
  error?: string;
  leading?: ReactNode;
  /** Icon or button drawn inside the field, on the right. */
  trailing?: ReactNode;
  boxClassName?: string;
  className?: string;
  inputClassName?: string;
};

export function TextField({
  label,
  labelClassName,
  labelAccessory,
  optionalLabel,
  hint,
  error,
  leading,
  trailing,
  boxClassName,
  className,
  inputClassName,
  multiline,
  ...input
}: Props) {
  return (
    <View className={cn('gap-1.5', className)}>
      {label ? (
        <View className="flex-row items-center justify-between gap-2">
          <Text
            className={
              labelClassName ?? 'font-pj-sb text-[13px] leading-4 tracking-[0.26px] text-ink'
            }>
            {label}
            {optionalLabel ? <Text className="text-[13px] text-slate"> (optional)</Text> : null}
          </Text>
          {labelAccessory}
        </View>
      ) : null}
      <View
        className={cn(
          'min-h-[52px] flex-row items-center gap-2 rounded-xl border px-4',
          boxClassName ?? 'border-line bg-white',
          !!error && 'border-[#ba1a1a]',
        )}>
        {leading}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...input}
          className={cn(
            'flex-1 py-3 font-pj text-[16px] text-ink',
            multiline && 'min-h-[96px]',
            inputClassName,
          )}
        />
        {trailing}
      </View>
      {error ? (
        <Text accessibilityRole="alert" className="text-[12px] leading-4 text-[#ba1a1a]">
          {error}
        </Text>
      ) : hint ? (
        <Text className="text-[13px] leading-[18px] text-slate">{hint}</Text>
      ) : null}
    </View>
  );
}
