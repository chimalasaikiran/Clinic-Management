import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';

import { cn } from '@/lib/cn';
import type { IconName } from '@/theme/icons';

import { Icon } from './Icon';
import { Text } from './Text';

const variants = {
  primary: { box: 'bg-black', text: 'text-white', spinner: '#ffffff' },
  white: { box: 'bg-white', text: 'text-ink', spinner: '#081e26' },
  outline: { box: 'bg-white border border-line/60', text: 'text-ink', spinner: '#081e26' },
  soft: { box: 'bg-sky-100 border border-line/40', text: 'text-ink', spinner: '#081e26' },
  danger: { box: 'bg-[#ba1a1a]', text: 'text-white', spinner: '#ffffff' },
} as const;

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: keyof typeof variants;
  size?: 'sm' | 'md' | 'lg';
  iconLeft?: IconName;
  iconRight?: IconName;
  iconColor?: string;
  loading?: boolean;
  className?: string;
  textClassName?: string;
};

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  iconLeft,
  iconRight,
  iconColor,
  loading = false,
  disabled,
  className,
  textClassName,
  ...props
}: Props) {
  const style = variants[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: loading }}
      disabled={inactive}
      {...props}
      className={cn(
        'flex-row items-center justify-center gap-2 active:opacity-80',
        size === 'lg' && 'min-h-[52px] rounded-2xl px-4',
        size === 'md' && 'min-h-[44px] rounded-xl px-3',
        size === 'sm' && 'min-h-[34px] rounded-lg px-3',
        style.box,
        disabled && 'opacity-40',
        className,
      )}>
      {loading ? (
        <ActivityIndicator color={style.spinner} />
      ) : (
        <>
          {iconLeft ? <Icon name={iconLeft} color={iconColor} /> : null}
          <View className="shrink">
            <Text
              className={cn(
                'text-center font-pj-sb',
                size === 'lg' ? 'text-[15px] leading-5' : 'text-[13px] leading-4',
                style.text,
                textClassName,
              )}>
              {label}
            </Text>
          </View>
          {iconRight ? <Icon name={iconRight} color={iconColor} /> : null}
        </>
      )}
    </Pressable>
  );
}
