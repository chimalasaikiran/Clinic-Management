import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { encounterModules } from '@/data/modules';
import { Dock, DockButton, DocHeader, Pill, SealedDock, SoftCard, T, type } from '@/features/consultation/design';
import { PatientBanner } from '@/features/consultation/PatientBanner';
import { followUpLine, useActiveEncounter } from '@/features/doctor/clinical';
import { dayLabel } from '@/features/reception/desk';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession } from '@/state/SessionState';
import { useStaff } from '@/state/StaffState';

function Digest({ label, value, note, wide }: { label: string; value: string; note?: string; wide?: boolean }) {
  return (
    <View className={cn('gap-0.5 rounded-xl bg-white p-2', wide ? 'w-full' : 'w-[48.7%]')}>
      <T v="kicker">{label}</T>
      <T v="label">{value}</T>
      {note ? <T v="body">{note}</T> : null}
    </View>
  );
}

export default function CompleteEncounter() {
  const toast = useToast();
  const { call } = useSession();
  const { me } = useStaff();
  const { encounter, patient, done, diagnoses, prescriptions, orders, referrals, vitals, followUp, sealed, reload } = useActiveEncounter();
  const [attested, setAttested] = useState(false);
  const [sealing, setSealing] = useState(false);

  if (!encounter.data) {
    return (
      <Screen className="bg-sky-50" header={<DocHeader title="Complete Encounter" />} contentClassName="px-4 pt-6">
        {encounter.loading ? <LoadingState label="Opening the consultation…" /> : <EmptyState title="No consultation open" message="Start or resume a consultation from Today's patient list." actionLabel="Open Today" onAction={() => router.replace('/today')} />}
      </Screen>
    );
  }
  const visit = encounter.data;
  const primary = diagnoses.find((item) => item.status === 'active' && item.designation === 'Primary');
  const ready = !!visit.chiefComplaint.trim() && diagnoses.some((item) => item.status === 'active');
  const checked = attested || sealed;
  const allowed = ready && attested;
  const latest = vitals[0];
  const planned = followUpLine(visit.soap.plan);

  // Signing locks the encounter, files its note and completes the appointment, all on the server.
  const sign = async () => {
    setSealing(true);
    try {
      await call(`/v1/encounters/${visit.id}/sign`, { method: 'POST', body: {} });
      reload();
      toast('Encounter signed.');
      router.replace('/patients/completed');
    } catch (error) {
      toast(errorMessage(error));
      setSealing(false);
    }
  };

  return (
    <Screen
      className="bg-sky-50"
      bareFooter
      header={<DocHeader title="Complete Encounter" chevron below={<Pill label={sealed ? 'SIGNED' : ready ? 'READY TO SIGN' : 'REQUIRED STEPS PENDING'} className="bg-mint" textClassName="text-deep" />} />}
      footer={
        sealed ? (
          <SealedDock />
        ) : (
          <Dock>
            <View className="flex-row gap-2">
              <DockButton label="Review" tone="soft" iconLeft="cm-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/consultation/review'))} className="min-h-[48px] bg-sky-150" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign Encounter"
                accessibilityState={{ disabled: !allowed || sealing, busy: sealing }}
                disabled={!allowed || sealing}
                onPress={sign}
                className={cn('min-h-[48px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl px-3', allowed ? 'bg-black' : 'bg-[#c6c6c6]')}>
                <Icon name="cm-lock" color={allowed ? '#ffffff' : undefined} />
                <T v="subheading" className={allowed ? 'text-white' : 'text-[#474747]'}>{sealing ? 'Signing…' : 'Sign Encounter'}</T>
              </Pressable>
            </View>
          </Dock>
        )
      }
      contentClassName="gap-3.5 px-5 pb-6 pt-1">
      <View className="flex-row gap-2 rounded-xl bg-mint p-4">
        <Icon name="cm-seal" />
        <View className="flex-1">
          <T v="heading" className="text-deep">Sign and Lock</T>
          <T v="body" className="text-[#294d47]">
            Signing locks this encounter, files its clinical note on the chart and marks the visit complete. Corrections afterwards are made as addenda to the note.
          </T>
        </View>
      </View>
      <PatientBanner />
      <View className="gap-2">
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-1 flex-row items-center gap-1">
            <Icon name="cm-audit" />
            <T v="heading" className="flex-1">Sections</T>
          </View>
          <Pill label={`${encounterModules.filter((item) => done[item.step]).length} recorded`} className="self-center bg-sky-300" textClassName="text-[#526871]" />
        </View>
        <View className="gap-1">
          {encounterModules.map((item, index) => (
            <Pressable key={item.step} accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={() => router.push(item.route)} className="flex-row items-center gap-2 rounded-xl bg-white p-2">
              {done[item.step] ? <Icon name="cm-ready" /> : <View className="size-7 rounded-full border-2 border-line" />}
              <View className="flex-1">
                <T v="label">{`${index + 1}. ${item.title}`}</T>
                <T v="body" lines={1}>{done[item.step] ? 'Recorded' : item.required ? 'Required before signing' : 'Not used'}</T>
              </View>
              <T v="kicker">Open</T>
            </Pressable>
          ))}
        </View>
      </View>
      <View className="gap-4 rounded-2xl bg-sky-100 p-5">
        <View className="flex-row items-center gap-1">
          <Icon name="cm-synthesis" />
          <T v="heading">Encounter Summary</T>
        </View>
        <View className="flex-row flex-wrap justify-between gap-y-2">
          <Digest wide label="PRIMARY DIAGNOSIS" value={primary ? `${primary.name} (${primary.icd})` : 'None yet'} />
          <Digest label="VITALS" value={latest ? `BP ${latest.systolic}/${latest.diastolic}` : 'Not recorded'} note={latest ? `Pulse ${latest.pulse} • SpO2 ${latest.spo2}%` : undefined} />
          <Digest label="PRESCRIPTIONS" value={`${prescriptions.length} signed`} note={prescriptions.flatMap((rx) => rx.items.map((item) => item.name)).slice(0, 2).join(', ') || undefined} />
          <Digest label="INVESTIGATIONS" value={`${orders.length} ordered`} />
          <Digest label="REFERRALS" value={`${referrals.length} sent`} />
          <Digest wide label="FOLLOW-UP" value={followUp ? `Booked ${dayLabel(followUp.date, true)}` : planned === 'none' ? 'Not needed' : planned ?? 'Not recorded'} />
        </View>
      </View>
      {!sealed ? (
        <SoftCard className="gap-2 rounded-2xl p-5">
          <T v="kicker">PHYSICIAN ATTESTATION</T>
          <Pressable accessibilityRole="checkbox" accessibilityLabel="I confirm this consultation" accessibilityState={{ checked, disabled: !ready }} disabled={!ready} onPress={() => setAttested(!attested)} className="flex-row gap-4 rounded-xl bg-sky-100 p-2">
            {checked ? <Icon name="rev-attest" /> : <Icon name="cm-unchecked" />}
            <Text className={cn(type.label, 'flex-1 leading-[22px]')}>
              I, <Text className={type.subheading}>{me.name}</Text>, have reviewed the documentation for <Text className={type.subheading}>{patient.data?.fullName ?? 'this patient'}</Text>
              {patient.data ? ` (${patient.data.mrn})` : ''} and confirm it is accurate and ready to sign.
            </Text>
          </Pressable>
          {!ready ? <T v="body" className="text-[#b45309]">Add a chief complaint and at least one diagnosis before signing.</T> : null}
        </SoftCard>
      ) : null}
    </Screen>
  );
}
