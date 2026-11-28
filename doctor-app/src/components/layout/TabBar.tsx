import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { useClinicalDay } from '@/features/doctor/clinical';
import colors from '@/theme/colors';
import type { IconName } from '@/theme/icons';

type Props = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const tabs: Record<string, { label: string; icon: IconName; activeIcon?: IconName }> = {
  today: { label: 'Today', icon: 'tab-today', activeIcon: 'tab-today-active' },
  patients: { label: 'Patients', icon: 'tab-patients', activeIcon: 'tab-patients-active' },
  schedule: { label: 'Schedule', icon: 'tab-schedule' },
  inbox: { label: 'Inbox', icon: 'tab-inbox' },
  profile: { label: 'Profile', icon: 'tab-profile' },
};

export function TabBar({ state, emitter, navigateToTab }: Props) {
  const { bottom } = useSafeAreaInsets();
  // The inbox badge counts what is waiting for the doctor: serious alerts, results to review and unsigned visits.
  const clinical = useClinicalDay().data?.clinical;
  const unreadCount = clinical ? clinical.alerts.total + clinical.results.total + clinical.unsigned.total : 0;
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row border-t border-sky-150/60 bg-sky-50 px-2 pt-2"
      style={{ paddingBottom: Math.max(bottom, 8) }}>
      {state.routes.map((route, index) => {
        const name = route.name.split('/')[0];
        const tab = tabs[name];
        if (!tab) return null;
        const focused = state.index === index;
        const badge = name === 'inbox' ? unreadCount : 0;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={badge ? `${tab.label}, ${badge} waiting` : tab.label}
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
              {badge ? (
                <View className="absolute -right-3 -top-1 min-w-[14px] items-center rounded-full bg-danger px-1">
                  <Text maxFontSizeMultiplier={1} className="font-pj-bd text-[9px] leading-[14px] text-white">
                    {badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1}
              className={cn(
                'text-[11px] leading-4',
                focused ? 'font-pj-bd text-ink' : 'font-pj-md text-slate',
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
