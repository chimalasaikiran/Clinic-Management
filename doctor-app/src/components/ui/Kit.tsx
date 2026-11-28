import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/lib/cn';
import type { IconName } from '@/theme/icons';

import { Icon } from './Icon';
import { Text } from './Text';

/** Building blocks shared by the clinical screens. */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={cn('gap-3 rounded-2xl border border-edge bg-white p-4', className)}>
      {children}
    </View>
  );
}

type CardTitleProps = {
  title: string;
  icon?: IconName;
  subtitle?: string;
  right?: ReactNode;
};

export function CardTitle({ title, icon, subtitle, right }: CardTitleProps) {
  return (
    <View className="flex-row items-center gap-2">
      {icon ? (
        <View className="size-7 items-center justify-center rounded-lg bg-teal-100">
          <Icon name={icon} size={14} color="#006a61" />
        </View>
      ) : null}
      <View className="flex-1">
        <Text accessibilityRole="header" className="font-pj-xb text-[15px] leading-5 text-heading">
          {title}
        </Text>
        {subtitle ? <Text className="text-[11px] leading-4 text-slate">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

const tones = {
  mint: ['border-mint bg-mint/60', 'text-deep'],
  teal: ['border-teal-200 bg-teal-100', 'text-teal'],
  sky: ['border-sky-150 bg-sky-150', 'text-ink'],
  plain: ['border-edge bg-white', 'text-heading'],
  dark: ['border-black bg-black', 'text-white'],
  red: ['border-[#ffdad6] bg-[#ffdad6]', 'text-[#93000a]'],
  alert: ['border-[#d32f2f] bg-[#d32f2f]', 'text-white'],
  amber: ['border-[#fde68a] bg-[#fffbeb]', 'text-[#b45309]'],
  glass: ['border-white/10 bg-white/10', 'text-white/90'],
} as const;

export type Tone = keyof typeof tones;

export function Tag({ label, tone = 'sky', className }: { label: string; tone?: Tone; className?: string }) {
  return (
    <View className={cn('self-start rounded-full border px-2 py-0.5', tones[tone][0], className)}>
      <Text className={cn('font-pj-bd text-[10px] leading-[15px]', tones[tone][1])}>{label}</Text>
    </View>
  );
}

export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Text className={cn('font-pj-bd text-[10px] leading-[15px] tracking-[0.3px] text-slate', className)}>
      {children}
    </Text>
  );
}

/** A bordered inner block used inside cards. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className={cn('gap-1 rounded-xl border border-[#ebf0f2] bg-[#f8fafb] p-3', className)}>
      {children}
    </View>
  );
}

/** Lays children out two to a row. */
export function Grid({ children }: { children: ReactNode }) {
  return <View className="flex-row flex-wrap justify-between gap-y-2">{children}</View>;
}

type TileProps = {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  tag?: ReactNode;
  className?: string;
  valueClassName?: string;
};

/** A labelled reading. Half width by default, for use inside a Grid. */
export function Tile({ label, value, unit, note, tag, className, valueClassName }: TileProps) {
  return (
    <Panel className={cn('w-[48.5%]', className)}>
      <View className="flex-row items-start justify-between gap-1">
        <Kicker className="shrink">{label}</Kicker>
        {tag}
      </View>
      <Text className={cn('font-pj-xb text-[20px] leading-7 text-heading', valueClassName)}>
        {value}
        {unit ? <Text className="font-pj-md text-[11px] text-slate"> {unit}</Text> : null}
      </Text>
      {note ? <Text className="font-pj-md text-[10px] leading-[15px] text-slate">{note}</Text> : null}
    </Panel>
  );
}

export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="text-[12px] leading-[18px] text-slate">{label}</Text>
      <Text className="flex-1 text-right font-pj-sb text-[12px] leading-[18px] text-heading">
        {value}
      </Text>
    </View>
  );
}

type ChoiceProps = {
  title: string;
  body?: string;
  checked: boolean;
  onPress: () => void;
  kind?: 'check' | 'radio';
  disabled?: boolean;
  className?: string;
};

/** A tappable row with a checkbox or radio mark. */
export function Choice({
  title,
  body,
  checked,
  onPress,
  kind = 'check',
  disabled,
  className,
}: ChoiceProps) {
  return (
    <Pressable
      accessibilityRole={kind === 'radio' ? 'radio' : 'checkbox'}
      accessibilityLabel={title}
      accessibilityState={{ checked, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      className={cn('flex-row gap-2.5', disabled && 'opacity-50', className)}>
      <View
        className={cn(
          'mt-0.5 size-[18px] items-center justify-center',
          kind === 'radio' ? 'rounded-full' : 'rounded',
          checked ? 'bg-black' : 'border border-line bg-white',
        )}>
        {checked ? <Icon name="check-white" size={10} /> : null}
      </View>
      <View className="flex-1">
        <Text className="font-pj-sb text-[13px] leading-[18px] text-ink">{title}</Text>
        {body ? <Text className="text-[12px] leading-[18px] text-slate">{body}</Text> : null}
      </View>
    </Pressable>
  );
}

type SegmentProps<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
};

/** Wrapping single-choice pills, as used for routes, frequencies and tiers. */
export function Options<T extends string>({ options, value, onChange }: SegmentProps<T>) {
  return (
    <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-1.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => onChange(option.value)}
            className={cn(
              'rounded-xl border px-3 py-2',
              active ? 'border-black bg-black' : 'border-sky-150 bg-sky-100',
            )}>
            <Text
              className={cn('font-pj-sb text-[12px] leading-4', active ? 'text-white' : 'text-ink')}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
