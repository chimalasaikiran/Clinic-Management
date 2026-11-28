import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { OnboardingHeader } from '@/components/layout/OnboardingHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { languages, useOnboarding } from '@/state/OnboardingState';

export default function LanguageSelection() {
  const toast = useToast();
  const { language, setLanguage } = useOnboarding();
  const selectedName = languages.find((item) => item.code === language)?.name;

  return (
    <Screen
      header={<OnboardingHeader progress={0.2} caption="Step 1 of 5" />}
      footer={
        <Button
          label={`Continue in ${selectedName}`}
          iconRight="arrow-forward-white"
          onPress={() => router.push('/phone')}
        />
      }>
      <View className="flex-row items-center gap-1.5 self-start rounded-full bg-mint/40 px-2.5 py-1">
        <Icon name="translate" />
        <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.55px] text-charcoal">
          Localization & Accessibility
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        className="pt-2.5 font-pj-bd text-[26px] leading-[34px] tracking-[-0.65px] text-heading">
        Choose your preferred language
      </Text>
      <Text className="pt-1.5 text-[14px] leading-5 text-body">
        You can easily change this anytime in your profile settings.
      </Text>

      <View className="mt-5 flex-row items-center gap-3 rounded-xl border border-line/40 bg-sky-100 p-[15px]">
        <View className="size-8 items-center justify-center rounded-full bg-sky-150">
          <Icon name="volume-up" />
        </View>
        <View className="flex-1">
          <Text className="font-pj-sb text-[13px] leading-4 tracking-[0.26px] text-ink">
            Spoken guidance
          </Text>
          <Text className="text-[13px] leading-[18px] text-slate">
            Audio pronunciation assistance available
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Listen to sample audio"
          onPress={() => toast('Sample audio is not available yet.')}
          className="h-8 justify-center rounded-lg border border-line/50 bg-white px-2.5">
          <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.55px] text-charcoal">
            Preview
          </Text>
        </Pressable>
      </View>

      <View accessibilityRole="radiogroup" className="mt-5 gap-2.5">
        {languages.map((item) => {
          const active = item.code === language;
          return (
            <Pressable
              key={item.code}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={item.name}
              onPress={() => setLanguage(item.code)}
              className={cn(
                'flex-row items-center gap-3.5 rounded-2xl border-2 p-[17px]',
                active ? 'border-black bg-sky-100/60' : 'border-line/40 bg-white',
              )}>
              <View
                className={cn(
                  'size-10 items-center justify-center rounded-full',
                  active ? 'bg-black' : 'bg-sky-150',
                )}>
                <Text
                  className={cn(
                    'font-pj-sb text-[18px] leading-6',
                    active ? 'text-white' : 'text-body',
                  )}>
                  {item.badge}
                </Text>
              </View>
              <View className="flex-1">
                <Text
                  className={cn('text-[16px] leading-6 text-heading', active && 'font-pj-sb')}>
                  {item.name}
                </Text>
                <Text className="text-[13px] leading-[18px] text-slate">{item.greeting}</Text>
              </View>
              <View
                className={cn(
                  'size-6 items-center justify-center rounded-full',
                  active ? 'bg-black' : 'border border-line/80 bg-white',
                )}>
                {active ? <Icon name="check-white" /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-6 flex-row gap-3 rounded-2xl border border-line/40 bg-sky-50 p-[17px]">
        <Icon name="shield-check" />
        <View className="flex-1 gap-0.5">
          <Text className="font-pj-sb text-[13px] leading-4 tracking-[0.26px] text-ink">
            HIPAA & Digital Health Data Certified
          </Text>
          <Text className="text-[13px] leading-[18px] text-slate">
            Clinical summaries and doctor instructions will be rendered in your selected language
            with certified terminology translation.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
