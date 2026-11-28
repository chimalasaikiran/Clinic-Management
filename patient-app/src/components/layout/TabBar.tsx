import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import colors from '@/theme/colors';
import type { IconName } from '@/theme/icons';

type Props = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const tabs: Record<string, { label: string; icon: IconName; activeIcon?: IconName }> = {
  home: { label: 'Home', icon: 'tab-home', activeIcon: 'tab-home-active' },
  clinics: { label: 'Clinics', icon: 'tab-clinics' },
  appointments: { label: 'Appointments', icon: 'tab-appointments' },
  health: { label: 'Health', icon: 'tab-health' },
  profile: { label: 'Profile', icon: 'tab-profile' },
};

export function TabBar({ state, emitter, navigateToTab }: Props) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row border-t border-edge/60 bg-white px-2 pt-2"
      style={{ paddingBottom: Math.max(bottom, 8) }}>
      {state.routes.map((route, index) => {
        const tab = tabs[route.name.split('/')[0]];
        if (!tab) return null;
        const focused = state.index === index;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const event = emitter.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            }}
            className="flex-1 items-center">
            <View className="h-5 items-center justify-center">
              <Icon
                name={focused && tab.activeIcon ? tab.activeIcon : tab.icon}
                color={focused ? colors.teal.DEFAULT : colors.slate}
              />
            </View>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1}
              className={cn(
                'text-[11px] leading-4 tracking-[-0.27px]',
                focused ? 'font-pj-bd text-teal' : 'font-pj-md text-slate',
              )}>
              {tab.label}
            </Text>
            <View className={cn('mt-0.5 size-1.5 rounded-full', focused && 'bg-teal')} />
          </Pressable>
        );
      })}
    </View>
  );
}
