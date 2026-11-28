import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Glyph, RoundButton, type GlyphName } from '@/components/staff/ui';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';

/** Building blocks used only by the nurse screens. */

export const goBackToWard = () => (router.canGoBack() ? router.back() : router.replace('/nurse'));

export function NurseProfileButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Nurse profile"
      hitSlop={8}
      onPress={() => router.navigate('/nurse/profile')}
      className="size-8 items-center justify-center rounded-full bg-black">
      <Glyph name="person-outline" size={17} color="#ffffff" />
    </Pressable>
  );
}

type HeaderProps = { title: string; subtitle?: string; right?: ReactNode };

export function NurseHeader({ title, subtitle, right }: HeaderProps) {
  return (
    <View className="min-h-[60px] flex-row items-center gap-2.5 border-b border-sky-150/60 bg-sky-50 px-4 py-2">
      <RoundButton icon="arrow-back" label="Go back" onPress={goBackToWard} className="w-7" />
      <View className="flex-1">
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          className="font-pj-bd text-[18px] leading-6 tracking-[-0.4px] text-ink">
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} className="font-pj-sb text-[11px] leading-4 text-slate">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? <NurseProfileButton />}
    </View>
  );
}

/** The dark green card at the top of most nurse screens. */
export function ForestCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View className="overflow-hidden rounded-3xl">
      <LinearGradient colors={['#0c2b24', '#0a2924', '#041512']}>
        <View className={cn('gap-3 p-4', className)}>{children}</View>
      </LinearGradient>
    </View>
  );
}

type SectionProps = { title: string; icon?: GlyphName; tint?: string; right?: ReactNode };

export function SectionTitle({ title, icon, tint = '#081e26', right }: SectionProps) {
  return (
    <View className="flex-row items-center gap-2">
      {icon ? <Glyph name={icon} size={17} color={tint} /> : null}
      <Text accessibilityRole="header" className="flex-1 font-pj-bd text-[16px] leading-[22px] text-ink">
        {title}
      </Text>
      {right}
    </View>
  );
}

type ConfirmProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
};

export function ConfirmSheet({ visible, title, message, confirmLabel, busy, onConfirm, onClose, children }: ConfirmProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <Text className="pb-3 text-[13px] leading-5 text-slate">{message}</Text>
      {children}
      <Button label={confirmLabel} loading={busy} onPress={onConfirm} className={children ? 'mt-3' : undefined} />
      <Button label="Cancel" variant="soft" className="mt-2" onPress={onClose} />
    </Sheet>
  );
}
