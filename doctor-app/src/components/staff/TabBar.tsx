import { router, type Href, type Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import colors from '@/theme/colors';

import { Glyph, type GlyphName } from './ui';

export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

/** A tab switches to its route. One with an href opens that screen on top instead. */
export type TabItem = { label: string; icon: GlyphName; route?: string; href?: Href; dot?: boolean };

export function StaffTabBar({ state, emitter, navigateToTab, items }: TabBarProps & { items: TabItem[] }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row border-t border-sky-150/60 bg-sky-50 px-2 pt-2"
      style={{ paddingBottom: Math.max(bottom, 8) }}>
      {items.map((item) => {
        const index = state.routes.findIndex((route) => route.name === item.route);
        const focused = index >= 0 && state.index === index;
        return (
          <Pressable
            key={item.label}
            accessibilityRole="tab"
            accessibilityLabel={`${item.label} tab`}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              if (item.href) {
                router.push(item.href);
                return;
              }
              const route = state.routes[index];
              if (!route) return;
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            }}
            className="flex-1 items-center gap-0.5">
            <View>
              <Glyph name={item.icon} size={20} color={focused ? colors.ink : colors.slate} />
              {item.dot ? <View className="absolute -right-1 top-0 size-2 rounded-full bg-danger" /> : null}
            </View>
            <Text
              numberOfLines={1}
              maxFontSizeMultiplier={1}
              className={cn('text-[11px] leading-4', focused ? 'font-pj-bd text-ink' : 'font-pj-md text-slate')}>
              {item.label}
            </Text>
            <View className={cn('size-1.5 rounded-full', focused && 'bg-teal')} />
          </Pressable>
        );
      })}
    </View>
  );
}
