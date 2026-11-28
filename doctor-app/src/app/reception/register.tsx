import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/layout/Screen';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { localToday, useDay, yearsOld, type Gender, type Patient } from '@/features/reception/desk';
import { ActionButton, Box, Chip, Glyph, IconTile, ProfileButton, ReceptionHeader, type GlyphName } from '@/features/reception/ui';
import { useResource } from '@/hooks/useResource';
import { ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { isEmail, isMobileNumber } from '@/lib/validation';
import { useSession, useSignedIn } from '@/state/SessionState';
import colors from '@/theme/colors';

const TITLES = ['Mr.', 'Mrs.', 'Ms.', 'Master', 'Baby', 'Dr.'] as const;
const GENDERS: { value: Gender; label: string }[] = [
  { value: 'male', label: '♂ Male' },
  { value: 'female', label: '♀ Female' },
  { value: 'other', label: 'Other' },
];
const field = 'border-sky-100 bg-sky-100';

/** DD/MM/YYYY → YYYY-MM-DD, or null unless it is a real date between 1900 and today. */
function birthIso(text: string, today: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text.trim());
  if (!match) return null;
  const [day, month, year] = match.slice(1).map(Number) as [number, number, number];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  const iso = date.toISOString().slice(0, 10);
  return iso >= '1900-01-01' && iso <= today ? iso : null;
}

function Aside({ text }: { text: string }) {
  return <Text className="font-pj-bd text-[11px] leading-4 text-slate">{text}</Text>;
}

function SectionTitle({ icon, title, body, tag }: { icon: GlyphName; title: string; body: string; tag: string }) {
  return (
    <View className="flex-row items-center gap-2.5 border-b border-sky-100 pb-3">
      <IconTile icon={icon} box="bg-sky-100" />
      <View className="flex-1">
        <Text accessibilityRole="header" className="font-pj-bd text-[15px] leading-5 text-ink">
          {title}
        </Text>
        <Text className="text-[11px] leading-4 text-slate">{body}</Text>
      </View>
      <Chip label={tag} tone={tag.startsWith('Required') ? 'steel' : 'sky'} className="self-center" />
    </View>
  );
}

