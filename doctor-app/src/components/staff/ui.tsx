import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps, ReactNode } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import colors from '@/theme/colors';

/** Building blocks shared by the reception and nurse screens. */

export type GlyphName = ComponentProps<typeof MaterialIcons>['name'];

export function Glyph({ name, size = 16, color = colors.ink }: { name: GlyphName; size?: number; color?: string }) {
  return <MaterialIcons name={name} size={size} color={color} />;
}

const monoFamily = Platform.select({ ios: 'Courier', default: 'monospace' });

/** Fixed-width text, used for IDs and ledger values. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Text
      className={cn('text-[10px] leading-[15px] text-slate', className)}
      style={{ fontFamily: monoFamily }}>
      {children}
    </Text>
  );
}

/** Opens the dialler, and says so when the device has none. */
export function useDial() {
  const toast = useToast();
  return (number: string) => {
    Linking.openURL(`tel:${number}`).catch(() => toast('This device cannot make calls.'));
  };
}

type RoundButtonProps = {
  icon: GlyphName;
  label: string;
  onPress: () => void;
  dot?: boolean;
  count?: number;
  className?: string;
  color?: string;
};

export function RoundButton({ icon, label, onPress, dot, count, className, color }: RoundButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      className={cn('size-9 items-center justify-center rounded-full active:bg-sky-150', className)}>
      <Glyph name={icon} size={19} color={color} />
      {dot ? <View className="absolute right-1.5 top-1.5 size-2 rounded-full bg-danger" /> : null}
      {count ? (
        <View className="absolute -right-0.5 -top-0.5 min-w-[15px] items-center rounded-full bg-danger px-1">
          <Text maxFontSizeMultiplier={1} className="font-pj-bd text-[9px] leading-[15px] text-white">
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const chipTones = {
  sky: ['bg-sky-150', 'text-slate', colors.slate],
  pale: ['bg-sky-100', 'text-slate', colors.slate],
  steel: ['bg-sky-300', 'text-slate', colors.slate],
  mint: ['bg-mint', 'text-[#294d47]', '#294d47'],
  green: ['bg-[#ecfdf5]', 'text-[#047857]', '#047857'],
  red: ['bg-[#ffdad6]', 'text-[#93000a]', '#93000a'],
  amber: ['bg-[#fffbeb]', 'text-[#b45309]', '#b45309'],
  dark: ['bg-black', 'text-white', '#ffffff'],
  white: ['bg-white', 'text-ink', colors.ink],
} as const;

export type ChipTone = keyof typeof chipTones;

type ChipProps = { label: string; tone?: ChipTone; icon?: GlyphName; dot?: string; className?: string };

export function Chip({ label, tone = 'sky', icon, dot, className }: ChipProps) {
  const [box, text, tint] = chipTones[tone];
  return (
    <View className={cn('flex-row items-center gap-1 self-start rounded-full px-2 py-0.5', box, className)}>
      {dot ? <View className="size-1.5 rounded-full" style={{ backgroundColor: dot }} /> : null}
      {icon ? <Glyph name={icon} size={11} color={tint} /> : null}
      <Text className={cn('font-pj-bd text-[10px] leading-[15px]', text)}>{label}</Text>
    </View>
  );
}

const buttonTones = {
  dark: ['bg-black', 'text-white', '#ffffff'],
  sky: ['bg-sky-150', 'text-ink', colors.ink],
  pale: ['bg-sky-100', 'text-ink', colors.ink],
  steel: ['bg-sky-300', 'text-ink', colors.ink],
  mint: ['bg-mint', 'text-[#00201c]', '#00201c'],
  white: ['bg-white border border-sky-150', 'text-ink', colors.ink],
  navy: ['bg-[#0f172a]', 'text-white', '#ffffff'],
  danger: ['bg-[#ffdad6]', 'text-[#93000a]', '#93000a'],
  dangerLine: ['bg-white border border-[#fecaca]', 'text-[#ba1a1a]', '#ba1a1a'],
} as const;

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: GlyphName;
  iconRight?: GlyphName;
  tone?: keyof typeof buttonTones;
  disabled?: boolean;
  /** Use for the main action at the foot of a screen. */
  large?: boolean;
  className?: string;
};

export function ActionButton({ label, onPress, icon, iconRight, tone = 'sky', disabled, large, className }: ButtonProps) {
  const [box, text, tint] = buttonTones[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-center gap-1.5 px-3 active:opacity-80',
        large ? 'min-h-[48px] rounded-2xl' : 'min-h-[36px] rounded-xl',
        box,
        disabled && 'opacity-40',
        className,
      )}>
      {icon ? <Glyph name={icon} size={large ? 18 : 15} color={tint} /> : null}
      <Text
        className={cn(
          'shrink text-center font-pj-bd',
          large ? 'text-[14px] leading-5' : 'text-[12px] leading-4',
          text,
        )}>
        {label}
      </Text>
      {iconRight ? <Glyph name={iconRight} size={large ? 18 : 15} color={tint} /> : null}
    </Pressable>
  );
}

