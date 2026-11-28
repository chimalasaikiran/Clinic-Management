import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/layout/Screen';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { Dock, DockButton, DocHeader, HeaderStatus, Pill, SealedDock, SoftCard, T } from '@/features/consultation/design';
import { PatientBanner } from '@/features/consultation/PatientBanner';
import { FOLLOW_UP_PREFIX, followUpLine, saveEncounter, useActiveEncounter } from '@/features/doctor/clinical';
import { addDays, clock, dayLabel, localToday } from '@/features/reception/desk';
import { ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession } from '@/state/SessionState';
import type { IconName } from '@/theme/icons';

const intervals = [
  { value: '1 week', days: 7 },
  { value: '2 weeks', days: 14 },
  { value: '4 weeks', days: 28 },
  { value: '3 months', days: 91 },
] as const;
const modalities: { value: string; title: string; icon: IconName }[] = [
  { value: 'in clinic', title: 'In-Clinic', icon: 'fu-clinic' },
  { value: 'by phone or video', title: 'Tele-Consult', icon: 'fu-tele' },
];

export default function FollowUp() {
  const toast = useToast();
  const { call, can } = useSession();
  const { encounter, followUp, sealed, reload } = useActiveEncounter();
  const saved = encounter.data ? followUpLine(encounter.data.soap.plan) : null;
  const [indicated, setIndicated] = useState(saved !== 'none');
  const [interval, setInterval] = useState<string>('2 weeks');
  const [modality, setModality] = useState(modalities[0]!.value);
  const [focus, setFocus] = useState('');
  const [saving, setSaving] = useState(false);

  if (!encounter.data) {
    return (
      <Screen className="bg-sky-50" header={<DocHeader title="Follow Up" />} contentClassName="px-4 pt-6">
        {encounter.loading ? <LoadingState label="Opening the consultation…" /> : <EmptyState title="No consultation open" message="Start or resume a consultation from Today's patient list." actionLabel="Open Today" onAction={() => router.replace('/today')} />}
      </Screen>
    );
  }
  const visit = encounter.data;
  const days = intervals.find((item) => item.value === interval)?.days ?? 14;
  const line = indicated ? `${FOLLOW_UP_PREFIX} in ${interval} (around ${dayLabel(addDays(localToday(), days), true)}), ${modality}${focus.trim() ? `. Review: ${focus.trim()}` : ''}.` : `${FOLLOW_UP_PREFIX} not needed.`;

  // The instruction lives on its own line in the plan, replacing any earlier one, so reception can book from it.
  const save = async () => {
    setSaving(true);
    try {
      const rest = visit.soap.plan
        .split('\n')
        .filter((entry) => !entry.startsWith(FOLLOW_UP_PREFIX))
        .join('\n')
        .trim();
      await saveEncounter(call, visit, { plan: [rest, line].filter(Boolean).join('\n') });
      reload();
      toast(indicated ? 'Follow-up added to the plan for reception to book.' : 'Recorded that no follow-up is needed.');
      router.push('/consultation/review');
    } catch (error) {
      toast(error instanceof ApiError && error.code === 'ENCOUNTER_CHANGED' ? 'Someone else saved this note first. Reopen it to see their changes.' : errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      className="bg-sky-50"
      bareFooter
      header={<DocHeader title="Follow Up" below={<HeaderStatus text={`${visit.reference} • ${saved ? 'Follow-up recorded' : 'Not recorded yet'}`} />} />}
      footer={
        sealed ? (
          <SealedDock />
        ) : (
          <Dock>
            <View className="flex-row gap-2">
              <DockButton label="Skip" tone="soft" onPress={() => router.push('/consultation/review')} className="min-h-[48px] bg-sky-150" />
              <DockButton label="Save & Review Encounter" iconRight="arrow-white-sm" loading={saving} onPress={save} className="min-h-[48px] flex-1" />
            </View>
            <T v="kicker" className="text-center text-[#4c4546]">The follow-up goes into the plan. Reception books the slot from it.</T>
          </Dock>
        )
      }
      contentClassName="gap-3.5 px-5 pb-6 pt-1">
      <PatientBanner />

      {followUp ? (
        <SoftCard className="gap-1 rounded-2xl bg-mint">
          <T v="strong" className="text-deep">Already booked</T>
          <T v="body" className="text-deep">{`${dayLabel(followUp.date, true)}, ${clock(followUp.time)} with ${followUp.practitioner.displayName} (${followUp.reference})`}</T>
        </SoftCard>
      ) : null}
      {saved && saved !== 'none' ? (
        <SoftCard className="gap-1 rounded-2xl">
          <T v="kicker">IN THE PLAN NOW</T>
          <T v="body">{saved}</T>
        </SoftCard>
      ) : null}

      {!sealed ? (
        <SoftCard className="gap-3 rounded-2xl">
          <View className="flex-row items-center justify-between gap-2">
            <View className="flex-1 flex-row items-center gap-2">
              <Icon name="fu-next-tile" />
              <T v="heading" className="flex-1">Next Clinical Follow-up</T>
            </View>
            <Pressable accessibilityRole="switch" accessibilityLabel="Follow-up indicated" accessibilityState={{ checked: indicated }} onPress={() => setIndicated(!indicated)}>
              <Pill label={indicated ? 'Indicated' : 'Not needed'} dot="#4d626a" className="bg-sky-100 px-2.5 py-1" textClassName="text-ink" />
            </Pressable>
          </View>
          {indicated ? (
            <>
              <T v="strong" className="text-[#4c4546]">Interval</T>
              <View accessibilityRole="radiogroup" className="flex-row flex-wrap justify-between gap-y-2">
                {intervals.map((item) => {
                  const active = interval === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="radio"
                      accessibilityLabel={`In ${item.value}`}
                      accessibilityState={{ checked: active }}
                      onPress={() => setInterval(item.value)}
                      className={cn('w-[48.7%] justify-center gap-1 rounded-xl p-2.5', active ? 'bg-black' : 'bg-sky-150')}>
                      <View className="flex-row items-center justify-between gap-1">
                        <T v="kicker" className={cn(active && 'text-mint')}>{`In ${item.value}`}</T>
                        {active ? <Icon name="fu-recommended" /> : null}
                      </View>
                      <T v={active ? 'kicker' : 'label'} className={cn(active ? 'text-sky-250' : 'text-[13px]')}>{dayLabel(addDays(localToday(), item.days), true)}</T>
                    </Pressable>
                  );
                })}
              </View>
              <T v="strong" className="text-[#4c4546]">Visit Type</T>
              <View accessibilityRole="radiogroup" className="flex-row gap-2">
                {modalities.map((item) => {
                  const active = modality === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      accessibilityRole="radio"
                      accessibilityLabel={item.title}
                      accessibilityState={{ checked: active }}
                      onPress={() => setModality(item.value)}
                      className={cn('flex-1 flex-row items-center gap-2 rounded-xl p-3', active ? 'bg-sky-200' : 'bg-sky-150')}>
                      <Icon name={item.icon} />
                      <T v="strong" className="flex-1">{item.title}</T>
                      <View className={cn('size-3.5 items-center justify-center rounded-full', active ? 'bg-black' : 'bg-sky-200')}>{active ? <View className="size-1.5 rounded-full bg-white" /> : null}</View>
                    </Pressable>
                  );
                })}
              </View>
              <TextField label="What to review" optionalLabel value={focus} onChangeText={setFocus} placeholder="For example repeat lipid profile, BP log" maxLength={300} />
            </>
          ) : (
            <T v="body">No follow-up visit is needed for this encounter.</T>
          )}
          <View className="rounded-xl bg-sky-100 p-3">
            <T v="kicker">WILL BE SAVED AS</T>
            <T v="body">{line}</T>
          </View>
          {can('bookings.create') ? (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/reception/book', params: { patientId: visit.patientId } })} className="items-center rounded-xl bg-sky-150 py-2.5">
              <T v="strong">Book the Slot Now</T>
            </Pressable>
          ) : (
            <Text className="text-[11px] leading-4 text-slate">Your role cannot book appointments; reception will book from the plan.</Text>
          )}
        </SoftCard>
      ) : null}
    </Screen>
  );
}
