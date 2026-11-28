import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { goBack } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { apiRequest, ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { deviceName } from '@/lib/device';
import { useSession, type SignedInPayload } from '@/state/SessionState';
import { signInDraft } from '@/state/signInDraft';

const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 30;

export default function VerifyIdentity() {
  const toast = useToast();
  const { signIn } = useSession();
  const params = useLocalSearchParams<{ ticket?: string; sentTo?: string }>();
  const [ticket, setTicket] = useState(params.ticket ?? '');
  const sentTo = params.sentTo ?? 'your mobile';
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(MAX_ATTEMPTS);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const [showCredentials, setShowCredentials] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const remaining = CODE_LENGTH - code.length;

  useEffect(() => {
    if (seconds === 0) return;
    const timer = setTimeout(() => setSeconds(seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  // A new code means signing in again with the same mobile and password; the earlier code stops working.
  const resend = async (channel: 'SMS' | 'WhatsApp') => {
    if (channel === 'WhatsApp') {
      toast('Codes by WhatsApp are not available yet. Use SMS.');
      return;
    }
    const draft = signInDraft.get();
    if (!draft) {
      goBack();
      return;
    }
    try {
      const sent = await apiRequest<{ ticket: string }>('/v1/auth/app/login', { method: 'POST', body: { ...draft, deviceName: deviceName() } });
      setTicket(sent.ticket);
      setCode('');
      setError('');
      setAttempts(MAX_ATTEMPTS);
      setSeconds(RESEND_SECONDS);
      toast('A new code was sent by SMS.');
    } catch (failure) {
      setError(errorMessage(failure));
    }
  };

  const verify = async () => {
    if (remaining > 0) {
      setError(`Enter the remaining ${remaining} digits.`);
      return;
    }
    setVerifying(true);
    try {
      const payload = await apiRequest<SignedInPayload>('/v1/auth/app/verify', { method: 'POST', body: { ticket, code } });
      signInDraft.clear();
      await signIn(payload);
      if (router.canDismiss()) router.dismissAll();
      // The sign-in screen opens the workspace this person's permissions give them.
      router.replace('/');
    } catch (failure) {
      const left = failure instanceof ApiError && failure.code === 'CODE_INVALID' ? attempts - 1 : attempts;
      setAttempts(left);
      setCode('');
      setError(left > 0 ? errorMessage(failure) : 'Too many wrong codes. Ask for a new code, or go back and sign in again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Screen
      header={
        <View className="flex-row items-center justify-between px-5 py-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            onPress={goBack}
            className="w-10">
            <Icon name="arrow-back" />
          </Pressable>
          <View className="flex-row items-center gap-1.5 rounded-full bg-sky-100 px-3 py-1">
            <Icon name="cert-shield" />
            <Text className="font-pj-sb text-[11px] leading-4 text-slate">
              CLINICOS STAFF SIGN-IN
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => toast('Your clinic administrator can help you sign in.')}
            className="flex-row items-center gap-1 rounded-full bg-sky-150 px-3 py-1.5">
            <Icon name="help-circle" size={13} />
            <Text className="font-pj-sb text-[13px] leading-4 text-ink">Help</Text>
          </Pressable>
        </View>
      }
      contentClassName="gap-5 pt-1">
      <View className="gap-2">
        <View className="flex-row items-center gap-1.5 self-start rounded-full bg-mint px-2.5 py-1">
          <View className="size-2 rounded-full bg-sage" />
          <Text className="font-pj-bd text-[11px] leading-[14px] text-deep">
            AUTHORIZED CLINICIAN GATEWAY
          </Text>
        </View>
        <Text accessibilityRole="header" className="font-pj-bd text-[26px] leading-[34px] text-ink">
          Verify Your Identity
        </Text>
        <Text className="text-[14px] leading-5 text-slate">
          A 6-digit cryptographic token has been transmitted to your primary registered terminal
          device.
        </Text>
      </View>

      <View className="gap-2.5 rounded-xl bg-sky-100 p-4">
        <View className="flex-row items-center gap-2">
          <View className="size-9 items-center justify-center rounded-lg bg-sky-150">
            <Icon name="biometric" />
          </View>
          <View className="flex-1">
            <Text className="font-pj-sb text-[11px] leading-4 text-slate">
              REGISTERED CLINICIAN TERMINAL
            </Text>
            <Text className="font-pj-md text-[14px] leading-5 text-ink">
              +91 {sentTo}
            </Text>
          </View>
        </View>
        <View className="flex-row justify-between border-t border-sky-250 pt-2">
          <Text className="text-[13px] leading-[18px] text-slate">Code sent by SMS</Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => toast('Your clinic administrator can update your number.')}>
            <Text className="font-pj-bd text-[11px] leading-[18px] text-slate underline">
              SIM/Number Changed?
            </Text>
          </Pressable>
        </View>
      </View>

      <View className="gap-3">
        <View className="flex-row justify-between gap-2">
          <Text className="font-pj-sb text-[13px] leading-4 text-ink">
            Enter 6-Digit Auth Passcode
          </Text>
          <Text className="font-pj-bd text-[11px] leading-4 text-slate">
            Attempts Remaining: <Text className="font-pj-bd text-[11px] text-ink">{attempts} of {MAX_ATTEMPTS}</Text>
          </Text>
        </View>
        <Pressable onPress={() => input.current?.focus()} className="flex-row justify-between gap-2">
          {Array.from({ length: CODE_LENGTH }, (_, index) => (
            <View
              key={index}
              className={cn(
                'h-14 flex-1 items-center justify-center rounded-xl border bg-white',
                error ? 'border-danger' : index <= code.length ? 'border-black' : 'border-line',
              )}>
              <Text className="font-pj-bd text-[22px] leading-7 text-ink">{code[index] ?? ''}</Text>
            </View>
          ))}
          {/* One hidden field drives the six boxes, so paste and SMS autofill work. */}
          <TextInput
            ref={input}
            accessibilityLabel="6-digit passcode"
            autoFocus
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={CODE_LENGTH}
            editable={attempts > 0}
            value={code}
            onChangeText={(value) => {
              setError('');
              setCode(value.replace(/\D/g, ''));
            }}
            caretHidden
            className="absolute inset-0 opacity-0"
          />
        </Pressable>
        {error ? (
          <Text accessibilityRole="alert" className="text-[12px] leading-4 text-danger">
            {error}
          </Text>
        ) : null}
        <View className="flex-row justify-between px-1">
          <Text className="font-pj-sb text-[13px] leading-4 text-slate">
            {remaining > 0 ? `Awaiting remaining ${remaining} digits...` : 'Passcode complete'}
          </Text>
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setCode('')}>
            <Text className="font-pj-bd text-[11px] leading-4 text-slate underline">Clear</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => toast('SMS autofill appears above the keyboard when a code arrives.')}
          className="flex-row items-center gap-2 rounded-xl bg-sky-200 px-3 py-2.5">
          <Icon name="sms" />
          <Text className="flex-1 font-pj-sb text-[13px] leading-4 text-ink">
            Autofill SMS Code from Messages
          </Text>
          <View className="rounded bg-mint px-1.5 py-0.5">
            <Text className="font-pj-bd text-[11px] leading-4 text-deep">WebOTP</Text>
          </View>
        </Pressable>
        <View className="flex-row items-center justify-between px-1 py-1">
          <View className="flex-row items-center gap-1.5">
            <Icon name="schedule-clock" />
            <Text className="text-[13px] leading-[18px] text-slate">
              Resend code in{' '}
              <Text className="font-pj-bd text-[13px] text-ink">
                00:{String(seconds).padStart(2, '0')}s
              </Text>
            </Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: seconds > 0 }}
              disabled={seconds > 0}
              hitSlop={8}
              onPress={() => resend('SMS')}>
              <Text
                className={cn(
                  'font-pj-sb text-[13px] leading-4',
                  seconds > 0 ? 'text-line' : 'text-ink',
                )}>
                Resend SMS
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => resend('WhatsApp')}>
              <Text className="font-pj-sb text-[13px] leading-4 text-ink">WhatsApp</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View className="rounded-xl bg-white">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showCredentials }}
          onPress={() => setShowCredentials(!showCredentials)}
          className="flex-row items-center gap-2 py-2">
          <Icon name="shield-check" />
          <Text className="flex-1 font-pj-sb text-[13px] leading-4 text-ink">
            Configured Fast-Path Credentials
          </Text>
          <Icon name="chevron-down" />
        </Pressable>
        {showCredentials ? (
          <Text className="pb-2 text-[13px] leading-[18px] text-slate">
            Face ID on this phone and the OPD Chamber 04 workstation key.
          </Text>
        ) : null}
      </View>

      <View className="flex-row gap-2.5 rounded-xl bg-sky-150 p-3.5">
        <Icon name="registry-shield" />
        <View className="flex-1 gap-1">
          <Text className="font-pj-bd text-[11px] leading-4 text-ink">
            ZERO-TRUST CLINICAL SAFEGUARDS
          </Text>
          <Text className="text-[13px] leading-[19px] text-slate">
            5 consecutive invalid attempts will suspend access from this terminal for 15 minutes to
            secure patient electronic health records. Protected by 256-bit Hardware Keystore & ABDM
            Level-M3 protocols.
          </Text>
        </View>
      </View>

      <View className="gap-2">
        <Button
          label="Verify & Enter Workspace"
          iconRight="arrow-right-white"
          className="min-h-[48px] rounded-xl"
          textClassName="font-pj-bd"
          loading={verifying}
          disabled={attempts === 0}
          onPress={verify}
        />
        {[
          ['Contact Clinic Operations Support', () => toast('Call extension 4024 for support.')],
          ['Cancel & Return to Login', goBack],
        ].map(([label, onPress]) => (
          <Pressable
            key={label as string}
            accessibilityRole="button"
            onPress={onPress as () => void}
            className="py-2">
            <Text className="text-center font-pj-sb text-[13px] leading-4 text-slate">
              {label as string}
            </Text>
          </Pressable>
        ))}
      </View>
      <View className="items-center gap-1 py-2">
        <Text className="font-pj-sb text-[11px] leading-4 text-slate">
          NMC & ABDM LEVEL-M3 CERTIFIED • DISHA 2024 COMPLIANT
        </Text>
        <Text className="text-center font-pj-bd text-[11px] leading-4 text-slate">
          ClinicOS Doctor Client v4.12.0 • Security Enclave: #IND-BLR-01
        </Text>
      </View>
    </Screen>
  );
}
