import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { languages, useOnboarding, type AuthMode } from '@/state/OnboardingState';
import { useSession } from '@/state/SessionState';
import type { IconName } from '@/theme/icons';

const frosted = 'border border-white/30 bg-white/20';

function TrustBadge({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View className={`flex-row items-center gap-1.5 rounded-full px-[14px] py-[7px] ${frosted}`}>
      <Icon name={icon} />
      <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.55px] text-white">
        {label}
      </Text>
    </View>
  );
}

export default function Welcome() {
  const { top, bottom } = useSafeAreaInsets();
  const { language, setLanguage, setMode } = useOnboarding();
  const [pickingLanguage, setPickingLanguage] = useState(false);
  const languageName = languages.find((item) => item.code === language)?.name;
  const { session, retry } = useSession();

  if (session.status === 'loading') return <View className="flex-1 bg-black" />;
  if (session.status === 'signedIn') {
    // The date of birth is how clinic records are found, so setup is finished first.
    return <Redirect href={session.account.dateOfBirth ? '/home' : '/about-you'} />;
  }

  const start = (mode: AuthMode) => {
    setMode(mode);
    router.push(mode === 'signup' ? '/language' : '/phone');
  };

  return (
    <View className="flex-1 bg-black">
      <StatusBar style="light" />
      <Image
        source={require('../../assets/images/welcome-hero.jpg')}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
        accessibilityLabel="A doctor consulting with a patient"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
        style={StyleSheet.absoluteFill}
      />

      <View className="px-5" style={{ paddingTop: top + 12 }}>
        <View className="flex-row items-center justify-between">
          <View className={`flex-row items-center gap-2.5 rounded-2xl px-3 py-[7px] ${frosted}`}>
            <View className="size-7 items-center justify-center rounded-xl bg-ink">
              <Icon name="brand-mark" />
            </View>
            <Text className="font-pj-bd text-[17px] leading-[26px] tracking-[-0.43px] text-white">
              Clinic OS
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose language"
            onPress={() => setPickingLanguage(true)}
            className={`flex-row items-center gap-1.5 rounded-full px-[14px] py-[7px] ${frosted}`}>
            <Icon name="globe-white" />
            <Text className="font-pj-sb text-[13px] leading-4 tracking-[0.26px] text-white">
              {languageName}
            </Text>
            <Icon name="chevron-down-white" />
          </Pressable>
        </View>
        <View className="flex-row flex-wrap justify-between gap-2.5 pt-10">
          <TrustBadge icon="star-gold" label="Book clinic visits" />
          <TrustBadge icon="verified-mint" label="Your health records" />
        </View>
      </View>

      <View
        className="mt-auto w-full max-w-[480px] self-center px-5"
        style={{ paddingBottom: Math.max(bottom, 16) + 8 }}>
        <Text
          accessibilityRole="header"
          className="font-pj-bd text-[32px] leading-[38px] tracking-[-0.8px] text-white">
          Healthcare that puts{'\n'}you first.
        </Text>
        <Text className="pt-2.5 text-[14px] leading-[23px] text-white/80">
          Book appointments and see the records your clinic shares with you, all in one place.
        </Text>
        {session.status === 'unreachable' ? (
          <Pressable accessibilityRole="button" onPress={retry} className="pt-3">
            <Text accessibilityRole="alert" className="text-[13px] leading-5 text-white">
              {session.message} <Text className="font-pj-sb text-[13px] text-white underline">Try again</Text>
            </Text>
          </Pressable>
        ) : null}
        <Button
          label="Get Started"
          variant="white"
          iconRight="arrow-forward-ink"
          textClassName="font-pj-bd"
          className="mt-5 min-h-[54px]"
          onPress={() => start('signup')}
        />
        <Pressable accessibilityRole="link" onPress={() => start('signin')} className="py-4">
          <Text className="text-center text-[14px] leading-5 text-white/80">
            Already have an account?{' '}
            <Text className="font-pj-sb text-[14px] text-white underline">Sign in</Text>
          </Text>
        </Pressable>
        <View className="flex-row items-center justify-center gap-1.5 border-t border-white/15 pt-4">
          <Icon name="shield-mint" />
          <Text className="shrink text-[11px] leading-4 tracking-[0.27px] text-white/75">
            Only you and your clinic can see your records
          </Text>
        </View>
      </View>

      <Sheet
        visible={pickingLanguage}
        onClose={() => setPickingLanguage(false)}
        title="Choose language">
        {languages.map((item) => (
          <Pressable
            key={item.code}
            accessibilityRole="menuitem"
            accessibilityState={{ selected: item.code === language }}
            onPress={() => {
              setLanguage(item.code);
              setPickingLanguage(false);
            }}
            className={`rounded-xl px-3 py-3 ${item.code === language ? 'bg-sky-100' : ''}`}>
            <Text className="text-[16px] leading-6 text-heading">{item.name}</Text>
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}
