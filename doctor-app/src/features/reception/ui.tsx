import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Chip, Glyph, RoundButton, type GlyphName } from '@/components/staff/ui';
import { Text } from '@/components/ui/Text';
import { useSignedIn } from '@/state/SessionState';
import colors from '@/theme/colors';

/** The reception header, with the shared building blocks its screens use. */

export * from '@/components/staff/ui';

export const goBackToDesk = () =>
  router.canGoBack() ? router.back() : router.replace('/reception');

/** The receptionist's avatar, which opens the staff profile. */
export function ProfileButton({ initials }: { initials?: boolean }) {
  const name = useSignedIn()?.user.fullName ?? '';
  const letters = name.split(/\s+/).filter(Boolean).map((word) => word[0]).filter(Boolean);
  const short = ((letters[0] ?? '') + (letters.length > 1 ? letters.at(-1) : '')).toUpperCase();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Staff profile"
      hitSlop={8}
      onPress={() => router.push('/reception/profile')}
      className="size-8 items-center justify-center rounded-full bg-black">
      {initials && short ? (
        <Text className="font-pj-bd text-[11px] leading-4 text-white">{short}</Text>
      ) : (
        <Glyph name="person-outline" size={17} color="#ffffff" />
      )}
    </Pressable>
  );
}

type HeaderProps = {
  title: string;
  subtitle: string;
  subtitleIcon?: GlyphName;
  /** Screen reference shown beside the title, such as RF-15. */
  code?: string;
  back?: boolean;
  leading?: ReactNode;
  right?: ReactNode;
};

export function ReceptionHeader({ title, subtitle, subtitleIcon, code, back = true, leading, right }: HeaderProps) {
  return (
    <View className="min-h-[60px] flex-row items-center gap-2.5 border-b border-sky-150/60 bg-sky-50 px-4 py-2">
      {back ? <RoundButton icon="arrow-back" label="Go back" onPress={goBackToDesk} className="w-7" /> : null}
      {leading}
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            className="shrink font-pj-bd text-[17px] leading-[23px] tracking-[-0.4px] text-ink">
            {title}
          </Text>
          {code ? <Chip label={code} tone="steel" /> : null}
        </View>
        <View className="flex-row items-center gap-1">
          {subtitleIcon ? <Glyph name={subtitleIcon} size={12} color={colors.slate} /> : null}
          <Text numberOfLines={1} className="shrink text-[12px] leading-4 text-slate">
            {subtitle}
          </Text>
        </View>
      </View>
      {right}
    </View>
  );
}
