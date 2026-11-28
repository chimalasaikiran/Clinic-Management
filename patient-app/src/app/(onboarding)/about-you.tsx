import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Select } from '@/components/form/Select';
import { TextField } from '@/components/form/TextField';
import { OnboardingHeader } from '@/components/layout/OnboardingHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { bloodGroups, months, sexOptions, type Sex } from '@/data/patient';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { ageFromBirthDate, isMobileNumber } from '@/lib/validation';
import { useSession, type Account } from '@/state/SessionState';

const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
const monthOptions = months.map((label, value) => ({ value, label }));
const thisYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 110 }, (_, i) => ({
  value: thisYear - i,
  label: String(thisYear - i),
}));

const sectionLabel = 'font-pj-sb text-[15px] leading-5 tracking-[0.15px] text-heading';
const contactLabel = 'text-[11px] leading-4 tracking-[0.55px] text-slate';
const contactBox = 'min-h-[48px] border-[#dce5e8] bg-[#fbfdfd]';

export default function AboutYou() {
  const toast = useToast();
  const { call, updateAccount } = useSession();
  const [saving, setSaving] = useState(false);
  // Nothing is pre-filled: the date is saved once, cannot be changed here, and clinic records are matched on it.
  const [day, setDay] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const [bloodGroup, setBloodGroup] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [relation, setRelation] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const chosen = day !== null && month !== null && year !== null;
  const age = chosen ? ageFromBirthDate(day, month, year) : null;
  const phoneDigits = contactPhone.replace(/\D/g, '').slice(-10);
  const hasContact = !!(contactName.trim() || contactPhone.trim() || relation.trim());
  const errors = {
    birthDate: !chosen ? 'Choose your date of birth.' : age === null ? 'Choose a real date that is not in the future.' : '',
    sex: sex ? '' : 'Select your biological sex.',
    contactName: hasContact && !contactName.trim() ? 'Enter a contact name.' : '',
    contactPhone: hasContact && !isMobileNumber(phoneDigits) ? 'Enter a valid mobile number.' : '',
  };

  const submit = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean) || !sex || !chosen) return;
    setSaving(true);
    try {
      const two = (value: number) => String(value).padStart(2, '0');
      const account = await call<Account>('/v1/patient/me', {
        method: 'PATCH',
        body: {
          dateOfBirth: `${year}-${two(month + 1)}-${two(day)}`,
          gender: sex.toLowerCase(),
          bloodGroup: bloodGroup && bloodGroup !== "Don't know" ? bloodGroup : null,
          emergencyName: contactName.trim(),
          emergencyRelation: relation.trim(),
          emergencyPhone: hasContact ? phoneDigits : '',
        },
      });
      updateAccount(account);
      router.push('/privacy');
    } catch (failure) {
      toast(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={<OnboardingHeader progress={1} pill="Step 5 of 5" />}
      footer={
        <Button label="Save & Set Permissions" iconRight="arrow-forward-white" loading={saving} onPress={submit} />
      }
      contentClassName="gap-6">
      <View className="gap-2">
        <Text
          accessibilityRole="header"
          className="font-pj-bd text-[26px] leading-[34px] tracking-[-0.65px] text-heading">
          Tell us a bit about you
        </Text>
        <Text className="text-[14px] leading-[23px] text-slate">
          Doctors need this basic clinical info to accurately interpret dosage, lab values, and
          vitals.
        </Text>
      </View>

      <View className="gap-2.5">
        <View className="flex-row items-center justify-between">
          <Text className={sectionLabel}>Date of Birth *</Text>
          {age !== null ? (
            <View className="h-6 flex-row items-center gap-1 rounded-full border border-[#b7ded5] bg-[#eaf5f3] px-2">
              <Icon name="cake" />
              <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.55px] text-black">
                {age} years old
              </Text>
            </View>
          ) : null}
        </View>
        <View className="flex-row gap-2.5">
          <Select label="Day" value={day} options={dayOptions} onChange={setDay} className="w-[76px]" />
          <Select
            label="Month"
            value={month}
            options={monthOptions}
            onChange={setMonth}
            className="flex-1"
          />
          <Select
            label="Year"
            value={year}
            options={yearOptions}
            onChange={setYear}
            className="w-[100px]"
          />
        </View>
        <Text className="text-[13px] leading-[18px] text-slate">
          Check it carefully. Clinic records are matched on it, so it cannot be changed here later.
        </Text>
        {errors.birthDate && (submitted || chosen) ? (
          <Text accessibilityRole="alert" className="text-[12px] leading-4 text-[#ba1a1a]">
            {errors.birthDate}
          </Text>
        ) : null}
      </View>

      <View className="gap-2.5">
        <View className="gap-0.5">
          <Text className={sectionLabel}>Biological Sex *</Text>
          <Text className="text-[13px] leading-[18px] text-slate">
            Required for medical diagnostics & laboratory reference ranges
          </Text>
        </View>
        <View accessibilityRole="radiogroup" className="flex-row gap-2.5">
          {sexOptions.map((option) => {
            const active = sex === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityLabel={option.value}
                accessibilityState={{ checked: active }}
                onPress={() => setSex(option.value)}
                className={cn(
                  'flex-1 gap-1 rounded-xl border-2 p-[14px]',
                  active ? 'border-black bg-[#e6f3f1]' : 'border-[#dce5e8] bg-white',
                )}>
                <View className="flex-row items-center justify-between">
                  <Icon name={option.icon} />
                  <View
                    className={cn(
                      'size-5 items-center justify-center rounded-full',
                      active ? 'bg-black' : 'border border-[#dce5e8] bg-white',
                    )}>
                    {active ? <View className="size-2 rounded-full bg-white" /> : null}
                  </View>
                </View>
                <Text
                  className={cn(
                    'text-[15px] leading-5 tracking-[0.15px]',
                    active ? 'font-pj-bd text-heading' : 'font-pj-sb text-slate',
                  )}>
                  {option.value}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {submitted && errors.sex ? (
          <Text accessibilityRole="alert" className="text-[12px] leading-4 text-[#ba1a1a]">
            {errors.sex}
          </Text>
        ) : null}
      </View>

      <View className="gap-2.5">
        <View className="flex-row justify-between">
          <Text className={sectionLabel}>Blood Group</Text>
          <Text className="text-[13px] leading-[18px] text-slate">(Optional)</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2">
          {bloodGroups.map((group) => {
            const active = bloodGroup === group;
            return (
              <Pressable
                key={group}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setBloodGroup(active ? null : group)}
                className={cn(
                  'h-9 min-w-[48px] items-center justify-center rounded-full border px-4',
                  active ? 'border-black bg-black' : 'border-[#dce5e8] bg-white',
                )}>
                <Text
                  className={cn(
                    'font-pj-sb text-[13px] leading-4 tracking-[0.26px]',
                    active ? 'text-white' : 'text-slate',
                  )}>
                  {group}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View className="gap-3">
        <Text className={sectionLabel}>
          Emergency Contact <Text className="text-[13px] text-slate">(Optional)</Text>
        </Text>
        <View className="gap-3 rounded-2xl border border-[#dce5e8] bg-white p-[17px]">
          <View className="flex-row gap-2.5">
            <TextField
              className="flex-1"
              label="CONTACT NAME"
              labelClassName={contactLabel}
              boxClassName={contactBox}
              placeholder="Full name"
              autoCapitalize="words"
              value={contactName}
              onChangeText={setContactName}
              error={submitted ? errors.contactName : ''}
            />
            <TextField
              className="w-[112px]"
              label="RELATION"
              labelClassName={contactLabel}
              boxClassName={contactBox}
              placeholder="Spouse"
              autoCapitalize="words"
              value={relation}
              onChangeText={setRelation}
            />
          </View>
          <TextField
            label="EMERGENCY PHONE"
            labelClassName={contactLabel}
            boxClassName={contactBox}
            placeholder="+91 98450 12345"
            keyboardType="phone-pad"
            value={contactPhone}
            onChangeText={setContactPhone}
            leading={<Text className="text-[13px]">🇮🇳</Text>}
            trailing={<Icon name="phone" />}
            error={submitted ? errors.contactPhone : ''}
          />
        </View>
      </View>

      <View className="flex-row gap-3 rounded-xl border border-[#b7ded5] bg-[#e6f3f1] p-[15px]">
        <Icon name="shield-heart" />
        <Text className="flex-1 text-[13px] leading-[18px] text-[#294d47]">
          This information remains strictly confidential between you and your licensed consulting
          physicians.
        </Text>
      </View>
    </Screen>
  );
}
