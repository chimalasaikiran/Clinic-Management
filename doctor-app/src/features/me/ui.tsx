import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Glyph, type GlyphName } from '@/components/staff/ui';
import { Text } from '@/components/ui/Text';
import { PageHeader } from '@/features/common/PageHeader';
import { cn } from '@/lib/cn';

/** Building blocks for the staff self-service screens, which are set in Inter. */

type TextProps = { children: ReactNode; className?: string; lines?: number };

/** 12px body text. Pass `font-in-*`, a size or a colour to change it. */
export function Txt({ children, className, lines }: TextProps) {
  return (
    <Text numberOfLines={lines} className={cn('font-in text-[12px] leading-[17px] text-[#191c1e]', className)}>
      {children}
    </Text>
  );
}

/** The 11px grey label used over values. */
export function Label({ children, className }: TextProps) {
  return <Txt className={cn('font-in-sb text-[11px] leading-4 text-[#45464d]', className)}>{children}</Txt>;
}

export function MeScreen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Screen className="bg-[#f4fbfd]" header={<PageHeader title={title} />} contentClassName="gap-4 px-4 pt-3 pb-8">
      {children}
    </Screen>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={cn('gap-3 rounded-xl border border-[#c6c6cd] bg-white p-4', className)}>{children}</View>;
}

export function CardTitle({ title, icon, right, className }: { title: string; icon?: GlyphName; right?: ReactNode; className?: string }) {
  return (
    <View className={cn('flex-row items-center justify-between gap-2', className)}>
      <View className="flex-1 flex-row items-center gap-2">
        {icon ? <Glyph name={icon} size={16} color="#191c1e" /> : null}
        <Text accessibilityRole="header" className="shrink font-in-bd text-[14px] leading-5 text-[#191c1e]">
          {title}
        </Text>
      </View>
      {typeof right === 'string' ? <Label>{right}</Label> : right}
    </View>
  );
}

const pillTones = {
  grey: ['border-[#eceef0] bg-[#eceef0]', 'text-[#45464d]', '#45464d'],
  green: ['border-[#a7f3d0] bg-[#ecfdf5]', 'text-[#047857]', '#047857'],
  teal: ['border-[#89f5e7] bg-[#89f5e7]', 'text-[#005049]', '#005049'],
  blue: ['border-[#cce5ff] bg-[#cce5ff]', 'text-[#001d31]', '#001d31'],
  amber: ['border-[#fde68a] bg-[#fffbeb]', 'text-[#b45309]', '#b45309'],
  indigo: ['border-[#c7d2fe] bg-[#eef2ff]', 'text-[#4338ca]', '#4338ca'],
  red: ['border-[#fda4af] bg-[#ffe4e6]', 'text-[#b91c1c]', '#b91c1c'],
} as const;

export type PillTone = keyof typeof pillTones;

export function Pill({ label, tone = 'grey', icon, dot }: { label: string; tone?: PillTone; icon?: GlyphName; dot?: boolean }) {
  const [box, text, tint] = pillTones[tone];
  return (
    <View className={cn('flex-row items-center gap-1 self-start rounded-full border px-2 py-0.5', box)}>
      {dot ? <View className="size-1.5 rounded-full" style={{ backgroundColor: tint }} /> : null}
      {icon ? <Glyph name={icon} size={11} color={tint} /> : null}
      <Text className={cn('font-in-sb text-[11px] leading-4', text)}>{label}</Text>
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: GlyphName;
  tone?: 'black' | 'line' | 'danger';
  disabled?: boolean;
  className?: string;
};

export function MeButton({ label, onPress, icon, tone = 'black', disabled, className }: ButtonProps) {
  const black = tone === 'black';
  const tint = black ? '#ffffff' : tone === 'danger' ? '#be123c' : '#191c1e';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'min-h-[40px] flex-row items-center justify-center gap-1.5 rounded-lg px-3 active:opacity-80',
        black ? 'bg-black' : 'border bg-white',
        tone === 'line' && 'border-[#c6c6cd]',
        tone === 'danger' && 'border-[#fda4af]',
        disabled && 'opacity-40',
        className,
      )}>
      {icon ? <Glyph name={icon} size={15} color={tint} /> : null}
      <Text className="shrink text-center font-in-sb text-[13px] leading-[18px]" style={{ color: tint }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A text link with a trailing chevron. */
export function MeLink({ label, onPress, className }: { label: string; onPress: () => void; className?: string }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} hitSlop={10} onPress={onPress} className="flex-row items-center gap-0.5">
      <Text className={cn('font-in-sb text-[12px] leading-4 text-[#006398]', className)}>{label}</Text>
      <Glyph name="chevron-right" size={14} color="#006398" />
    </Pressable>
  );
}

/** A label on the left and its value on the right. */
export function Line({ label, value, valueClassName, className }: { label: string; value: string; valueClassName?: string; className?: string }) {
  return (
    <View className={cn('flex-row items-start justify-between gap-3', className)}>
      <Txt className="text-[#45464d]">{label}</Txt>
      <Txt className={cn('flex-1 text-right font-in-md', valueClassName)}>{value}</Txt>
    </View>
  );
}

export function Progress({ percent, color = '#000000', height = 6 }: { percent: number; color?: string; height?: number }) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(percent) }}
      className="overflow-hidden rounded-full bg-[#eceef0]"
      style={{ height }}>
      <View className="h-full" style={{ width: `${percent}%`, backgroundColor: color }} />
    </View>
  );
}

/** A grey tile holding one figure. */
export function Figure({ label, value, note, valueClassName, className }: { label: string; value: string; note?: string; valueClassName?: string; className?: string }) {
  return (
    <View className={cn('flex-1 gap-0.5 rounded-lg border border-[#eceef0] bg-[#f2f4f6] p-2.5', className)}>
      <Label>{label}</Label>
      <Txt className={cn('font-in-bd text-[16px] leading-6', valueClassName)}>{value}</Txt>
      {note ? <Txt className="text-[11px] leading-4 text-[#45464d]">{note}</Txt> : null}
    </View>
  );
}

/** A note on a grey ground with an icon. */
export function Notice({ text, icon = 'info-outline' }: { text: string; icon?: GlyphName }) {
  return (
    <View className="flex-row gap-2 rounded-lg border border-[#e0e3e5] bg-[#f2f4f6] p-2.5">
      <Glyph name={icon} size={14} color="#45464d" />
      <Txt className="flex-1 text-[#45464d]">{text}</Txt>
    </View>
  );
}

export function Fine({ children, className }: TextProps) {
  return <Txt className={cn('text-center text-[11px] leading-4 text-[#76777d]', className)}>{children}</Txt>;
}
