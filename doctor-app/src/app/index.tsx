import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { apiRequest, ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { deviceName } from '@/lib/device';
import { isMobileNumber } from '@/lib/validation';
import { homeOf } from '@/data/staff';
import { useSession } from '@/state/SessionState';
import { signInDraft } from '@/state/signInDraft';
import type { IconName } from '@/theme/icons';

type Method = 'password' | 'otp';

const methods: { value: Method; label: string; icon: IconName }[] = [
  { value: 'password', label: 'Password Login', icon: 'key' },
  { value: 'otp', label: 'One-Time Passcode', icon: 'sms' },
];


const fieldLabel = 'font-pj-sb text-[13px] leading-4 text-ink';

export default function SignIn() {
  const toast = useToast();
  const [method, setMethod] = useState<Method>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState({ phone: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const { session } = useSession();

  const unavailable = (what: string) => toast(`${what} is not available yet.`);

  // Signed in already: open the workspace the server's permissions give this person.
  if (session.status === 'signedIn') {
    return <Redirect href={session.workspace ? homeOf[session.workspace] : '/no-workspace'} />;
  }

  const submit = async () => {
    const digits = phone.replace(/\D/g, '');
    if (method === 'otp') {
      setErrors({ phone: '', password: 'Signing in with only a code is not available yet. Use your password.' });
      return;
    }
    const next = {
      phone: isMobileNumber(digits) ? '' : 'Enter your 10-digit registered mobile number.',
      password: password ? '' : 'Enter your password.',
    };
    setErrors(next);
    if (next.phone || next.password) return;
    setLoading(true);
    try {
      const sent = await apiRequest<{ ticket: string; sentTo: string }>('/v1/auth/app/login', {
        method: 'POST',
        body: { mobile: digits, password, deviceName: deviceName() },
      });
      signInDraft.set({ mobile: digits, password });
      router.push({ pathname: '/verify', params: { ticket: sent.ticket, sentTo: sent.sentTo } });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : '';
      if (code === 'TOO_MANY_REQUESTS' || (error instanceof ApiError && error.status === 429)) {
        setLocked(true);
        setErrors({ phone: '', password: 'Too many attempts. Wait 15 minutes, then try again.' });
      } else if (code === 'MOBILE_SHARED') {
        setErrors({ phone: errorMessage(error), password: '' });
      } else {
        setErrors({ phone: '', password: errorMessage(error) });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen className="bg-sky-50" contentClassName="gap-5">
      <View className="flex-row items-center gap-1.5 self-center rounded-full bg-sky-100 px-3 py-1">
        <View className="size-2 rounded-full bg-sage" />
        <Icon name="portal-shield" />
        <Text className="font-pj-bd text-[11px] leading-[14px] text-slate">
          AUTHORIZED CLINICIAN PORTAL
        </Text>
      </View>

      <View className="items-center gap-2">
        <View className="size-14 items-center justify-center rounded-2xl bg-deep">
          <Icon name="brand-logo" />
          <View className="absolute -bottom-1 -right-1 size-4 items-center justify-center rounded-full bg-mint">
            <Icon name="brand-dot" />
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="font-pj-bd text-[26px] leading-[34px] text-ink">
            Clinic<Text className="font-pj-bd text-[26px] text-slate">OS</Text>
          </Text>
          <View className="rounded-full bg-sky-150 px-2 py-0.5">
            <Text className="font-pj-bd text-[11px] leading-4 text-slate">Doctor Workspace</Text>
          </View>
        </View>
        <View className="items-center gap-0.5">
          <Text accessibilityRole="header" className="font-pj-sb text-[22px] leading-7 text-ink">
            Welcome Back
          </Text>
          <Text className="text-center text-[14px] leading-5 text-slate">
            Sign in to access your clinical workspace.
          </Text>
        </View>
      </View>

      <View className="flex-row gap-2.5 rounded-2xl bg-sky-100 p-3.5">
        <Icon name="provisioned" />
        <View className="flex-1 gap-1">
          <Text className="text-[13px] leading-[19px] text-[#4c4546]">
            Your Clinic OS account is provisioned directly by your clinic administrator. Public
            registration is restricted to verified healthcare establishments.
          </Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => unavailable('Contacting the administrator from here')}
            className="flex-row items-center gap-1 self-start">
            <Text className="font-pj-sb text-[11px] leading-4 text-deep">
              Contact Administrator
            </Text>
            <Icon name="link-arrow" />
          </Pressable>
        </View>
      </View>

      <View accessibilityRole="tablist" className="flex-row gap-1 rounded-2xl bg-sky-150 p-1">
        {methods.map((item) => {
          const active = method === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => {
                setMethod(item.value);
                setErrors({ phone: '', password: '' });
              }}
              className={cn(
                'flex-1 flex-row items-center justify-center gap-1.5 rounded-xl py-2',
                active && 'bg-white',
              )}>
              <Icon name={item.icon} />
              <Text
                className={cn('font-pj-sb text-[13px] leading-4', active ? 'text-ink' : 'text-slate')}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View className="gap-4">
        <View className="gap-1.5">
          <TextField
            label="Registered Mobile Number *"
            labelClassName={fieldLabel}
            labelAccessory={null}
            boxClassName="rounded-2xl border-line/30 bg-white"
            placeholder="98765 43210"
            keyboardType="number-pad"
            maxLength={11}
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
            leading={
              <View className="flex-row items-center gap-1.5 border-r border-line/30 pr-2">
                <Text className="text-[18px]">🇮🇳</Text>
                <Text className="font-pj-sb text-[13px] text-ink">+91</Text>
                <Icon name="caret" />
              </View>
            }
            trailing={
              isMobileNumber(phone.replace(/\D/g, '')) ? <Icon name="field-check" /> : null
            }
          />
          <View className="flex-row items-center gap-1">
            <Icon name="registry-shield" />
            <Text className="flex-1 font-pj-bd text-[11px] leading-4 text-slate">
              Secured via ABDM & NMC verified physician registry
            </Text>
          </View>
        </View>

        {method === 'password' ? (
          <View className="gap-3">
            <TextField
              label="Clinician Password *"
              labelClassName={fieldLabel}
              labelAccessory={
                <Pressable
                  accessibilityRole="link"
                  hitSlop={8}
                  onPress={() => toast('Your clinic administrator can reset your password.')}>
                  <Text className="font-pj-bd text-[11px] leading-4 text-slate">
                    Reset Instructions
                  </Text>
                </Pressable>
              }
              boxClassName="rounded-2xl border-line/30 bg-white"
              placeholder="Your password"
              secureTextEntry={!visible}
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              error={errors.password}
              leading={<Icon name="field-lock" />}
              trailing={
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={visible ? 'Hide password' : 'Show password'}
                  hitSlop={8}
                  onPress={() => setVisible(!visible)}>
                  <Icon name="password-eye" />
                </Pressable>
              }
            />
            <View className="flex-row items-center justify-between gap-3">
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: remember }}
                accessibilityLabel="Remember this terminal for 30 days"
                onPress={() => setRemember(!remember)}
                className="flex-1 flex-row items-center gap-2">
                <View
                  className={cn(
                    'size-4 items-center justify-center rounded-[3px]',
                    remember ? 'bg-black' : 'border border-line bg-white',
                  )}>
                  {remember ? <Icon name="check-white" size={9} /> : null}
                </View>
                <Text className="text-[13px] leading-[18px] text-ink">
                  Remember this terminal (30 days)
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                hitSlop={8}
                onPress={() => toast('Your clinic administrator can reset your password.')}>
                <Text className="font-pj-bd text-[11px] leading-4 text-slate underline">
                  Forgot Password?
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text className="text-[13px] leading-[19px] text-slate">
            We will send a 6-digit one-time passcode to your registered number.
          </Text>
        )}

        <Button
          label={method === 'password' ? 'Sign In to Workspace' : 'Send One-Time Passcode'}
          iconRight="arrow-right-white"
          loading={loading}
          disabled={locked}
          onPress={submit}
        />
        <Text className="text-center font-pj-bd text-[11px] leading-4 text-slate">
          5 consecutive failed attempts will temporarily lock your terminal for 15 minutes.
        </Text>
      </View>

      <View className="flex-row items-center gap-3 rounded-2xl bg-sky-150 p-3.5">
        <View className="rounded-xl bg-white p-2.5">
          <Icon name="biometric" />
        </View>
        <View className="flex-1">
          <Text className="font-pj-sb text-[13px] leading-4 text-ink">Biometric Touch / Face ID</Text>
          <Text className="text-[13px] leading-[18px] text-slate">
            Quick clinical unlock for Dr. Rao
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => unavailable('Biometric unlock')}
          className="rounded-xl bg-black px-3 py-1.5">
          <Text className="font-pj-bd text-[11px] leading-4 text-white">Unlock</Text>
        </Pressable>
      </View>

      <View className="gap-2 rounded-2xl bg-white p-3.5">
        <View className="flex-row items-center justify-between">
          <Text className="font-pj-sb text-[11px] leading-4 text-slate">
            STATUTORY CERTIFICATION
          </Text>
          <View className="rounded-full bg-sky-100 px-2 py-0.5">
            <Text className="font-pj-bd text-[11px] leading-4 text-deep">ABDM LEVEL-M3</Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          <Icon name="cert-shield" />
          <Text className="flex-1 text-[13px] leading-[18px] text-slate">
            Zero-trust EMR session · Multi-factor authorized · 256-bit AES cryptographic keystore
          </Text>
        </View>
        <View className="flex-row justify-between border-t border-line/30 pt-3">
          <Text className="font-pj-bd text-[11px] leading-4 text-slate">
            NMC Physician Registry v2.8
          </Text>
          <Text className="font-pj-sb text-[11px] leading-4 text-ink">DISHA 2024 COMPLIANT</Text>
        </View>
      </View>

      <View className="items-center gap-2 py-2">
        <View className="flex-row gap-3">
          {['Privacy Policy', 'Terms of Clinical Care', 'Help Desk'].map((link) => (
            <Pressable
              key={link}
              accessibilityRole="link"
              hitSlop={8}
              onPress={() => unavailable(link)}>
              <Text className="font-pj-bd text-[11px] leading-4 text-slate">{link}</Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-center font-pj-bd text-[11px] leading-4 text-slate/70">
          Clinic OS Doctor Client v4.12.0 (Build 8920) · Node: #IND-BLR-01
        </Text>
      </View>
    </Screen>
  );
}
