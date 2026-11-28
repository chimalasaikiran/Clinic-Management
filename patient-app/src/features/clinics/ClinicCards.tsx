import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';
import { addressText } from '@/lib/visit';
import type { Clinic } from '@/types';

type Props = {
  clinic: Clinic;
  onPress: () => void;
  /** The last card in the design uses an outlined button. */
  outlined?: boolean;
};

export function DiscoverCard({ clinic, onPress, outlined }: Props) {
  const flags = [
    clinic.onlineBooking ? 'Online booking' : 'Call to book',
    ...(clinic.connected ? ['Connected to you'] : []),
    ...(clinic.saved ? ['Saved'] : []),
  ];
  return (
    <View className="overflow-hidden rounded-2xl border border-edge bg-white">
      <View className="gap-3 p-4">
        <View className="gap-0.5">
          {clinic.facilityType ? (
            <View className="self-start rounded bg-teal-50 px-2">
              <Text className="font-pj-bd text-[10px] leading-[15px] text-teal">{clinic.facilityType.toUpperCase()}</Text>
            </View>
          ) : null}
          <Text className="font-pj-bd text-[17px] leading-[26px] tracking-[-0.43px] text-heading">
            {clinic.clinicName}
          </Text>
          <View className="flex-row items-center gap-1">
            <Icon name="pin-teal" />
            <Text className="flex-1 text-[12px] leading-[18px] text-[#566b74]">
              <Text className="font-pj-md text-[12px] text-heading">{clinic.name}</Text> · {addressText(clinic)}
            </Text>
          </View>
        </View>
        {clinic.departments.length ? (
          <View className="gap-1.5">
            <Text className="font-pj-sb text-[10px] leading-[15px] tracking-[0.5px] text-[#566b74]">
              BOOKABLE DEPARTMENTS:
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {clinic.departments.map((department) => (
                <View key={department} className="rounded-full border border-teal/15 bg-teal-50 px-2.5 py-0.5">
                  <Text className="font-pj-md text-[11px] leading-4 text-heading">{department}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
        <View className="flex-row flex-wrap gap-1.5">
          {flags.map((flag, index) => (
            <View
              key={flag}
              className={cn(
                'flex-row items-center gap-1.5 rounded-full border px-2.5 py-0.5',
                index === 0 ? 'border-teal/25 bg-teal-50' : 'border-edge bg-white',
              )}>
              <Icon name={index === 0 ? 'verified-teal' : 'link-teal'} />
              <Text className={cn('text-[11px] leading-4', index === 0 ? 'font-pj-sb text-teal' : 'font-pj-md text-heading')}>
                {flag}
              </Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Explore ${clinic.clinicName}, ${clinic.name}`}
          onPress={onPress}
          className={cn(
            'min-h-[44px] flex-row items-center justify-center gap-2 rounded-xl border border-heading px-3 active:opacity-80',
            outlined ? 'bg-white' : 'bg-heading',
          )}>
          <Text className={cn('font-pj-bd text-[13px] leading-5', outlined ? 'text-heading' : 'text-white')}>
            Explore Clinic & OPD Services
          </Text>
          <Icon name="arrow-xs-white" color={outlined ? '#182d35' : undefined} />
        </Pressable>
      </View>
    </View>
  );
}
