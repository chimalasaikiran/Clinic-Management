import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { encounterModules } from '@/data/modules';
import { Dock, DockButton, DocHeader, Pill, SealedDock, SoftCard, T, type } from '@/features/consultation/design';
import { useEncounterDigest } from '@/features/consultation/EncounterDigest';
import { PatientBanner } from '@/features/consultation/PatientBanner';
import { useActiveEncounter } from '@/features/doctor/clinical';
import { cn } from '@/lib/cn';
import type { IconName } from '@/theme/icons';

const icons: Record<string, IconName> = {
  notes: 'rv-notes',
  vitals: 'rv-vitals',
  assessment: 'rv-dx',
  prescription: 'rv-meds',
  orders: 'rv-labs',
  referral: 'rv-referral',
  carePlan: 'rv-care',
  followUp: 'rv-followup',
};

export default function ConsultationReview() {
  const { encounter, done, sealed } = useActiveEncounter();
  const content = useEncounterDigest();
  const [attested, setAttested] = useState(false);

  if (!encounter.data) {
    return (
      <Screen className="bg-sky-50" header={<DocHeader title="Consultation Review" />} contentClassName="px-4 pt-6">
        {encounter.loading ? <LoadingState label="Opening the consultation…" /> : <EmptyState title="No consultation open" message="Start or resume a consultation from Today's patient list." actionLabel="Open Today" onAction={() => router.replace('/today')} />}
      </Screen>
    );
  }
  const missing = encounterModules.filter((item) => item.required && !done[item.step] && !(item.step === 'notes' && encounter.data!.chiefComplaint.trim()));
  const recorded = encounterModules.filter((item) => done[item.step]).length;
  const ready = missing.length === 0;
  const checked = attested || sealed;

  return (
    <Screen
      className="bg-sky-50"
      bareFooter
      header={<DocHeader title="Consultation Review" below={<Pill label={`${sealed ? 'SIGNED' : 'IN PROGRESS'} • ${encounter.data.reference}`} dot="#000000" className="bg-mint/60" textClassName="text-deep" />} />}
      footer={
        sealed ? (
          <SealedDock />
        ) : (
          <Dock>
            <View className="flex-row gap-2">
              <DockButton label="Back" tone="soft" iconLeft="rv-edit-details" onPress={() => (router.canGoBack() ? router.back() : router.replace('/patients/workspace'))} className="min-h-[52px]" />
              <DockButton label="Complete Encounter" iconRight="arrow-white-sm" disabled={!ready || !attested} onPress={() => router.push('/consultation/complete')} className="min-h-[52px] flex-1" />
            </View>
          </Dock>
        )
      }
      contentClassName="gap-4 px-5 pb-6 pt-1">
      <PatientBanner />
      <View className={cn('flex-row gap-2 rounded-xl p-4', ready ? 'bg-mint/40' : 'bg-[#fffbeb]')}>
        <Icon name="rv-ready" />
        <View className="flex-1 gap-1">
          <T v="heading" className="text-deep">{ready ? 'Ready to sign' : `${missing.length} required ${missing.length === 1 ? 'step' : 'steps'} left`}</T>
          <T v="body" className="text-[#294d47]">
            {ready
              ? `${recorded} of ${encounterModules.length} sections have entries. The others are optional for this visit.`
              : `Signing needs ${missing.map((item) => item.title.toLowerCase()).join(' and ')}.`}
          </T>
        </View>
      </View>
      <View className="flex-row items-center justify-between gap-2">
        <T v="heading">Encounter Sections</T>
        <T v="strong" className="text-slate">{`${recorded} recorded`}</T>
      </View>
      {encounterModules.map((item) => {
        const isDone = done[item.step];
        return (
          <SoftCard key={item.step} className="gap-2">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-1 flex-row items-center gap-2">
                <Icon name={icons[item.step]!} />
                <T v="heading" className="flex-1">{item.title}</T>
              </View>
              <View className={cn('max-w-[120px] rounded-full px-2 py-0.5', isDone ? 'bg-mint/60' : item.required ? 'bg-[#fffbeb]' : 'bg-sky-200')}>
                <T v="kicker" className={cn('shrink text-center', isDone ? 'text-deep' : item.required ? 'text-[#b45309]' : 'text-slate')}>{isDone ? 'Recorded' : item.required ? 'Required' : 'Not used'}</T>
              </View>
            </View>
            {content[item.step]}
            <Pressable accessibilityRole="link" accessibilityLabel={`Open ${item.title}`} hitSlop={8} onPress={() => router.push(item.route)} className="flex-row items-center gap-1 self-start pt-1">
              <T v="strong" className="text-[#526871]">{sealed ? 'View' : 'Open'}</T>
              <Icon name="rv-arrow" />
            </Pressable>
          </SoftCard>
        );
      })}
      {!sealed ? (
        <SoftCard className="gap-2">
          <View className="flex-row items-center gap-2">
            <Icon name="rv-attest" />
            <T v="heading">Clinical Review Attestation</T>
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="Documentation reviewed"
            accessibilityState={{ checked, disabled: !ready }}
            disabled={!ready}
            onPress={() => setAttested(!attested)}
            className="flex-row gap-3 rounded-lg bg-sky-100 p-3">
            {checked ? <Icon name="rev-attest" /> : <Icon name="rv-unchecked" />}
            <Text className={cn(type.body, 'flex-1 text-ink')}>
              <Text className="font-pj-bd text-[13px] text-ink">I have reviewed the documentation above</Text> and confirm it accurately represents this consultation.
            </Text>
          </Pressable>
        </SoftCard>
      ) : null}
    </Screen>
  );
}
