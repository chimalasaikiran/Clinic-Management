import { View } from 'react-native';

import { cn } from '@/lib/cn';
import type { IconName } from '@/theme/icons';

import { Icon } from './Icon';
import { Text } from './Text';

const tones = {
  mint: { box: 'border-teal/20 bg-teal-50', text: 'text-teal' },
  sky: { box: 'border-line/40 bg-sky-100', text: 'text-slate' },
  plain: { box: 'border-edge bg-white', text: 'text-heading' },
  dark: { box: 'border-black bg-black', text: 'text-white' },
  amber: { box: 'border-[#fde68a] bg-[#fffbeb]', text: 'text-[#92400e]' },
  red: { box: 'border-[#ba1a1a]/25 bg-[#ffdad6]/50', text: 'text-[#93000a]' },
} as const;

export type PillTone = keyof typeof tones;

type Props = {
  label: string;
  tone?: PillTone;
  icon?: IconName;
  iconColor?: string;
  className?: string;
};

/** A small rounded label used for statuses, tags and counts. */
export function Pill({ label, tone = 'mint', icon, iconColor, className }: Props) {
  return (
    <View
      className={cn(
        'flex-row items-center gap-1 self-start rounded-full border px-2 py-0.5',
        tones[tone].box,
        className,
      )}>
      {icon ? <Icon name={icon} size={11} color={iconColor} /> : null}
      <Text className={cn('font-pj-sb text-[11px] leading-4', tones[tone].text)}>{label}</Text>
    </View>
  );
}
