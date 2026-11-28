import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { issueCategories } from '@/data/support';
import { EmergencyNotice } from '@/features/profile/EmergencyNotice';
import { useResource } from '@/hooks/useResource';
import { ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatMobile } from '@/lib/validation';
import { useAccount, useSession } from '@/state/SessionState';
import type { ClinicLink, SupportTicket } from '@/types';

const SUBJECT_LIMIT = 120;
const DESCRIPTION_LIMIT = 2000;
const MIN_DESCRIPTION = 20;
const heading = 'font-pj-bd text-[14px] leading-5 text-ink';

export default function SubmitSupportRequest() {
  const params = useLocalSearchParams<{ category?: string; link?: string }>();
  const account = useAccount();
  const { call } = useSession();
  const links = useResource<ClinicLink[]>('/v1/patient/links', ['app_access']);
  const [category, setCategory] = useState<string | null>(issueCategories.some((item) => item.value === params.category) ? params.category! : null);
  const [linkId, setLinkId] = useState<string | null>(params.link ?? null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState('');

  const clinics = links.data ?? [];
  // With one connected clinic there is nothing to choose.
  const chosen = clinics.find((link) => link.id === linkId) ?? (clinics.length === 1 ? clinics[0] : undefined);
  const errors = {
    category: category ? '' : 'Choose the closest topic.',
    clinic: chosen ? '' : 'Choose the clinic to send this to.',
    subject: subject.trim().length >= 3 ? '' : 'Enter a subject.',
    description: description.trim().length >= MIN_DESCRIPTION ? '' : `Describe the issue in at least ${MIN_DESCRIPTION} characters.`,
  };

  const submit = async () => {
    setSubmitted(true);
    setFailure('');
    if (Object.values(errors).some(Boolean) || !chosen) return;
    setSending(true);
    try {
      const ticket = await call<SupportTicket>('/v1/patient/support-tickets', {
        method: 'POST',
        body: { linkId: chosen.id, category, subject: subject.trim(), body: description.trim() },
      });
      router.replace({ pathname: '/profile/help/confirmation', params: { id: ticket.id } });
    } catch (error) {
      setFailure(error instanceof ApiError && error.details.length ? error.details.map((detail) => detail.issue).join(' ') : errorMessage(error));
      setSending(false);
    }
  };

  const fieldError = (message: string) =>
    submitted && message ? (
      <Text accessibilityRole="alert" className="text-[12px] leading-4 text-[#ba1a1a]">
        {message}
      </Text>
    ) : null;

  if (!links.data) {
    return (
      <Screen inTabs header={<AppHeader title="Submit Support Request" />}>
        {links.error ? <ErrorState message={links.error.message} onAction={links.reload} /> : <LoadingState />}
      </Screen>
    );
  }
  if (!clinics.length) {
    return (
      <Screen inTabs header={<AppHeader title="Submit Support Request" />}>
        <EmptyState
          title="No clinic connected yet"
          message="Requests go to a clinic you are connected to. Book a visit, or enter a connection code from your clinic first."
          actionLabel="Connected clinics"
          onAction={() => router.push('/security')}
        />
      </Screen>
    );
  }

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={<AppHeader title="Submit Support Request" subtitle="Your clinic replies here in the app." />}
      footer={
        <View className="gap-2">
          {failure ? (
            <Text accessibilityRole="alert" className="text-[13px] leading-[18px] text-[#ba1a1a]">
              {failure}
            </Text>
          ) : null}
          <Button label="Submit Support Request" loading={sending} onPress={submit} />
        </View>
      }
      contentClassName="gap-4 pt-4 pb-6">
      <View className="gap-1 rounded-2xl border border-line/40 bg-white p-3.5">
        <Text className="font-pj-bd text-[11px] leading-4 text-slate">FROM</Text>
        <Text className="text-[13px] leading-5 text-ink">
          {account?.fullName} · +91 {account ? formatMobile(account.mobile) : ''}
        </Text>
        <Text className="text-[12px] leading-[18px] text-slate">Replies appear in the app, under Your Help Requests and in Notifications.</Text>
      </View>
      <EmergencyNotice />

      <View className="gap-2">
        <Text className={heading}>1. Select Issue Category *</Text>
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap justify-between gap-y-2">
          {issueCategories.map((item) => {
            const active = item.value === category;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => setCategory(item.value)}
                className={cn('min-h-[72px] w-[32%] justify-between gap-1.5 rounded-xl border p-2.5', active ? 'border-teal bg-teal-100' : 'border-line/40 bg-white')}>
                <Icon name={item.icon} size={15} color={active ? '#006a61' : '#4d626a'} />
                <Text className="font-pj-sb text-[11px] leading-[15px] text-ink">{item.value}</Text>
              </Pressable>
            );
          })}
        </View>
        {fieldError(errors.category)}
      </View>

      <View className="gap-2">
        <Text className={heading}>2. Clinic</Text>
        <View accessibilityRole="radiogroup" className="gap-2">
          {clinics.map((link) => {
            const active = link.id === chosen?.id;
            return (
              <Pressable
                key={link.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => setLinkId(link.id)}
                className={cn('flex-row gap-3 rounded-xl border p-3', active ? 'border-teal bg-teal-100' : 'border-line/40 bg-white')}>
                <View className={cn('mt-0.5 size-5 items-center justify-center rounded-full', active ? 'bg-black' : 'border border-line')}>
                  {active ? <View className="size-2 rounded-full bg-white" /> : null}
                </View>
                <View className="flex-1">
                  <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{link.clinicName}</Text>
                  <Text className="text-[12px] leading-[18px] text-slate">
                    {link.homeBranch.name} · for {link.patientName} ({link.mrn})
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {fieldError(errors.clinic)}
      </View>

      <View className="gap-3">
        <Text className={heading}>3. Request Details</Text>
        <TextField
          label="Subject *"
          labelAccessory={<Text className="text-[11px] leading-4 text-slate">{subject.length} / {SUBJECT_LIMIT}</Text>}
          placeholder="Summarise the problem"
          value={subject}
          onChangeText={setSubject}
          maxLength={SUBJECT_LIMIT}
          error={submitted ? errors.subject : ''}
        />
        <TextField
          label="Describe Your Issue *"
          labelAccessory={<Text className="text-[11px] leading-4 text-slate">{description.length} / {DESCRIPTION_LIMIT}</Text>}
          placeholder="What happened, and what did you expect?"
          value={description}
          onChangeText={setDescription}
          maxLength={DESCRIPTION_LIMIT}
          multiline
          inputClassName="min-h-[120px] text-[14px]"
          error={submitted ? errors.description : ''}
        />
      </View>

      <View className="gap-1 rounded-2xl border border-dashed border-line bg-white p-4">
        <Text className={heading}>4. Screenshots & Photos</Text>
        <Text className="text-[12px] leading-[18px] text-slate">Adding attachments is not available yet. Describe what you see in the message instead.</Text>
      </View>
      <Text className="rounded-xl bg-sky-150 p-3 text-[12px] leading-[18px] text-slate">
        Clinic staff will never ask for your sign-in code. Do not include it in your message.
      </Text>
    </Screen>
  );
}
