import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, Share, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { AppHeader, IconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useChart, usePatient, vitalsOfVisit, type Encounter } from '@/features/doctor/clinical';
import { clock, dayLabel } from '@/features/reception/desk';
import { useResource } from '@/hooks/useResource';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession } from '@/state/SessionState';
import type { IconName } from '@/theme/icons';

const dim = 'text-[#566b74]';
const dark = 'text-[#182d35]';
const body = 'text-[12px] leading-[17px] text-[#566b74]';
const SOAP_BOX = { S: 'bg-[#182d35]', O: 'bg-teal', A: 'bg-[#566b74]', P: 'bg-[#047857]' } as const;

function Section({ icon, title, right, children }: { icon?: IconName; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <View className="gap-3 rounded-2xl border border-edge bg-white p-4">
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-1 flex-row items-center gap-2">
          {icon ? <Icon name={icon} /> : <View className="h-2.5 w-1.5 rounded-full bg-teal" />}
          <Text accessibilityRole="header" className={cn('flex-1 font-pj-bd text-[15px] leading-5', dark)}>
            {title}
          </Text>
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

function Chip({ label, className, textClassName }: { label: string; className?: string; textClassName?: string }) {
  return (
    <View className={cn('self-start rounded-md border border-edge bg-[#f6faf9] px-2 py-0.5', className)}>
      <Text className={cn('font-pj-bd text-[11px] leading-4', dim, textClassName)}>{label}</Text>
    </View>
  );
}

export default function EncounterRecord() {
  const toast = useToast();
  const { call } = useSession();
  const { encounterId } = useLocalSearchParams<{ encounterId?: string }>();
  const encounter = useResource<Encounter>(encounterId ? `/v1/encounters/${encounterId}` : null, ['records']);
  const patient = usePatient(encounter.data?.patientId);
  const chart = useChart(encounter.data?.patientId);
  const [addendum, setAddendum] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!encounter.data) {
    return (
      <Screen inTabs className="bg-[#f6faf9]" header={<AppHeader title="Encounter" />} contentClassName="px-4 pt-6">
        {!encounterId ? (
          <EmptyState title="No encounter chosen" message="Open one from a patient's clinical history." actionLabel="Search Patients" onAction={() => router.push('/patients/search')} />
        ) : encounter.error ? (
          <ErrorState message={encounter.error.message} onAction={encounter.reload} />
        ) : (
          <LoadingState label="Loading the encounter…" />
        )}
      </Screen>
    );
  }

  const visit = encounter.data;
  const mine = <T extends { encounterId: string | null }>(rows: T[] | undefined) => (rows ?? []).filter((row) => row.encounterId === visit.id);
  const diagnoses = mine(chart.data?.diagnoses);
  const prescriptions = mine(chart.data?.prescriptions);
  const orders = mine(chart.data?.orders);
  const vitals = vitalsOfVisit(chart.data?.vitals, visit)[0];
  const note = mine(chart.data?.notes)[0];
  const soap = [
    { letter: 'S' as const, title: 'SUBJECTIVE', text: visit.soap.subjective },
    { letter: 'O' as const, title: 'OBJECTIVE', text: visit.soap.objective },
    { letter: 'A' as const, title: 'ASSESSMENT', text: visit.soap.assessment },
    { letter: 'P' as const, title: 'PLAN', text: visit.soap.plan },
  ].filter((part) => part.text.trim());

  const saveAddendum = async () => {
    if (!note || !addendum || addendum.trim().length < 10) return;
    setSaving(true);
    try {
      await call(`/v1/notes/${note.id}/addenda`, { method: 'POST', body: { text: addendum.trim() } });
      setAddendum(null);
      chart.reload();
      toast('Addendum added to the note.');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      inTabs
      className="bg-[#f6faf9]"
      header={
        <AppHeader
          title={visit.reference}
          subtitle={patient.data ? `${patient.data.fullName} · ${patient.data.mrn}` : visit.type}
          right={<IconButton icon="share" label="Share encounter summary" onPress={() => Share.share({ message: `${visit.reference} · ${visit.chiefComplaint} · ${diagnoses.map((item) => item.name).join(', ')}` }).catch(() => toast('This device cannot share.'))} />}
        />
      }
      contentClassName="gap-3 px-4 pt-3 pb-6">
      <View className="gap-2 rounded-2xl bg-[#182d35] p-4">
        <View className="flex-row items-center justify-between gap-2">
          <Chip label={visit.status === 'signed' ? 'SIGNED' : 'IN PROGRESS'} className="border-white/20 bg-white/10" textClassName="text-[#6ee7b7]" />
          <Text className="text-[11px] leading-4 text-[#cbd5e1]">{visit.branch.name}</Text>
        </View>
        <Text className="font-pj-bd text-[17px] leading-6 text-white">{visit.chiefComplaint || visit.type}</Text>
        <Text className="text-[12px] leading-[17px] text-[#cbd5e1]">
          {dayLabel(visit.started.date, true)} · {clock(visit.started.time)} · {visit.practitioner?.displayName ?? visit.startedBy}
        </Text>
        {visit.signed ? (
          <Text className="text-[11px] leading-4 text-[#94a3b8]">
            Signed {dayLabel(visit.signed.date, true)} {clock(visit.signed.time)}
            {visit.signed.by ? ` by ${visit.signed.by}` : ''}
          </Text>
        ) : null}
      </View>

      {vitals ? (
        <Section title="Vitals">
          <Text className={body}>
            BP {vitals.systolic}/{vitals.diastolic} mmHg · Pulse {vitals.pulse} · SpO2 {vitals.spo2}% · Resp {vitals.respiration} · Weight {vitals.weightKg} kg
          </Text>
        </Section>
      ) : null}

      <Section title="SOAP Notes">
        {soap.length === 0 ? <Text className={body}>No notes were written.</Text> : null}
        {soap.map((part) => (
          <View key={part.letter} className="flex-row gap-3">
            <View className={cn('size-7 items-center justify-center rounded-lg', SOAP_BOX[part.letter])}>
              <Text className="font-pj-bd text-[13px] text-white">{part.letter}</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className={cn('font-pj-bd text-[10px] leading-[15px]', dim)}>{part.title}</Text>
              <Text className={cn('text-[13px] leading-[19px]', dark)}>{part.text}</Text>
            </View>
          </View>
        ))}
      </Section>

      <Section title="Diagnoses">
        {diagnoses.length === 0 ? <Text className={body}>None recorded.</Text> : null}
        {diagnoses.map((item) => (
          <View key={item.id} className="gap-1 rounded-xl border border-edge bg-[#f6faf9] p-3">
            <View className="flex-row gap-1.5">
              <Chip label={item.icd} />
              <Chip label={item.designation.toUpperCase()} />
              {item.status === 'resolved' ? <Chip label="RESOLVED" /> : null}
            </View>
            <Text className={cn('font-pj-bd text-[13px] leading-[18px]', dark)}>{item.name}</Text>
          </View>
        ))}
      </Section>

      {prescriptions.length ? (
        <Section title="Prescriptions">
          {prescriptions.flatMap((rx) =>
            rx.items.map((item) => (
              <View key={item.id} className="gap-0.5 rounded-xl border border-edge bg-[#f6faf9] p-3">
                <Text className={cn('font-pj-bd text-[13px] leading-[18px]', dark)}>
                  {item.name} {item.strength}
                </Text>
                <Text className={body}>
                  {item.dose} · {item.frequency} · {item.food} · {item.durationDays} days
                </Text>
              </View>
            )),
          )}
        </Section>
      ) : null}

      {orders.length ? (
        <Section title="Investigations">
          {orders.map((order) => (
            <Pressable key={order.id} accessibilityRole="button" disabled={!order.result} onPress={() => router.push(`/results/${order.id}`)} className="gap-0.5 rounded-xl border border-edge bg-[#f6faf9] p-3">
              <Text className={cn('font-pj-bd text-[13px] leading-[18px]', dark)}>{order.title}</Text>
              <Text className={body}>{order.result ? order.result.summary : order.status.replace('_', ' ')}</Text>
            </Pressable>
          ))}
        </Section>
      ) : null}

      {note ? (
        <Section title="Signed Clinical Note" right={<Chip label={note.author} />}>
          {note.sections.map((section) => (
            <View key={section.heading} className="gap-0.5">
              <Text className={cn('font-pj-bd text-[10px] leading-[15px]', dim)}>{section.heading.toUpperCase()}</Text>
              <Text className={cn('text-[13px] leading-[19px]', dark)}>{section.body}</Text>
            </View>
          ))}
          {note.addenda.map((entry) => (
            <View key={entry.id} className="gap-0.5 rounded-xl border border-[#fde68a] bg-[#fffbeb] p-3">
              <Text className="font-pj-bd text-[10px] leading-[15px] text-[#92400e]">
                ADDENDUM · {entry.author} · {dayLabel(entry.at.date)} {clock(entry.at.time)}
              </Text>
              <Text className={cn('text-[13px] leading-[19px]', dark)}>{entry.text}</Text>
            </View>
          ))}
          <Button label="Add Addendum" variant="soft" size="md" onPress={() => setAddendum('')} />
        </Section>
      ) : null}

      <Sheet visible={addendum !== null} onClose={() => setAddendum(null)} title="Add an addendum">
        <TextField label="Addendum" value={addendum ?? ''} onChangeText={setAddendum} multiline maxLength={2000} hint="At least 10 characters. The signed note itself does not change." />
        <Button label="Save Addendum" className="mt-3" loading={saving} disabled={(addendum ?? '').trim().length < 10} onPress={saveAddendum} />
      </Sheet>
    </Screen>
  );
}