export function Box({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={cn('gap-3 rounded-2xl border border-sky-150/50 bg-white p-3.5', className)}>
      {children}
    </View>
  );
}

export function Heading({ title, right, className }: { title: string; right?: ReactNode; className?: string }) {
  return (
    <View className={cn('flex-row items-center justify-between gap-2', className)}>
      <Text accessibilityRole="header" className="shrink font-pj-bd text-[17px] leading-6 text-ink">
        {title}
      </Text>
      {right}
    </View>
  );
}

/** The thin strip under a header naming the terminal and its sync state. */
export function NodeStrip({ text, right }: { text: string; right?: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-full bg-sky-100 px-3 py-1.5">
      <View className="size-2 rounded-full bg-sage" />
      <Text numberOfLines={1} className="flex-1 font-pj-bd text-[10px] leading-[15px] text-slate">
        {text}
      </Text>
      {right ? <Text className="font-pj-bd text-[10px] leading-[15px] text-slate">{right}</Text> : null}
    </View>
  );
}

const avatarTones = {
  sky: ['bg-sky-300', 'text-slate'],
  black: ['bg-black', 'text-white'],
  slate: ['bg-slate', 'text-white'],
  deep: ['bg-[#1f333b]', 'text-white'],
} as const;

type AvatarProps = { initials: string; tone?: keyof typeof avatarTones; verified?: boolean; className?: string };

export function Avatar({ initials, tone = 'sky', verified, className }: AvatarProps) {
  return (
    <View className={cn('size-12 items-center justify-center rounded-2xl', avatarTones[tone][0], className)}>
      <Text className={cn('font-pj-bd text-[16px] leading-5', avatarTones[tone][1])}>{initials}</Text>
      {verified ? (
        <View className="absolute -bottom-1 -right-1 size-[18px] items-center justify-center rounded-full border-2 border-white bg-black">
          <Glyph name="check" size={10} color="#ffffff" />
        </View>
      ) : null}
    </View>
  );
}

type SquareProps = { icon: GlyphName; box?: string; color?: string; className?: string };

/** An icon in a rounded tile. */
export function IconTile({ icon, box = 'bg-sky-150', color, className }: SquareProps) {
  return (
    <View className={cn('size-8 items-center justify-center rounded-lg', box, className)}>
      <Glyph name={icon} size={16} color={color} />
    </View>
  );
}

type TimelineItem = { title: string; time: string; body: string };

/** A dotted history list, newest first. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <View>
      {items.map((item, index) => (
        <View key={item.title} className="flex-row gap-3">
          <View className="items-center">
            <View className={cn('mt-1 size-3 rounded-full', index === 0 ? 'bg-black' : 'bg-slate')} />
            {index < items.length - 1 ? <View className="w-0.5 flex-1 bg-sky-150" /> : null}
          </View>
          <View className="flex-1 pb-3">
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 font-pj-sb text-[13px] leading-[18px] text-ink">{item.title}</Text>
              <Text className="font-pj-bd text-[10px] leading-[18px] text-slate">{item.time}</Text>
            </View>
            <Text className="text-[12px] leading-[17px] text-slate">{item.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** A dashed tear line, as on a printed pass or voucher. */
export function TearLine() {
  return <View className="mx-3 border-t border-dashed border-sky-300" />;
}
