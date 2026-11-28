import { View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';

export function EmergencyNotice() {
  return (
    <View
      accessibilityRole="alert"
      className="flex-row gap-3 rounded-2xl border border-[#ba1a1a]/25 bg-[#ffdad6]/40 p-3.5">
      <Icon name="warning-red" />
      <View className="flex-1">
        <Text className="font-pj-bd text-[13px] leading-[18px] text-[#93000a]">
          Not for Medical Emergencies
        </Text>
        <Text className="text-[12px] leading-[18px] text-body">
          If experiencing severe chest pain, extreme breathlessness, or acute trauma, immediately
          dial <Text className="font-pj-bd text-[12px] text-[#93000a]">112 / 108</Text> or go to the
          nearest emergency department. Clinic OS support does not provide clinical emergency care.
        </Text>
      </View>
    </View>
  );
}