export default function RegisterPatient() {
  const toast = useToast();
  const { call } = useSession();
  const signedIn = useSignedIn();
  const day = useDay();
  const [title, setTitle] = useState<(typeof TITLES)[number] | ''>('');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [birth, setBirth] = useState('');
  const [gender, setGender] = useState<Gender | ''>('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [different, setDifferent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<{ field?: string; message: string } | null>(null);

  const today = day.data?.today ?? localToday();
  const branches = day.data?.branches ?? [];
  const primary = signedIn?.me.staff?.branches.find((entry) => entry.primary)?.id;
  const homeBranch = branches.find((branch) => branch.id === primary) ?? branches[0];

  // Records already registered with this mobile, so the desk opens one instead of making a second.
  const duplicates = useResource<Patient[]>(isMobileNumber(mobile) ? `/v1/patients/duplicates?mobile=${mobile}` : null);
  const matches = duplicates.data ?? [];
  const dateOfBirth = birthIso(birth, today);

  const errors = {
    title: title ? '' : 'Choose a title.',
    name: name.trim().length < 2 ? 'Enter the patient’s full legal name.' : '',
    mobile: !isMobileNumber(mobile) ? 'Enter a 10-digit mobile number.' : matches.length && !different ? 'Open the existing record, or confirm this is a different person.' : '',
    birth: dateOfBirth ? '' : 'Enter a past date as DD/MM/YYYY.',
    gender: gender ? '' : 'Select a gender.',
    pinCode: /^\d{6}$/.test(pinCode) ? '' : 'Enter the 6-digit PIN code.',
    email: email && !isEmail(email) ? 'Enter a valid email address.' : '',
    contact: contactPhone && !isMobileNumber(contactPhone) ? 'Enter a 10-digit number.' : '',
    consent: consent ? '' : 'The patient must agree before a record is created.',
  };
  const valid = Object.values(errors).every((error) => !error) && !!homeBranch;
  const shown = (key: keyof typeof errors, serverField: string = key) => (serverError?.field === serverField ? serverError.message : submitted ? errors[key] : '');

  const create = async () => {
    setSubmitted(true);
    setServerError(null);
    if (!valid || !dateOfBirth || !homeBranch || !gender || !title) {
      toast(homeBranch ? 'Check the highlighted fields.' : 'Your role has no branch to register patients into.');
      return;
    }
    setSaving(true);
    try {
      const patient = await call<Patient>('/v1/patients', {
        method: 'POST',
        body: {
          title,
          fullName: name.trim(),
          mobile,
          dateOfBirth,
          gender,
          pinCode,
          email: email.trim() || null,
          addressLine: address.trim() || null,
          emergencyName: contactName.trim() || null,
          emergencyPhone: contactPhone || null,
          homeBranchId: homeBranch.id,
          confirmedNotDuplicate: different,
        },
      });
      toast(`Patient record ${patient.mrn} created.`);
      router.replace(`/reception/patient/${patient.id}`);
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'POSSIBLE_DUPLICATE') {
        duplicates.reload();
        setServerError({ field: 'mobile', message: failure.message });
      } else {
        const fieldName = failure instanceof ApiError ? failure.details[0]?.field : undefined;
        setServerError({ field: fieldName, message: errorMessage(failure) });
        if (!fieldName) toast(errorMessage(failure));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      className="bg-sky-50"
      header={<ReceptionHeader title="Register New Patient" subtitle={homeBranch?.name ?? 'Front Desk'} subtitleIcon="apartment" right={<ProfileButton initials />} />}
      contentClassName="gap-3 px-4 pt-3 pb-8">
      <View className="flex-row items-center gap-2 rounded-2xl border border-sky-150 bg-white p-3">
        <View className="size-2.5 rounded-full bg-[#10b981]" />
        <Text className="flex-1 font-pj-bd text-[11px] leading-4 text-ink">Duplicate check by mobile number</Text>
      </View>
      <View className="flex-row items-center gap-2 rounded-2xl bg-mint px-3 py-2.5">
        <Glyph name="verified-user" size={14} />
        <Text className="flex-1 font-pj-bd text-[11px] leading-4 text-ink">Administrative record only · No clinical details are collected here</Text>
      </View>

      <Box>
        <SectionTitle icon="badge" title="Required Identity Information" body="What the clinic needs to open a record" tag="Required *" />
        <Text className="font-pj-sb text-[13px] leading-4 text-ink">Title *</Text>
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
          {TITLES.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: title === value }}
              onPress={() => setTitle(value)}
              className={cn('rounded-xl px-3 py-2', title === value ? 'bg-black' : 'bg-sky-100')}>
              <Text className={cn('font-pj-sb text-[13px] leading-[18px]', title === value ? 'text-white' : 'text-ink')}>{value}</Text>
            </Pressable>
          ))}
        </View>
        {shown('title') ? <Text className="text-[12px] leading-4 text-danger">{shown('title')}</Text> : null}
        <TextField
          label="Full Name *"
          leading={<Glyph name="person-outline" size={17} />}
          value={name}
          onChangeText={setName}
          placeholder="As on an ID document"
          autoCapitalize="words"
          maxLength={120}
          boxClassName={field}
          error={shown('name', 'fullName')}
        />
        <TextField
          label="Mobile Number *"
          labelAccessory={isMobileNumber(mobile) && duplicates.data && !matches.length ? <Chip label="No duplicate found" icon="check-circle-outline" tone="mint" /> : undefined}
          leading={<Text className="font-pj-md text-[15px] leading-5 text-ink">🇮🇳 +91</Text>}
          value={mobile}
          onChangeText={(value) => {
            setMobile(value.replace(/\D/g, ''));
            setDifferent(false);
          }}
          placeholder="10-digit mobile"
          keyboardType="number-pad"
          maxLength={10}
          boxClassName={field}
          error={matches.length && !different ? errors.mobile : shown('mobile')}
        />
        {matches.length ? (
          <View className="gap-2 rounded-xl bg-[#fffbeb] p-3">
            <Text className="font-pj-bd text-[12px] leading-4 text-[#b45309]">
              {matches.length === 1 ? 'Already registered with this number' : `${matches.length} records use this number`}
            </Text>
            {matches.map((match) => (
              <Pressable
                key={match.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${match.fullName}`}
                onPress={() => router.push(`/reception/patient/${match.id}`)}
                className="flex-row items-center gap-2 rounded-lg bg-white px-3 py-2">
                <View className="flex-1">
                  <Text className="font-pj-sb text-[13px] leading-[18px] text-ink">{match.fullName}</Text>
                  <Text className="text-[11px] leading-4 text-slate">
                    {match.mrn} · {yearsOld(match.dateOfBirth, today)}Y
                  </Text>
                </View>
                <Glyph name="chevron-right" size={18} color={colors.slate} />
              </Pressable>
            ))}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: different }} onPress={() => setDifferent(!different)} className="flex-row items-center gap-2">
              <Glyph name={different ? 'check-box' : 'check-box-outline-blank'} size={20} color="#000000" />
              <Text className="flex-1 text-[12px] leading-[17px] text-ink">This is a different person (for example a family member sharing the phone)</Text>
            </Pressable>
          </View>
        ) : null}
        <TextField
          label="Date of Birth *"
          value={birth}
          onChangeText={setBirth}
          placeholder="DD/MM/YYYY"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          boxClassName={field}
          error={shown('birth', 'dateOfBirth')}
        />
        <Text className="text-[12px] leading-[17px] text-slate">{dateOfBirth ? `Age: ${yearsOld(dateOfBirth, today)}Y` : 'The patient app uses the date of birth to find this record.'}</Text>
        <Text className="font-pj-sb text-[13px] leading-4 text-ink">Gender *</Text>
        <View accessibilityRole="radiogroup" className="flex-row justify-between gap-2">
          {GENDERS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: gender === option.value }}
              onPress={() => setGender(option.value)}
              className={cn('flex-1 items-center rounded-xl py-3', gender === option.value ? 'bg-black' : 'bg-sky-100')}>
              <Text className={cn('font-pj-sb text-[13px] leading-[18px]', gender === option.value ? 'text-white' : 'text-ink')}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
        {shown('gender') ? <Text className="text-[12px] leading-4 text-danger">{shown('gender')}</Text> : null}
        <TextField
          label="PIN Code *"
          value={pinCode}
          onChangeText={(value) => setPinCode(value.replace(/\D/g, ''))}
          placeholder="6 digits"
          keyboardType="number-pad"
          maxLength={6}
          boxClassName={field}
          error={shown('pinCode')}
        />
      </Box>

      <Box>
        <SectionTitle icon="contact-page" title="Optional Contact Details" body="For appointment notices and emergencies" tag="Optional" />
        <TextField
          label="Email Address"
          labelAccessory={<Aside text="For digital prescriptions" />}
          leading={<Glyph name="mail-outline" size={17} />}
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          boxClassName={field}
          error={shown('email')}
        />
        <TextField
          label="Address"
          labelAccessory={<Aside text="House, street, locality" />}
          leading={<Glyph name="place" size={17} />}
          value={address}
          onChangeText={setAddress}
          maxLength={240}
          boxClassName={field}
          error={serverError?.field === 'addressLine' ? serverError.message : ''}
        />
        <Text className="font-pj-sb text-[13px] leading-4 text-ink">Emergency Contact</Text>
        <View className="flex-row gap-2">
          <TextField accessibilityLabel="Emergency contact name" value={contactName} onChangeText={setContactName} placeholder="Contact name" maxLength={120} boxClassName={field} className="flex-1" inputClassName="text-[14px]" />
          <TextField
            accessibilityLabel="Emergency contact phone"
            value={contactPhone}
            onChangeText={(value) => setContactPhone(value.replace(/\D/g, ''))}
            placeholder="Phone number"
            keyboardType="number-pad"
            maxLength={10}
            boxClassName={field}
            className="flex-1"
            inputClassName="text-[14px]"
            error={shown('contact', 'emergencyPhone')}
          />
        </View>
      </Box>

      <View className="gap-2 rounded-2xl border border-sky-150 bg-sky-100 p-3.5">
        <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">Data Privacy & Consent</Text>
        <Pressable accessibilityRole="checkbox" accessibilityLabel="Patient consent" accessibilityState={{ checked: consent }} onPress={() => setConsent(!consent)} className="flex-row gap-2.5">
          <Glyph name={consent ? 'check-box' : 'check-box-outline-blank'} size={22} color={consent ? '#000000' : colors.slate} />
          <Text className="flex-1 text-[13px] leading-[19px] text-ink">
            The patient has been told how the clinic uses their details and agrees to an administrative record being created.
          </Text>
        </Pressable>
        {shown('consent') ? (
          <Text accessibilityRole="alert" className="text-[12px] leading-4 text-danger">
            {errors.consent}
          </Text>
        ) : null}
      </View>

      <ActionButton large tone="dark" label={saving ? 'Creating…' : 'Create Patient Record'} iconRight="arrow-forward" disabled={saving} onPress={create} />
      <ActionButton large tone="steel" label="Cancel" onPress={() => (router.canGoBack() ? router.back() : router.replace('/reception'))} />
    </Screen>
  );
}
