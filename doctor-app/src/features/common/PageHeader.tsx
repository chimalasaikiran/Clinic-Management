import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { goBack } from '@/components/layout/AppHeader';
import { Glyph } from '@/components/staff/ui';
import { Text } from '@/components/ui/Text';

type Props = {
  title: string;
  subtitle?: string;
  /** Shown beside the title. */
  badge?: ReactNode;
  /** Buttons at the right edge. */
  right?: ReactNode;
};

export function PageHeader({ title, subtitle, badge, right }: Props) {
  return (
    <View className="min-h-[64px] flex-row items-center gap-3 border-b border-[#cfc4c5]/40 bg-sky-50 px-5 py-2">
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={10} onPress={goBack}>
        <Glyph name="arrow-back" size={22} />
      </Pressable>
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text accessibilityRole="header" className="shrink font-pj-bd text-[18px] leading-6 text-ink">
            {title}
          </Text>
          {badge}
        </View>
        {subtitle ? <Text className="text-[13px] leading-[18px] text-slate">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}
