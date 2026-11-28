import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Glyph, type GlyphName } from '@/components/staff/ui';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';

const items: { icon: GlyphName; title: string; note: string; href: Href }[] = [
  { icon: 'schedule', title: 'Attendance', note: 'Today’s log and monthly record', href: '/me/attendance' },
  { icon: 'beach-access', title: 'Leave', note: 'Balance, requests and history', href: '/me/leave' },
  { icon: 'payments', title: 'Salary & Payslips', note: 'Pay, payslips and advances', href: '/me/salary' },
  { icon: 'notifications-none', title: 'Notifications', note: 'Work, pay and clinic updates', href: '/notifications' },
  { icon: 'help-outline', title: 'Help & Support', note: 'Answers, help desks and requests', href: '/support' },
];

/** Staff self-service links, shown on every role's profile. */
export function StaffMenu() {
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="px-1 font-pj-bd text-[11px] leading-4 text-slate">
        MY WORK & SUPPORT
      </Text>
      <View className="rounded-[20px] border border-sky-250/60 bg-white">
        {items.map((item, index) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            onPress={() => router.push(item.href)}
            className={cn('flex-row items-center gap-3 p-3.5', index > 0 && 'border-t border-sky-150')}>
            <View className="size-9 items-center justify-center rounded-xl bg-sky-150">
              <Glyph name={item.icon} size={18} />
            </View>
            <View className="flex-1">
              <Text className="font-pj-sb text-[13px] leading-[18px] text-ink">{item.title}</Text>
              <Text className="text-[11px] leading-4 text-slate">{item.note}</Text>
            </View>
            <Glyph name="chevron-right" size={18} color="#4d626a" />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
