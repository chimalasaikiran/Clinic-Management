import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

type Props = {
  header?: ReactNode;
  /** Pinned below the scroll area, e.g. a primary action bar. */
  footer?: ReactNode;
  children: ReactNode;
  /** Set when a tab bar sits below the screen and already covers the bottom inset. */
  inTabs?: boolean;
  className?: string;
  contentClassName?: string;
};

export function Screen({ header, footer, children, inTabs, className, contentClassName }: Props) {
  const { top, bottom } = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior="padding"
      className={cn('flex-1 bg-white', className)}
      style={{ paddingTop: top }}>
      {header}
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: footer || inTabs ? 0 : bottom }}>
        {/* Keeps the phone layout readable on wide screens. */}
        <View className={cn('w-full max-w-[480px] self-center px-5 py-5', contentClassName)}>
          {children}
        </View>
      </ScrollView>
      {footer ? (
        <View
          className="border-t border-line/30 bg-white px-5 pt-3"
          style={{ paddingBottom: inTabs ? 12 : Math.max(bottom, 16) }}>
          <View className="w-full max-w-[440px] self-center">{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
