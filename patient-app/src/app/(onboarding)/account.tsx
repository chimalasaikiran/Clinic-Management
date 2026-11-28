import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { OnboardingHeader } from '@/components/layout/OnboardingHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { apiRequest, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { deviceDetails } from '@/lib/device';
import { isEmail, passwordRules } from '@/lib/validation';
import { useOnboarding } from '@/state/OnboardingState';
import { useSession, type SignedIn } from '@/state/SessionState';

const strengthLabels = ['Too weak', 'Weak password', 'Fair password', 'Strong password'];

export default function CreateAccount() {
  const toast = useToast();
  const { registrationToken, setRegistrationToken } = useOnboarding();
  const { signIn } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const rules = passwordRules(password);
  const score = rules.filter((rule) => rule.met).length;
  const errors = {
    name: name.trim().length < 2 ? 'Enter your full legal name.' : '',
    email: isEmail(email) ? '' : 'Enter a valid email address.',
    password: score < rules.length ? 'Your password must meet all three requirements.' : '',
  };

  const submit = async () => {
    setSubmitted(true);
    if (errors.name || errors.email || errors.password) return;
    if (!registrationToken) {
      toast('Verify your mobile number first.');
      router.replace('/phone');
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest<SignedIn>('/v1/patient/auth/register', {
        method: 'POST',
        body: { registrationToken, fullName: name.trim(), email: email.trim(), password, ...deviceDetails() },
      });
      setRegistrationToken(null);
      await signIn(result);
      router.push('/about-you');
    } catch (failure) {
      toast(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<OnboardingHeader progress={0.8} pill="Step 4 of 5" />}
      footer={
        <Button label="Continue to Profile Setup" iconRight="arrow-forward-white" loading={saving} onPress={submit} />
      }>
      <View className="flex-row items-center gap-1.5 self-start rounded-full border border-line/30 bg-mint/60 px-3 py-1">
        <Icon name="shield-outline-teal" />
        <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.27px] text-[#294d47]">
          Patient Portal Setup
        </Text>
      </View>
      <Text
        accessibilityRole="header"
        className="pt-2 font-pj-bd text-[22px] leading-7 tracking-[-0.33px] text-ink">
        Create your secure account
      </Text>
      <Text className="pt-1 text-[14px] leading-[23px] text-body">
        Set up your clinical access credentials to safely view lab reports, prescriptions, and
        physician notes.
      </Text>

      <View className="gap-4 pt-7">
        <TextField
          label="Full Legal Name"
          labelAccessory={
            <View className="flex-row items-center gap-1">
              <Icon name="check-circle-solid" />
              <Text className="font-pj-sb text-[11px] leading-[14px] tracking-[0.55px] text-charcoal">
                Matches official ID
              </Text>
            </View>
          }
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          boxClassName="border-line/60 bg-sky-100"
          inputClassName="font-pj-md"
          trailing={<Icon name="verified-badge" />}
          hint="Verified via Government Health ID linkage."
          error={submitted ? errors.name : ''}
        />
        <TextField
          label="Email Address"
          optionalLabel
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          trailing={<Icon name="mail" />}
          hint="For digital invoices & summary reports"
          error={submitted ? errors.email : ''}
        />
        <View className="gap-2">
          <TextField
            label="Create Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Create a strong password"
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoComplete="new-password"
            autoCorrect={false}
            error={submitted ? errors.password : ''}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={visible ? 'Hide password' : 'Show password'}
                hitSlop={10}
                onPress={() => setVisible(!visible)}>
                <Icon name="eye" />
              </Pressable>
            }
          />
          <View className="flex-row justify-between">
            <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.55px] text-slate">
              Password Strength
            </Text>
            <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.55px] text-charcoal">
              {password ? strengthLabels[score] : ''}
            </Text>
          </View>
          <View className="flex-row gap-1.5">
            {[0, 1, 2, 3].map((bar) => (
              <View
                key={bar}
                className={cn('h-1.5 flex-1 rounded-full', bar < score ? 'bg-black' : 'bg-sky-250')}
              />
            ))}
          </View>
          <View className="gap-2 rounded-xl border border-line/30 bg-sky-100 p-[15px]">
            {rules.map((rule) => (
              <View
                key={rule.label}
                accessible
                accessibilityLabel={`${rule.label}: ${rule.met ? 'met' : 'not met'}`}
                className={cn('flex-row items-center gap-2', !rule.met && 'opacity-40')}>
                <Icon name="check-small" />
                <Text className="font-pj-md text-[13px] leading-[18px] text-charcoal">
                  {rule.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View className="mt-7 flex-row gap-3 rounded-2xl border border-line/40 bg-mint/30 p-[17px]">
        <Icon name="shield-card" />
        <View className="flex-1 gap-0.5">
          <Text className="font-pj-bd text-[13px] leading-4 tracking-[0.26px] text-ink">
            ABDM & ISO 27001 Certified
          </Text>
          <Text className="text-[13px] leading-[21px] text-body">
            Your health data is protected with 256-bit encryption and never shared without your
            consent.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
