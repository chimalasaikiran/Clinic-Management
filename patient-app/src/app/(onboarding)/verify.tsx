import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingHeader } from '@/components/layout/OnboardingHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { Keypad } from '@/features/onboarding/Keypad';
import { apiRequest, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { deviceDetails } from '@/lib/device';
import { formatMobile } from '@/lib/validation';
import { useOnboarding } from '@/state/OnboardingState';
import { useSession, type SignedIn } from '@/state/SessionState';

const CODE_LENGTH = 6;
/** The server's wait between two codes. */
const RESEND_SECONDS = 30;

type Verified =
  | ({ status: 'signed_in' } & SignedIn)
  | { status: 'registration_required'; registrationToken: string };

export default function VerifyPhone() {
  const toast = useToast();
  const { bottom } = useSafeAreaInsets();
  const { phone, setRegistrationToken } = useOnboarding();
  const { signIn } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (secondsLeft === 0) return;
    const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const edit = (next: string) => {
    setError('');
    setCode(next);
  };

  const resend = async () => {
    edit('');
    try {
      const sent = await apiRequest<{ resendInSeconds: number }>('/v1/patient/auth/otp/request', {
        method: 'POST',
        body: { mobile: phone },
      });
      setSecondsLeft(sent.resendInSeconds);
      toast('A new code was sent by SMS.');
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  const verify = async () => {
    if (code.length < CODE_LENGTH) {
      setError('Enter all 6 digits of the code.');
      return;
    }
    setVerifying(true);
    try {
      const result = await apiRequest<Verified>('/v1/patient/auth/otp/verify', {
        method: 'POST',
        body: { mobile: phone, code, ...deviceDetails() },
      });
      // The server decides: a known number signs in, a new one creates its account.
      if (result.status === 'registration_required') {
        setRegistrationToken(result.registrationToken);
        router.push('/account');
        return;
      }
      await signIn(result);
      router.dismissAll();
      router.replace(result.account.dateOfBirth ? '/home' : '/about-you');
    } catch (failure) {
      setCode('');
      setError(errorMessage(failure));
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <Screen inTabs header={<OnboardingHeader progress={0.6} pill="Step 3 of 5" />}>
        <View className="flex-row items-center gap-3">
          <View className="size-10 items-center justify-center rounded-xl border border-line/40 bg-mint/50">
            <Icon name="mark-email" />
          </View>
          <Text
            accessibilityRole="header"
            className="flex-1 font-pj-bd text-[26px] leading-[34px] tracking-[-0.65px] text-ink">
            Verify your phone
          </Text>
        </View>
        <Text className="pt-4 text-[14px] leading-5 text-body">
          Enter the 6-digit code sent to{' '}
          <Text className="font-pj-sb text-[14px] text-ink">+91 {formatMobile(phone)}</Text>
        </Text>
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          className="flex-row items-center gap-1 self-start pt-1">
          <Icon name="edit-pencil" />
          <Text className="font-pj-sb text-[13px] leading-4 tracking-[0.26px] text-black">
            Edit number
          </Text>
        </Pressable>

        <View
          accessible
          accessibilityLabel={`${code.length} of ${CODE_LENGTH} digits entered`}
          className="flex-row justify-between gap-2 pt-6">
          {Array.from({ length: CODE_LENGTH }, (_, index) => {
            const digit = code[index];
            const focused = index === code.length;
            return (
              <View
                key={index}
                className={cn(
                  'h-14 max-w-[52px] flex-1 items-center justify-center rounded-2xl border-2 bg-white',
                  error ? 'border-[#ba1a1a]' : focused ? 'border-black bg-mint/30' : 'border-line/60',
                )}>
                {digit ? (
                  <Text className="font-pj-bd text-[22px] leading-7 text-ink">{digit}</Text>
                ) : (
                  <View
                    className={
                      focused ? 'h-6 w-0.5 rounded-full bg-black' : 'h-0.5 w-2.5 rounded-full bg-line'
                    }
                  />
                )}
              </View>
            );
          })}
        </View>
        {error ? (
          <Text accessibilityRole="alert" className="pt-2 text-[12px] leading-4 text-[#ba1a1a]">
            {error}
          </Text>
        ) : null}

        <View className="flex-row items-center gap-2 pt-5">
          <Icon name="spinner-ring" />
          {secondsLeft > 0 ? (
            <Text className="flex-1 text-[13px] leading-5 text-body">
              Didn't receive code? Resend via SMS in{' '}
              <Text className="font-pj-bd text-[14px] text-ink">
                00:{String(secondsLeft).padStart(2, '0')}s
              </Text>
            </Text>
          ) : (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={resend}>
              <Text className="font-pj-bd text-[14px] leading-5 text-ink underline">
                Resend code via SMS
              </Text>
            </Pressable>
          )}
        </View>
        <View className="flex-row flex-wrap items-center justify-between gap-2 pt-4">
          <Pressable
            accessibilityRole="button"
            onPress={() => toast('Codes are sent by SMS only for now.')}
            className="flex-row items-center gap-1.5 rounded-full border border-line/30 bg-sky-300/60 px-3 py-[7px]">
            <Icon name="chat" />
            <Text className="font-pj-md text-[13px] leading-4 tracking-[0.26px] text-steel">
              Send code via WhatsApp
            </Text>
          </Pressable>
          <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.55px] text-muted">
            Code expires in 5 min
          </Text>
        </View>

        <View className="mt-5 flex-row items-center gap-2.5 rounded-2xl border border-line/40 bg-sky-50 p-[13px]">
          <View className="size-7 items-center justify-center rounded-full bg-[#e2e2e2]">
            <Icon name="shield-check-circle" />
          </View>
          <Text className="flex-1 text-[13px] leading-4 text-body">
            <Text className="font-pj-sb text-[13px] text-charcoal">Zero-spam guarantee:</Text>{' '}
            Verified clinical communications and medical records access only.
          </Text>
        </View>

        <Button
          label="Verify & Continue"
          iconRight="arrow-forward-white"
          textClassName="font-pj-bd"
          className="mt-5"
          loading={verifying}
          onPress={verify}
        />
      </Screen>
      <View
        className="border-t border-line/30 bg-sky-100/70 px-4 pt-3"
        style={{ paddingBottom: Math.max(bottom, 16) }}>
        <Keypad
          onDigit={(digit) => code.length < CODE_LENGTH && edit(code + digit)}
          onDelete={() => edit(code.slice(0, -1))}
        />
      </View>
    </View>
  );
}
