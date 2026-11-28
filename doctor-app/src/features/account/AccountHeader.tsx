import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { goBack } from '@/components/layout/AppHeader';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import type { IconName } from '@/theme/icons';

type Props = {
  title: string;
  subtitle: string;
  /** Each account frame exports its own back and profile glyphs. */
  back: IconName;
  profile: IconName;
  /** Extra buttons before the profile picture. */
  children?: ReactNode;
};

export function AccountHeader({ title, subtitle, back, profile, children }: Props) {
  return (
    <View className="min-h-[72px] flex-row items-center gap-2 bg-sky-50 px-4 py-2">
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack}>
        <Icon name={back} />
      </Pressable>
      <View className="flex-1">
        <Text accessibilityRole="header" className="font-pj-sb text-[18px] leading-6 text-ink">{title}</Text>
        <Text className="text-[13px] leading-[18px] text-slate">{subtitle}</Text>
      </View>
      {children}
      <Pressable accessibilityRole="button" accessibilityLabel="Doctor profile" hitSlop={6} onPress={() => router.dismissTo('/profile')}>
        <Icon name={profile} />
      </Pressable>
    </View>
  );
}
