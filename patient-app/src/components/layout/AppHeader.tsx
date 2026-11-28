import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import type { IconName } from '@/theme/icons';

/** Returns to the previous screen, or to Home when the screen was opened directly. */
export const goBack = () => (router.canGoBack() ? router.back() : router.replace('/home'));

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  size?: number;
  color?: string;
  className?: string;
};

export function IconButton({ icon, label, onPress, size, color, className }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      className={cn('size-9 items-center justify-center rounded-full active:bg-sky-100', className)}>
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

type Props = {
  title: string;
  subtitle?: string;
  /** Hide on tab root screens. */
  back?: boolean;
  /** Small element shown beside the title, such as a count pill. */
  badge?: ReactNode;
  right?: ReactNode;
};

export function AppHeader({ title, subtitle, back = true, badge, right }: Props) {
  return (
    <View className="min-h-[60px] flex-row items-center gap-2 border-b border-line/30 bg-white px-4 py-2">
      {back ? <IconButton icon="arrow-back" label="Go back" size={15} onPress={goBack} /> : null}
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            className="shrink font-pj-bd text-[17px] leading-6 tracking-[-0.4px] text-ink">
            {title}
          </Text>
          {badge}
        </View>
        {subtitle ? (
          <Text numberOfLines={2} className="text-[12px] leading-4 text-slate">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View className="flex-row items-center">{right}</View> : null}
    </View>
  );
}
