import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/layout/Screen';
import { ActionButton, Box, Chip } from '@/components/staff/ui';
import { Options } from '@/components/ui/Kit';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { NurseHeader } from '@/features/nurse/ui';
import { AllergyList, readingLine, takenLine, VisitCard, WithVisit, type Visit } from '@/features/nurse/visit';
import { flagsOf } from '@/features/nurse/ward';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { bodyMassIndex, bpCategory, emptyVitals, fahrenheit, vitalFields, vitalValue, vitalsProblem, type VitalEntry, type VitalKey } from '@/lib/vitals';
import { useSession } from '@/state/SessionState';

const POSTURES = ['Sitting', 'Standing', 'Lying'];
const SITES = ['Right arm', 'Left arm'];
const scores = Array.from({ length: 11 }, (_, score) => score);

function RecordVitals({ row, patient, today, chart, readings, previous, reload }: Visit) {
  const toast = useToast();
  const { call, can } = useSession();
  // Height rarely changes between visits, so it starts from the last one measured.
  const [entry, setEntry] = useState<VitalEntry>({ ...emptyVitals, height: previous ? String(previous.heightCm) : '' });
  const [posture, setPosture] = useState('Sitting');
  const [site, setSite] = useState('Right arm');
  const [pain, setPain] = useState<number | null>(null);
  const [sugar, setSugar] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const read = (key: VitalKey) => vitalValue(key, entry[key]);
  const systolic = read('systolic');
  const diastolic = read('diastolic');
  const height = read('height');
  const weight = read('weight');
  const temperature = read('temperature');
  const bmi = height !== null && weight !== null ? bodyMassIndex(height, weight) : null;
  const category = systolic !== null && diastolic !== null && diastolic < systolic ? bpCategory(systolic, diastolic) : null;
  const sugarValid = !sugar || (Number(sugar) >= 10 && Number(sugar) <= 1000);
  const problem = vitalsProblem(entry) || (sugarValid ? '' : 'Blood sugar: enter a value from 10 to 1000, or leave it empty.');
  const present = row.status === 'arrived' || row.status === 'in_progress';
  // What the readings typed so far would flag, before saving.
  const flags =
    systolic !== null && diastolic !== null
      ? flagsOf({ systolic, diastolic, pulse: read('heartRate') ?? 72, spo2: read('spo2') ?? 99, temperatureF: temperature !== null ? fahrenheit(temperature) : 98 })
      : [];

  const field = (key: VitalKey, label: string) => (
    <TextField
      className="flex-1"
      label={label}
      labelClassName="font-pj-bd text-[10px] leading-[15px] text-slate"
      boxClassName="min-h-[48px] border-sky-150 bg-white"
      keyboardType="decimal-pad"
      maxLength={5}
      value={entry[key]}
      onChangeText={(value) => setEntry({ ...entry, [key]: value.replace(/[^\d.]/g, '') })}
      inputClassName="font-pj-xb text-[18px]"
      error={(submitted || entry[key]) && vitalValue(key, entry[key]) === null ? `${vitalFields[key].min}–${vitalFields[key].max}` : ''}
    />
  );

  const save = async () => {
    setSubmitted(true);
    if (problem) {
      toast(problem);
      return;
    }
    setSaving(true);
    try {
      await call(`/v1/patients/${patient.id}/vitals`, {
        method: 'POST',
        body: {
          // Linked to the doctor's encounter when one is already open; otherwise it counts for today's visit.
          ...(row.encounter?.status === 'in_progress' ? { encounterId: row.encounter.id } : {}),
          systolic: Number(entry.systolic),
          diastolic: Number(entry.diastolic),
          pulse: Number(entry.heartRate),
          respiration: Number(entry.respiration),
          temperatureF: fahrenheit(Number(entry.temperature)),
          spo2: Number(entry.spo2),
          weightKg: Number(entry.weight),
          heightCm: Number(entry.height),
          ...(sugar ? { bloodSugar: Number(sugar) } : {}),
          ...(pain !== null ? { painScore: pain } : {}),
          posture,
          site,
        },
      });
      reload();
      toast(flags.length ? `Saved. Tell ${row.practitioner.displayName}: ${flags.join(', ')}.` : 'Vitals saved to the chart.');
      router.replace({ pathname: '/nurse/preparation', params: { id: row.id } });
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      className="bg-sky-50"
      header={<NurseHeader title="Record Vitals" subtitle={`${patient.fullName} · ${patient.mrn}`} />}
      footer={present && can('clinical.vitals') ? <ActionButton large tone="dark" label={saving ? 'Saving…' : 'Save to Chart'} icon="check" disabled={saving} onPress={save} /> : undefined}
      contentClassName="gap-3.5 px-4 pt-3 pb-6">
      <VisitCard row={row} patient={patient} today={today} />
      <AllergyList chart={chart} />
      {!present ? <Text className="rounded-xl bg-sky-100 p-3 text-[12px] leading-[18px] text-slate">Vitals are recorded after the patient is checked in.</Text> : null}
      {readings[0] ? (
        <Box className="p-3.5">
          <Text className="font-pj-bd text-[11px] leading-4 text-slate">ALREADY TAKEN TODAY</Text>
          <Text className="text-[12px] leading-[17px] text-ink">{readingLine(readings[0])}</Text>
          <Text className="text-[11px] leading-4 text-slate">{takenLine(readings[0])}</Text>
        </Box>
      ) : previous ? (
        <Box className="p-3.5">
          <Text className="font-pj-bd text-[11px] leading-4 text-slate">LAST VISIT</Text>
          <Text className="text-[12px] leading-[17px] text-ink">{readingLine(previous)}</Text>
          <Text className="text-[11px] leading-4 text-slate">{takenLine(previous)}</Text>
        </Box>
      ) : null}

      <Box className="p-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-pj-bd text-[15px] leading-5 text-ink">Blood Pressure</Text>
          {category ? <Chip label={category} tone={category === 'Normal' ? 'green' : 'red'} className="self-center" /> : null}
        </View>
        <View className="flex-row gap-2">
          {field('systolic', 'Systolic')}
          {field('diastolic', 'Diastolic')}
        </View>
        {submitted && systolic !== null && diastolic !== null && diastolic >= systolic ? <Text className="text-[12px] leading-4 text-danger">Diastolic must be lower than systolic.</Text> : null}
        <Options options={SITES.map((value) => ({ value, label: value }))} value={site} onChange={setSite} />
        <Options options={POSTURES.map((value) => ({ value, label: value }))} value={posture} onChange={setPosture} />
      </Box>

      <Box className="p-4">
        <View className="flex-row gap-2">
          {field('heartRate', 'Pulse (bpm)')}
          {field('spo2', 'SpO2 (%)')}
        </View>
        <View className="flex-row gap-2">
          {field('temperature', 'Temp (°C)')}
          {field('respiration', 'Resp (/min)')}
        </View>
        {temperature !== null ? <Text className="text-[12px] leading-4 text-slate">{fahrenheit(temperature)} °F</Text> : null}
      </Box>

      <Box className="p-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-pj-bd text-[15px] leading-5 text-ink">Height & Weight</Text>
          {bmi !== null ? <Chip label={`BMI ${bmi}`} className="self-center" /> : null}
        </View>
        <View className="flex-row gap-2">
          {field('height', 'Height (cm)')}
          {field('weight', 'Weight (kg)')}
        </View>
      </Box>

      <Box className="p-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-pj-bd text-[14px] leading-5 text-ink">Pain Score (optional)</Text>
          <Chip label={pain === null ? 'Not scored' : `${pain} / 10`} tone="amber" className="self-center" />
        </View>
        <View className="flex-row gap-1">
          {scores.map((score) => (
            <Pressable
              key={score}
              accessibilityRole="button"
              accessibilityLabel={`Pain score ${score}`}
              accessibilityState={{ selected: pain === score }}
              onPress={() => setPain(pain === score ? null : score)}
              className={cn('h-8 flex-1 items-center justify-center rounded-md', pain === score ? 'bg-[#d97706]' : 'bg-sky-150')}>
              <Text className={cn('font-pj-bd text-[11px] leading-4', pain === score ? 'text-white' : 'text-slate')}>{score}</Text>
            </Pressable>
          ))}
        </View>
        <TextField label="Random blood sugar, mg/dL (optional)" value={sugar} onChangeText={(value) => setSugar(value.replace(/\D/g, ''))} keyboardType="number-pad" maxLength={4} error={sugarValid ? '' : '10–1000'} />
      </Box>

      {flags.length ? (
        <View accessibilityRole="alert" className="rounded-2xl bg-[#fff0ef] p-4">
          <Text className="font-pj-bd text-[14px] leading-5 text-[#93000a]">Outside the usual range</Text>
          <Text className="text-[12px] leading-[18px] text-ink">
            {flags.join(', ')}. Recheck if unsure, then tell {row.practitioner.displayName} directly. ClinicOS does not send an alert.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

export default function NurseVitals() {
  return <WithVisit title="Record Vitals" render={(visit) => <RecordVitals key={visit.row.id} {...visit} />} />;
}
