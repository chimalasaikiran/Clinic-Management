import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { AppHeader, goBack } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { sexOptions, type Sex } from '@/data/patient';
import { Avatar } from '@/features/profile/Avatar';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';
import { ageOn, longDate } from '@/lib/dates';
import { formatMobile, isEmail } from '@/lib/validation';
import { useAccount, useSession, type Account } from '@/state/SessionState';

const card = 'gap-3 rounded-2xl border border-line/40 bg-white p-4';
const sectionTitle = 'font-pj-bd text-[16px] leading-6 text-ink';

type Draft = {
  firstName: string;
  lastName: string;
  email: string;
  sex: Sex | null;
  street: string;
  city: string;
  state: string;
  pin: string;
};

const sexByGender = { female: 'Female', male: 'Male', other: 'Other' } as const;

function draftOf(account: Account | null): Draft {
  const parts = (account?.fullName ?? '').trim().split(/\s+/);
  return {
    firstName: parts.slice(0, parts.length > 1 ? -1 : 1).join(' '),
    lastName: parts.length > 1 ? parts[parts.length - 1] : '',
    email: account?.email ?? '',
    sex: account?.gender ? sexByGender[account.gender] : null,
    street: account?.addressLine ?? '',
    city: account?.city ?? '',
    state: account?.state ?? '',
    pin: account?.pinCode ?? '',
  };
}

