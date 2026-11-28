import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import type { IconName } from '@/theme/icons';

type Props = {
  icon: IconName;
  title: string;
  caption: string;
  className: string;
  onPress: () => void;
  tag?: string;
  tagClassName?: string;
  dot?: boolean;
};

export function ServiceTile({
  icon,
  title,
  caption,
  className,
  onPress,
  tag,
  tagClassName,
  dot,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${caption}`}
      onPress={onPress}
      className={cn('min-h-[96px] flex-1 justify-between rounded-[18px] p-3.5 active:opacity-80', className)}>
      <View className="h-5 flex-row items-start justify-between">
        <Icon name={icon} />
        {dot ? <View className="size-1.5 rounded-full bg-[#6551b8]" /> : null}
        {tag ? (
          <View className="rounded-md bg-white px-2 py-0.5">
            <Text className={cn('text-[10px] leading-[15px]', tagClassName ?? 'font-pj-bd text-[#676473]')}>
              {tag}
            </Text>
          </View>
        ) : null}
      </View>
      <View className="pt-2">
        <Text className="font-pj-bd text-[14px] leading-5 text-[#292638]">{title}</Text>
        <Text className="text-[11px] leading-4 text-[#676473]">{caption}</Text>
      </View>
    </Pressable>
  );
}
