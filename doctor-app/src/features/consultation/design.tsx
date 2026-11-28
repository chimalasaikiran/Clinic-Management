import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { goBack } from '@/components/layout/AppHeader';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import type { IconName } from '@/theme/icons';

/** Type styles, cards and bars measured from the doctor app frames. */

export const type = {
  /** Small capitals-style label. */
  kicker: 'font-pj-bd text-[11px] leading-[14px] tracking-[0.6px] text-slate',
  heading: 'font-pj-sb text-[18px] leading-6 tracking-[-0.2px] text-ink',
  subheading: 'font-pj-sb text-[15px] leading-5 tracking-[0.2px] text-ink',
  strong: 'font-pj-sb text-[13px] leading-4 tracking-[0.3px] text-ink',
  item: 'font-pj-md text-[16px] leading-6 tracking-[-0.1px] text-ink',
  label: 'font-pj-md text-[14px] leading-5 text-ink',
  body: 'text-[13px] leading-[18px] tracking-[0.1px] text-slate',
  para: 'text-[14px] leading-5 text-ink',
} as const;

export function T({ v, className, children, lines }: { v: keyof typeof type; className?: string; children: ReactNode; lines?: number }) {
  return (
    <Text numberOfLines={lines} className={cn(type[v], className)}>
      {children}
    </Text>
  );
}

export function SoftCard({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={cn('rounded-xl bg-white p-4 shadow-sm', className)}>{children}</View>;
}

type PillProps = {
  label: string;
  className?: string;
  textClassName?: string;
  icon?: IconName;
  dot?: string;
};

export function Pill({ label, className, textClassName, icon, dot }: PillProps) {
  return (
    <View className={cn('flex-row items-center gap-1 self-start rounded-full bg-sky-150 px-2 py-0.5', className)}>
      {dot ? <View className="size-1.5 rounded-full" style={{ backgroundColor: dot }} /> : null}
      {icon ? <Icon name={icon} /> : null}
      <Text className={cn(type.kicker, 'shrink', textClassName)}>{label}</Text>
    </View>
  );
}

type HeaderProps = {
  title: string;
  /** Shown beside the title. */
  badge?: ReactNode;
  /** The second line, under the title. */
  below?: ReactNode;
  /** A full-width second row, for content too wide to sit beside the buttons. */
  row?: ReactNode;
  /** A few frames draw a chevron instead of the arrow. */
  chevron?: boolean;
  /** Extra buttons before the profile picture. */
  actions?: ReactNode;
};

export function DocHeader({ title, badge, below, row, chevron, actions }: HeaderProps) {
  return (
    <View className="min-h-[72px] justify-center bg-sky-50 px-3 py-2">
      <View className="flex-row items-center gap-2">
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack}>
        <Icon name={chevron ? 'hdr-chevron' : 'hdr-back'} />
      </Pressable>
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-1">
          <Text accessibilityRole="header" numberOfLines={1} className={cn(type.heading, 'shrink')}>
            {title}
          </Text>
          {badge}
        </View>
        {below}
      </View>
      {actions}
      <Pressable accessibilityRole="button" accessibilityLabel="Doctor profile" hitSlop={8} onPress={() => router.push('/profile')}>
        <Icon name="hdr-avatar" />
      </Pressable>
      </View>
      {row ? <View className="pl-12">{row}</View> : null}
    </View>
  );
}

export function HeaderStatus({ text, dot = '#4d626a' }: { text: string; dot?: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className="size-1.5 rounded-full" style={{ backgroundColor: dot }} />
      <Text numberOfLines={1} className={cn(type.body, 'shrink')}>
        {text}
      </Text>
    </View>
  );
}

/** A bar pinned under the scrolling content. */
export function Dock({ children, className }: { children: ReactNode; className?: string }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View className={cn('bg-sky-50 px-5 pt-3 shadow-lg', className)} style={{ paddingBottom: Math.max(bottom, 12) }}>
      <View className="w-full max-w-[440px] gap-2 self-center">{children}</View>
    </View>
  );
}

type DockButtonProps = {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'soft';
  iconLeft?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
};

export function DockButton({ label, onPress, tone = 'primary', iconLeft, iconRight, disabled, loading, className }: DockButtonProps) {
  const primary = tone === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      className={cn(
        'min-h-[50px] flex-row items-center justify-center gap-2 rounded-xl px-5 active:opacity-80',
        primary ? 'bg-black shadow-md' : 'bg-sky-200',
        disabled && 'opacity-40',
        className,
      )}>
      {loading ? (
        <ActivityIndicator color={primary ? '#ffffff' : '#081e26'} />
      ) : (
        <>
          {iconLeft ? <Icon name={iconLeft} /> : null}
          <Text className={cn(type.subheading, 'shrink text-center', primary && 'text-white')}>{label}</Text>
          {iconRight ? <Icon name={iconRight} /> : null}
        </>
      )}
    </Pressable>
  );
}

/** Replaces a screen's actions once the encounter is signed. */
export function SealedDock() {
  return (
    <Dock>
      <T v="body" className="text-center">
        This encounter is sealed. It can no longer be edited.
      </T>
      <DockButton label="View Summary" onPress={() => router.dismissTo('/patients/completed')} />
    </Dock>
  );
}
