import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { OnboardingHeader } from '@/components/layout/OnboardingHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { Keypad } from '@/features/onboarding/Keypad';
import { apiRequest, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatMobile, isMobileNumber } from '@/lib/validation';
import { useOnboarding } from '@/state/OnboardingState';

function IndiaFlag() {
  return (
    <View className="h-3.5 w-5 overflow-hidden rounded-sm border border-line/40">
      <View className="flex-1 bg-[#ff9933]" />
      <View className="flex-1 items-center justify-center bg-white">
        <View className="size-1 rounded-full bg-[#000080]" />
      </View>
      <View className="flex-1 bg-[#138808]" />
    </View>
  );
}

export default function MobileNumber() {
  const toast = useToast();
  const { phone, setPhone, mode } = useOnboarding();
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const edit = (next: string) => {
    setError('');
    setPhone(next);
  };

  const send = async () => {
    if (!isMobileNumber(phone)) {
      setError('Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.');
      return;
    }
    setSending(true);
    try {
      await apiRequest('/v1/patient/auth/otp/request', { method: 'POST', body: { mobile: phone } });
      router.push('/verify');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      className="bg-sky-50"
      header={
        <OnboardingHeader progress={0.4} caption={mode === 'signup' ? 'Step 2 of 5' : 'Sign in'} />
      }
      footer={
        <View className="gap-2.5">
          <Button
            label="Send Verification Code"
            iconRight="arrow-forward-white"
            loading={sending}
            onPress={send}
          />
          <Text className="px-2 text-center text-[13px] leading-[18px] text-slate">
            By continuing, you agree to our{' '}
            <Text
              className="font-pj-md text-[13px] text-black"
              onPress={() => toast('The Terms of Care document is not available yet.')}>
              Terms of Care
            </Text>{' '}
            and{' '}
            <Text
              className="font-pj-md text-[13px] text-black"
              onPress={() => toast('The Privacy Policy is not available yet.')}>
              Privacy Policy
            </Text>
            .
          </Text>
          <View className="rounded-2xl border border-line/30 bg-sky-150/40 p-2.5">
            <Keypad
              onDigit={(digit) => phone.length < 10 && edit(phone + digit)}
              onDelete={() => edit(phone.slice(0, -1))}
            />
          </View>
        </View>
      }>
      <View className="flex-row items-center gap-1.5 self-start rounded-full bg-sky-150 px-2.5 py-1">
        <Icon name="shield-solid" />
        <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.27px] text-black">
          Secure ABDM Gateway
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        className="pt-3 font-pj-bd text-[26px] leading-[34px] tracking-[-0.65px] text-ink">
        Enter your mobile number
      </Text>
      <Text className="pt-2 text-[14px] leading-[23px] text-slate">
        We will send a 6-digit one-time verification code to verify your phone number and secure
        your health records.
      </Text>

      <View className="mt-6 gap-2 rounded-2xl border border-line/50 bg-white p-[17px]">
        <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.27px] text-slate">
          PRIMARY MOBILE PHONE
        </Text>
        <View className="flex-row gap-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Country code +91, India"
            onPress={() => toast('Only Indian mobile numbers are supported right now.')}
            className="h-[52px] flex-row items-center gap-1.5 rounded-xl border border-line/70 bg-sky-100 px-3">
            <IndiaFlag />
            <Text className="font-pj-sb text-[16px] leading-6 text-ink">+91</Text>
            <Icon name="chevron-down" />
          </Pressable>
          <View
            className={cn(
              'h-[52px] flex-1 flex-row items-center rounded-xl border-2 bg-white px-3',
              error ? 'border-[#ba1a1a]' : 'border-black',
            )}>
            <Text
              accessibilityLabel={`Mobile number ${phone || 'empty'}`}
              numberOfLines={1}
              className={cn(
                'font-pj-md text-[18px] leading-6 tracking-[0.45px]',
                phone ? 'text-ink' : 'text-line',
              )}>
              {phone ? formatMobile(phone) : '98765 43210'}
            </Text>
            {phone ? <View className="ml-0.5 h-6 w-0.5 bg-black" /> : null}
            <View className="flex-1" />
            {phone ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear number"
                hitSlop={10}
                onPress={() => edit('')}>
                <Icon name="cancel-circle" />
              </Pressable>
            ) : null}
          </View>
        </View>
        {error ? (
          <Text accessibilityRole="alert" className="text-[12px] leading-4 text-[#ba1a1a]">
            {error}
          </Text>
        ) : null}
        <View className="flex-row gap-2 border-t border-line/30 pt-3">
          <Icon name="verified-solid" />
          <Text className="flex-1 text-[13px] leading-4 text-body">
            Your number is securely linked to your official health registry (ABHA/ABDM).
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row items-center gap-3 rounded-xl border border-line/30 bg-sky-100/70 p-[13px]">
        <View className="size-9 items-center justify-center rounded-lg border border-line/40 bg-sky-50">
          <Icon name="lock" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="font-pj-sb text-[13px] leading-4 tracking-[0.26px] text-ink">
            Zero-Spam Guarantee
          </Text>
          <Text className="text-[13px] leading-4 text-slate">
            Encrypted strictly for verified doctor visits and prescriptions.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
