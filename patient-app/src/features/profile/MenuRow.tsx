import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import type { IconName } from '@/theme/icons';

type Props = {
  icon: IconName;
  title: string;
  caption: string;
  onPress: () => void;
  tag?: string;
  first?: boolean;
};

export function MenuRow({ icon, title, caption, onPress, tag, first }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${caption}`}
      onPress={onPress}
      className={cn(
        'flex-row items-center gap-3 p-3.5 active:bg-sky-50',
        !first && 'border-t border-line/30',
      )}>
      <View className="size-9 items-center justify-center rounded-xl bg-sky-100">
        <Icon name={icon} size={15} color="#081e26" />
      </View>
      <View className="flex-1">
        <Text className="font-pj-md text-[14px] leading-5 text-ink">{title}</Text>
        <Text className="text-[12px] leading-[18px] text-slate">{caption}</Text>
      </View>
      {tag ? <Pill label={tag} /> : null}
      <Icon name="chevron-right-slate" />
    </Pressable>
  );
}
