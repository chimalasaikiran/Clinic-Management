import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useChart, usePatient, vitalsOfVisit, type Chart, type Vitals } from '@/features/doctor/clinical';
import { ageSex, clock, dayLabel, initialsOf, type Patient } from '@/features/reception/desk';

import { ForestCard, NurseHeader } from './ui';
import { celsius, useWard, type WardRow } from './ward';

export type Visit = {
  row: WardRow;
  today: string;
  patient: Patient;
  chart: Chart;
  /** Vital sets taken for this visit, newest first. */
  readings: Vitals[];
  /** The newest set from an earlier visit. */
  previous: Vitals | null;
  reload: () => void;
};

/** Loads today's visit named in the route, with its chart, and shows `render` once it is ready. */
export function WithVisit({ title, render }: { title: string; render: (visit: Visit) => ReactNode }) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { day } = useWard();
  const row = day.data?.appointments.find((entry) => entry.id === id) ?? null;
  const patient = usePatient(row?.patient.id);
  const chart = useChart(row?.patient.id);
  const error = day.error ?? patient.error ?? chart.error;

  if (!row || !day.data || !patient.data || !chart.data) {
    return (
      <Screen className="bg-sky-50" header={<NurseHeader title={title} />} contentClassName="px-4 pt-6">
        {day.data && !row ? (
          <EmptyState title="Not on today's list" message="Open a patient from the queue." actionLabel="Open Queue" onAction={() => router.replace('/nurse/patients')} />
        ) : error ? (
          <ErrorState message={error.message} onAction={() => (day.reload(), patient.reload(), chart.reload())} />
        ) : (
          <LoadingState label="Loading the patient…" />
        )}
      </Screen>
    );
  }

  const encounter = row.encounter ? chart.data.encounters.find((entry) => entry.id === row.encounter!.id) : null;
  const started = encounter ? { id: encounter.id, started: encounter.started } : { id: '', started: { date: day.data.today, time: '00:00', at: '' } };
  const readings = vitalsOfVisit(chart.data.vitals, started);
  return render({
    row,
    today: day.data.today,
    patient: patient.data,
    chart: chart.data,
    readings,
    previous: chart.data.vitals.find((entry) => !readings.includes(entry)) ?? null,
    reload: () => {
      day.reload();
      chart.reload();
    },
  });
}

export const readingLine = (row: Vitals) => `BP ${row.systolic}/${row.diastolic} · Pulse ${row.pulse} · SpO2 ${row.spo2}% · ${celsius(row.temperatureF)} °C · Resp ${row.respiration}`;
export const takenLine = (row: Vitals) => `${dayLabel(row.recorded.date, true)}, ${clock(row.recorded.time)} · ${row.recordedBy}`;

/** Who the nurse is preparing, with the doctor they are waiting for. */
export function VisitCard({ row, patient, today, children }: Pick<Visit, 'row' | 'patient' | 'today'> & { children?: ReactNode }) {
  return (
    <ForestCard>
      <View className="flex-row items-center gap-3">
        <View className="size-14 items-center justify-center rounded-full bg-white/15">
          <Text className="font-pj-bd text-[17px] leading-6 text-white">{initialsOf(patient.fullName)}</Text>
        </View>
        <View className="flex-1">
          <Text className="font-pj-bd text-[18px] leading-6 text-white">
            {patient.fullName} <Text className="font-pj-sb text-[11px] text-white/60">{ageSex(patient, today)}</Text>
          </Text>
          <Text className="text-[12px] leading-4 text-white/60">
            {patient.mrn}
            {patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}
          </Text>
          <Text className="text-[12px] leading-4 text-white/60">
            {row.token ? `Token ${row.token} · ` : ''}
            {row.arrivedTime ? `Arrived ${clock(row.arrivedTime)}` : `Booked ${clock(row.time)}`}
          </Text>
        </View>
      </View>
      <View className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <Text className="font-pj-bd text-[13px] leading-[18px] text-white">{row.practitioner.displayName}</Text>
        <Text className="text-[12px] leading-4 text-white/60">
          {[row.practitioner.department, row.practitioner.room].filter(Boolean).join(' · ')} · {row.reason}
        </Text>
      </View>
      {children}
    </ForestCard>
  );
}

/** Active allergies, always shown before anything is done for the patient. */
export function AllergyList({ chart }: { chart: Chart }) {
  const allergies = chart.allergies.filter((item) => item.active);
  return (
    <View className={allergies.length ? 'gap-1.5 rounded-2xl bg-[#ffdad6] p-3' : 'rounded-2xl bg-sky-100 p-3'}>
      <Text className={`font-pj-bd text-[11px] leading-4 ${allergies.length ? 'text-[#93000a]' : 'text-slate'}`}>ALLERGIES</Text>
      {allergies.length === 0 ? <Text className="text-[12px] leading-[17px] text-slate">None recorded. Ask the patient before giving anything.</Text> : null}
      {allergies.map((item) => (
        <Text key={item.id} className="text-[13px] leading-[18px] text-[#93000a]">
          ⚠ {item.substance} ({item.severity}): {item.reaction}
        </Text>
      ))}
    </View>
  );
}
