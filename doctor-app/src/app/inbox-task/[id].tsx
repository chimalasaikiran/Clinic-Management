import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Choice } from '@/components/ui/Kit';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { Dock, DockButton, DocHeader, Pill, SoftCard, T } from '@/features/consultation/design';
import { ALERT_DISPOSITIONS, usePatient, type ClinicalAlert } from '@/features/doctor/clinical';
import { ageSex, clock, dayLabel, localToday, phone, telOf } from '@/features/reception/desk';
import { useDial } from '@/features/reception/ui';
import { useResource } from '@/hooks/useResource';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession } from '@/state/SessionState';

const SEVERITY = {
  critical: { box: 'bg-[#ffdad6]', text: 'text-[#93000a]' },
  high: { box: 'bg-[#ffdad6]', text: 'text-[#93000a]' },
  moderate: { box: 'bg-[#fffbeb]', text: 'text-[#b45309]' },
  low: { box: 'bg-sky-150', text: 'text-slate' },
} as const;
const STATUS = { active: 'Active', acknowledged: 'Acknowledged', resolved: 'Resolved' } as const;

export default function AlertTask() {
  const toast = useToast();
  const dial = useDial();
  const { call } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const alert = useResource<ClinicalAlert>(`/v1/alerts/${id}`, ['records']);
  const patient = usePatient(alert.data?.patientId);
  const [disposition, setDisposition] = useState<string | null>(null);
  const [justification, setJustification] = useState('');
  const [busy, setBusy] = useState<'ack' | 'resolve' | null>(null);

  if (!alert.data) {
    return (
      <Screen className="bg-sky-50" header={<AppHeader title="Clinical Alert" />} contentClassName="px-4 pt-6">
        {alert.error ? (
          alert.error.code === 'NOT_FOUND' ? (
            <EmptyState title="Alert not found" message="It may be outside your patients." actionLabel="Open Inbox" onAction={() => router.navigate('/inbox')} />
          ) : (
            <ErrorState message={alert.error.message} onAction={alert.reload} />
          )
        ) : (
          <LoadingState label="Loading the alert…" />
        )}
      </Screen>
    );
  }

  const item = alert.data;
  const tone = SEVERITY[item.severity];
  const active = item.status === 'active';
  const ready = !!disposition && justification.trim().length >= 10;

  const acknowledge = async () => {
    if (!ready) return;
    setBusy('ack');
    try {
      await call(`/v1/alerts/${item.id}/acknowledge`, { method: 'POST', body: { disposition, justification: justification.trim() } });
      alert.reload();
      toast('Alert acknowledged.');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };
  const resolve = async () => {
    setBusy('resolve');
    try {
      await call(`/v1/alerts/${item.id}/resolve`, { method: 'POST', body: {} });
      alert.reload();
      toast('Alert resolved.');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen
      className="bg-sky-50"
      bareFooter={!active}
      header={<DocHeader title="Clinical Alert" below={<Pill label={`${item.severity.toUpperCase()} • ${STATUS[item.status]}`} className={tone.box} textClassName={tone.text} />} />}
      footer={
        active ? (
          <Dock>
            <View className="flex-row gap-2">
              <DockButton label="Resolve" tone="soft" loading={busy === 'resolve'} onPress={resolve} className="min-h-[48px]" />
              <DockButton label="Acknowledge" iconRight="arrow-white-sm" loading={busy === 'ack'} disabled={!ready} onPress={acknowledge} className="min-h-[48px] flex-1" />
            </View>
            <T v="kicker" className="text-center">Acknowledge with a reason to keep the alert on file, or resolve it if it no longer applies.</T>
          </Dock>
        ) : undefined
      }
      contentClassName="gap-3 px-4 pt-3 pb-6">
      {patient.data ? (
        <SoftCard className="gap-1">
          <T v="heading">{patient.data.fullName}</T>
          <T v="body">{`${ageSex(patient.data, localToday())} • ${patient.data.mrn} • ${phone(patient.data.mobile)}`}</T>
          <View className="flex-row gap-2 pt-1">
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/patients/record', params: { patientId: patient.data!.id } })} className="flex-1 items-center rounded-xl bg-sky-150 py-2">
              <T v="strong">Open Chart</T>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => dial(telOf(patient.data!.mobile))} className="flex-1 items-center rounded-xl bg-sky-150 py-2">
              <T v="strong">Call Patient</T>
            </Pressable>
          </View>
        </SoftCard>
      ) : null}

      <SoftCard className={cn('gap-2 border', item.severity === 'critical' ? 'border-[#ba1a1a]/30' : 'border-transparent')}>
        <T v="kicker">{item.kind}</T>
        <T v="heading">{item.title}</T>
        <Text className="text-[14px] leading-[21px] text-ink">{item.detail}</Text>
        {item.statement ? <T v="body">{item.statement}</T> : null}
        <T v="kicker">{`Raised ${dayLabel(item.created.date, true)}, ${clock(item.created.time)} • ${item.createdBy}`}</T>
        {item.orderId ? (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/results/${item.orderId}`)} className="items-center rounded-xl bg-black py-2.5">
            <T v="strong" className="text-white">Review the Result</T>
          </Pressable>
        ) : null}
      </SoftCard>

      {item.status === 'acknowledged' ? (
        <SoftCard className="gap-1 bg-[#ecfdf5]">
          <T v="kicker">{`ACKNOWLEDGED${item.acknowledgedBy ? ` BY ${item.acknowledgedBy.toUpperCase()}` : ''}`}</T>
          <T v="label">{ALERT_DISPOSITIONS.find((entry) => entry.id === item.disposition)?.title ?? item.disposition}</T>
          {item.justification ? <T v="body">{item.justification}</T> : null}
        </SoftCard>
      ) : null}

      {active ? (
        <SoftCard className="gap-3">
          <T v="heading">Clinical Disposition</T>
          {ALERT_DISPOSITIONS.map((entry) => (
            <Choice key={entry.id} kind="radio" title={entry.title} checked={disposition === entry.id} onPress={() => setDisposition(entry.id)} />
          ))}
          <TextField label="Justification" value={justification} onChangeText={setJustification} multiline maxLength={2000} hint="At least 10 characters." />
        </SoftCard>
      ) : null}
    </Screen>
  );
}
