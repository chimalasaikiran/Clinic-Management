import { View } from 'react-native';

import { goBack, IconButton } from '@/components/layout/AppHeader';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';

export function BookingHeader({ step }: { step: 1 | 2 | 3 }) {
  const toast = useToast();
  return (
    <View className="min-h-[60px] flex-row items-center justify-between bg-white px-4 py-2">
      <IconButton icon="back-heading" label="Go back" onPress={goBack} />
      <View className="flex-row items-center gap-1.5 rounded-full border border-teal-200 bg-teal-100 px-3 py-1">
        <View className="size-1.5 rounded-full bg-teal" />
        <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.55px] text-heading">
          STEP {step} OF 3 · BOOKING
        </Text>
      </View>
      <IconButton
        icon="help-circle"
        label="Booking help"
        onPress={() => toast('For booking help, call the clinic from its page.')}
      />
    </View>
  );
}
