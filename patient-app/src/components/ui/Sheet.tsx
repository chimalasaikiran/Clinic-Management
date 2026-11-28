import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/** Bottom sheet used for pickers, confirmations and detail previews. */
export function Sheet({ visible, onClose, title, children }: Props) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="absolute inset-0 bg-black/40"
          onPress={onClose}
        />
        <View className="max-h-[85%] rounded-t-[28px] bg-white pt-3">
          <View className="mb-2 h-1 w-12 self-center rounded-full bg-line/80" />
          {title ? (
            <Text className="px-5 pb-2 pt-1 font-pj-bd text-[18px] leading-6 text-ink">{title}</Text>
          ) : null}
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottom + 16 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
