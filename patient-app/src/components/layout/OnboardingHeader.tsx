import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';

type Props = {
  /** 0 to 1. */
  progress: number;
  /** Shown under the title, as on the first two steps. */
  caption?: string;
  /** Shown as a pill beside the title, as on later steps. */
  pill?: string;
};

export function OnboardingHeader({ progress, caption, pill }: Props) {
  const toast = useToast();
  return (
    <View className="bg-sky-50/90">
      <View className="min-h-[60px] flex-row items-center justify-between px-5 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="w-12">
          <Icon name="arrow-back" />
        </Pressable>
        <View className={pill ? 'flex-1 flex-row items-center gap-2' : 'flex-1 items-center'}>
          <Text className="font-pj-bd text-[18px] leading-6 tracking-[-0.45px] text-charcoal">
            Clinic OS
          </Text>
          {caption ? (
            <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.55px] text-muted">
              {caption}
            </Text>
          ) : null}
          {pill ? (
            <View className="rounded-full border border-line/40 bg-sky-300 px-2 py-0.5">
              <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.55px] text-steel">
                {pill}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => toast('Need help? Call the clinic desk at +91 20 6710 4910.')}
          className="w-12 items-end">
          <Text className="font-pj-sb text-[15px] leading-5 text-charcoal">Help</Text>
        </Pressable>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        className="h-1 bg-sky-150">
        <View className="h-1 rounded-r-full bg-black" style={{ width: `${progress * 100}%` }} />
      </View>
    </View>
  );
}