export default function EditProfile() {
  const toast = useToast();
  const account = useAccount();
  const { call, updateAccount } = useSession();
  const [draft, setDraft] = useState(() => draftOf(account));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = <Key extends keyof Draft>(key: Key, value: Draft[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  // The address is optional, but a PIN code, once typed, must be complete.
  const errors = {
    firstName: draft.firstName.trim() ? '' : 'Enter your first name.',
    lastName: '',
    email: isEmail(draft.email) ? '' : 'Enter a valid email address.',
    street: '',
    city: '',
    state: '',
    pin: !draft.pin || /^[1-9]\d{5}$/.test(draft.pin) ? '' : 'Enter a 6-digit PIN code.',
  };
  const shown = (key: keyof typeof errors) => (submitted ? errors[key] : '');

  const submit = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      toast('Check the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      const saved = await call<Account>('/v1/patient/me', {
        method: 'PATCH',
        body: {
          fullName: `${draft.firstName.trim()} ${draft.lastName.trim()}`.trim(),
          email: draft.email.trim(),
          ...(draft.sex ? { gender: draft.sex.toLowerCase() } : {}),
          addressLine: draft.street.trim(),
          city: draft.city.trim(),
          state: draft.state.trim(),
          pinCode: draft.pin,
        },
      });
      updateAccount(saved);
      toast('Profile updated.');
      goBack();
    } catch (failure) {
      toast(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <AppHeader
          title="Edit Profile"
          subtitle={account?.fullName}
          right={
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setDraft(draftOf(account));
                setSubmitted(false);
              }}
              className="px-2">
              <Text className="font-pj-sb text-[13px] leading-4 text-slate">Reset</Text>
            </Pressable>
          }
        />
      }
      footer={
        <View className="gap-1.5">
          <View className="flex-row gap-2.5">
            <Button label="Cancel" variant="outline" onPress={goBack} />
            <Button label="Save Changes" className="flex-1" loading={saving} onPress={submit} />
          </View>
          <Text className="text-center text-[11px] leading-4 text-slate">
            Changes to your profile are logged
          </Text>
        </View>
      }
      contentClassName="gap-4 pt-4 pb-6">
      <View className={cn(card, 'items-center')}>
        <Avatar
          photoUri={null}
          initials={`${draft.firstName[0] ?? ''}${draft.lastName[0] ?? ''}`}
          size={80}
        />
        <View className="flex-row gap-2">
          <Button
            label="Change Photo"
            variant="soft"
            size="sm"
            onPress={() => toast('Profile photos are not available yet.')}
          />
          <Button label="Remove" variant="outline" size="sm" disabled />
        </View>
        <Text className="text-center text-[12px] leading-[18px] text-slate">
          Your initials are shown until photos are available
        </Text>
      </View>

      <View className={card}>
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-1">
            <Text className="font-pj-bd text-[11px] leading-4 text-slate">
              NATIONAL HEALTH ID (ABHA)
            </Text>
            <Text className="font-pj-bd text-[16px] leading-6 text-ink">Not linked</Text>
          </View>
        </View>
        <Text className="text-[12px] leading-[18px] text-slate">
          ABHA linking is not available yet.
        </Text>
      </View>

      <View className={card}>
        <View className="flex-row justify-between">
          <Text className={sectionTitle}>Personal Details</Text>
          <Text className="text-[12px] leading-6 text-slate">Demographics</Text>
        </View>
        <View className="flex-row gap-2.5">
          <TextField
            className="flex-1"
            label="First Name"
            value={draft.firstName}
            onChangeText={(value) => set('firstName', value)}
            error={shown('firstName')}
          />
          <TextField
            className="flex-1"
            label="Last Name"
            value={draft.lastName}
            onChangeText={(value) => set('lastName', value)}
            error={shown('lastName')}
          />
        </View>
        <View className="gap-1.5">
          <View className="flex-row justify-between">
            <Text className="font-pj-sb text-[13px] leading-4 text-ink">Date of Birth</Text>
            <Text className="text-[11px] leading-4 text-slate">Ask your clinic to correct it</Text>
          </View>
          <View className="min-h-[52px] flex-row items-center justify-between rounded-xl border border-line/60 bg-sky-100 px-4">
            <Text className="text-[16px] leading-6 text-ink">
              {account?.dateOfBirth ? longDate(account.dateOfBirth) : 'Not added'}
            </Text>
            {account?.dateOfBirth ? (
              <Text className="text-[12px] leading-4 text-slate">{ageOn(account.dateOfBirth)} years old</Text>
            ) : null}
          </View>
        </View>
        <View className="gap-1.5">
          <Text className="font-pj-sb text-[13px] leading-4 text-ink">Biological Sex</Text>
          <View accessibilityRole="radiogroup" className="flex-row rounded-xl bg-sky-100 p-1">
            {sexOptions.map((option) => {
              const active = draft.sex === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => set('sex', option.value)}
                  className={cn('flex-1 items-center rounded-lg py-2', active && 'bg-white')}>
                  <Text
                    className={cn(
                      'text-[13px] leading-4',
                      active ? 'font-pj-bd text-ink' : 'text-slate',
                    )}>
                    {option.value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="text-[12px] leading-4 text-slate">
            Required for laboratory reference ranges
          </Text>
        </View>
        <View className="flex-row items-center justify-between rounded-xl border border-line/60 bg-sky-100 px-4 py-3">
          <Text className="text-[14px] leading-5 text-ink">
            Blood Group · {account?.bloodGroup ?? 'Not added'}
          </Text>
          {account?.bloodGroup ? <Pill label="Self-reported" icon="lock-teal-sm" /> : null}
        </View>
      </View>

      <View className={card}>
        <View className="flex-row justify-between">
          <Text className={sectionTitle}>Contact Information</Text>
          <Text className="text-[12px] leading-6 text-slate">Communication</Text>
        </View>
        <View className="gap-2 rounded-xl border border-line/40 p-3">
          <View className="flex-row items-center justify-between">
            <Text className="font-pj-bd text-[11px] leading-4 text-slate">
              PRIMARY REGISTERED MOBILE
            </Text>
            <Pill label="ACTIVE" />
          </View>
          <View className="flex-row items-center justify-between">
            <Text className="font-pj-bd text-[16px] leading-6 text-ink">
              +91 {formatMobile(account?.mobile ?? '')}
            </Text>
            <Pressable
              accessibilityRole="link"
              hitSlop={8}
              onPress={() => router.push('/profile/help/request')}>
              <Text className="font-pj-sb text-[13px] text-ink">Change →</Text>
            </Pressable>
          </View>
          <Text className="rounded-lg bg-sky-100 p-2.5 text-[12px] leading-[18px] text-slate">
            This number signs you in. Changing it in the app is not available yet.
          </Text>
        </View>
        <TextField
          label="Email Address"
          value={draft.email}
          onChangeText={(value) => set('email', value)}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          trailing={<Icon name="edit-pencil" />}
          error={shown('email')}
        />
      </View>

      <View className={card}>
        <View className="flex-row justify-between">
          <Text className={sectionTitle}>Residential Address</Text>
          <Text className="text-[12px] leading-6 text-slate">Home Location</Text>
        </View>
        <TextField
          label="Street Address"
          value={draft.street}
          onChangeText={(value) => set('street', value)}
          error={shown('street')}
        />
        <View className="flex-row gap-2.5">
          <TextField
            className="flex-1"
            label="City"
            value={draft.city}
            onChangeText={(value) => set('city', value)}
            error={shown('city')}
          />
          <TextField
            className="flex-1"
            label="State"
            value={draft.state}
            onChangeText={(value) => set('state', value)}
            error={shown('state')}
          />
        </View>
        <TextField
          label="PIN Code"
          value={draft.pin}
          onChangeText={(value) => set('pin', value.replace(/\D/g, ''))}
          keyboardType="number-pad"
          maxLength={6}
          trailing={<Icon name="pin-slate" />}
          error={shown('pin')}
        />
      </View>

      <View className="gap-1 rounded-2xl border border-teal-200 bg-teal-100 p-4">
        <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">
          Statutory Clinical Data Integrity
        </Text>
        <Text className="text-[12px] leading-[18px] text-slate">
          Profile modifications apply strictly to your contact and demographic card. Doctor-signed
          medical records (prescriptions, consultation notes, diagnostic reports, and care plans)
          are kept by your clinic and cannot be edited here.
        </Text>
      </View>
    </Screen>
  );
}
