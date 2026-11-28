import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Card, CardTitle, Grid, Kicker, Options, Panel, Tag, Tile } from '@/components/ui/Kit';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { WorkflowScreen } from '@/features/consultation/WorkflowScreen';
import { useActiveEncounter, type Vitals as VitalsRow } from '@/features/doctor/clinical';
import { clock, dayLabel } from '@/features/reception/desk';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { bloodPressureStage, bodyMassIndex, inRange } from '@/lib/clinical';
import { useSession } from '@/state/SessionState';

// The ranges the server accepts. Temperature is entered in °C and stored in °F.
const fields = {
  systolic: { label: 'Systolic', min: 50, max: 300 },
  diastolic: { label: 'Diastolic', min: 30, max: 200 },
  pulse: { label: 'Pulse (bpm)', min: 20, max: 250 },
  respiration: { label: 'Respiration (/min)', min: 4, max: 80 },
  temperature: { label: 'Temperature (°C)', min: 32.3, max: 43.3 },
  spo2: { label: 'SpO2 (%)', min: 50, max: 100 },
  height: { label: 'Height (cm)', min: 30, max: 250 },
  weight: { label: 'Weight (kg)', min: 1, max: 400 },
  glucose: { label: 'Glucose (mg/dL)', min: 10, max: 1000 },
} as const;

type Key = keyof typeof fields;
const OPTIONAL: Key[] = ['glucose'];

const toC = (fahrenheit: number) => Math.round(((fahrenheit - 32) * 5) / 9 * 10) / 10;
const toF = (celsius: number) => Math.round((celsius * 9) / 5 * 10 + 320) / 10;
const blank: Record<Key, string> = { systolic: '', diastolic: '', pulse: '', respiration: '', temperature: '', spo2: '', height: '', weight: '', glucose: '' };

function Reading({ row, label }: { row: VitalsRow; label: string }) {
  return (
    <Panel className="border-sky-150 bg-sky-100">
      <Text className="font-pj-sb text-[11px] leading-4 text-ink">
        {label}: BP {row.systolic}/{row.diastolic} · Pulse {row.pulse} · SpO2 {row.spo2}% · {toC(row.temperatureF)} °C
      </Text>
      <Text className="text-[11px] leading-4 text-slate">
        {dayLabel(row.recorded.date, true)}, {clock(row.recorded.time)} · {row.recordedBy}
      </Text>
    </Panel>
  );
}

export default function Vitals() {
  const toast = useToast();
  const { call } = useSession();
  const { encounter, chart, vitals, sealed, reload } = useActiveEncounter();
  const [values, setValues] = useState(blank);
  const [pain, setPain] = useState<number | null>(null);
  const [posture, setPosture] = useState('Sitting');
  const [site, setSite] = useState('Right arm');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const visit = encounter.data;
  const latest = vitals[0];
  const previous = (chart.data?.vitals ?? []).find((row) => !vitals.includes(row));
  const errorFor = (key: Key) =>
    (OPTIONAL.includes(key) && !values[key].trim()) || inRange(values[key], fields[key].min, fields[key].max) ? '' : `Enter ${fields[key].min}–${fields[key].max}.`;
  const diastolicHigh = values.systolic && values.diastolic && Number(values.diastolic) >= Number(values.systolic);
  const invalid = (Object.keys(fields) as Key[]).some((key) => errorFor(key)) || !!diastolicHigh;
  const bmi = bodyMassIndex(Number(values.height), Number(values.weight));
  const stage = values.systolic && values.diastolic ? bloodPressureStage(Number(values.systolic), Number(values.diastolic)) : null;

  // Starts from the last measured height, which rarely changes between visits.
  const fillFrom = (row: VitalsRow) => setValues((current) => ({ ...current, height: current.height || String(row.heightCm) }));

  const input = (key: Key) => (
    <TextField
      className="flex-1"
      label={fields[key].label}
      labelClassName="font-pj-bd text-[10px] leading-[15px] text-slate"
      boxClassName="min-h-[48px] border-edge bg-white"
      keyboardType="decimal-pad"
      editable={!sealed}
      value={values[key]}
      onChangeText={(text) => setValues({ ...values, [key]: text })}
      inputClassName="font-pj-xb text-[18px]"
      error={submitted ? (key === 'diastolic' && diastolicHigh ? 'Must be lower than systolic.' : errorFor(key)) : ''}
    />
  );

  const save = async () => {
    setSubmitted(true);
    if (!visit) return;
    if (invalid) {
      toast('Correct the readings that are missing or out of range.');
      return;
    }
    setSaving(true);
    try {
      await call(`/v1/patients/${visit.patientId}/vitals`, {
        method: 'POST',
        body: {
          encounterId: visit.id,
          systolic: Number(values.systolic),
          diastolic: Number(values.diastolic),
          pulse: Number(values.pulse),
          respiration: Number(values.respiration),
          temperatureF: toF(Number(values.temperature)),
          spo2: Number(values.spo2),
          weightKg: Number(values.weight),
          heightCm: Number(values.height),
          ...(values.glucose.trim() ? { bloodSugar: Number(values.glucose) } : {}),
          ...(pain !== null ? { painScore: pain } : {}),
          posture,
          site,
        },
      });
      reload();
      setValues(blank);
      setSubmitted(false);
      toast('Vitals saved to the chart.');
      router.push('/consultation/assessment');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorkflowScreen
      title="Vitals & Observations"
      subtitle={visit ? `${visit.reference} · ${visit.branch.name}` : ''}
      badge={{ label: latest ? 'RECORDED' : 'PENDING', tone: latest ? 'teal' : 'sky' }}
      status={latest ? `Last set ${clock(latest.recorded.time)} by ${latest.recordedBy}` : 'No vitals recorded for this visit yet'}
      secondary={latest ? { label: 'Skip', onPress: () => router.push('/consultation/assessment') } : undefined}
      primary={{ label: latest ? 'Save New Set' : 'Save Vitals', onPress: save, loading: saving, disabled: sealed }}>
      <CardTitle icon="vitals" title="This Visit" right={<Tag label={`${vitals.length} recorded`} />} />
      {latest ? <Reading row={latest} label="Latest" /> : null}
      {previous ? <Reading row={previous} label="Previous visit" /> : null}
      {previous ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => fillFrom(previous)} disabled={sealed}>
          <Text className="font-pj-bd text-[11px] leading-4 text-ink">Use last height ({previous.heightCm} cm)</Text>
        </Pressable>
      ) : null}

      <Card>
        <View className="flex-row items-start justify-between gap-2">
          <Kicker>BLOOD PRESSURE</Kicker>
          {stage ? <Tag label={stage} tone={stage === 'NORMAL' ? 'mint' : 'red'} /> : null}
        </View>
        <View className="flex-row gap-2">
          {input('systolic')}
          {input('diastolic')}
        </View>
        <Options options={['Right arm', 'Left arm'].map((value) => ({ value, label: value }))} value={site} onChange={setSite} />
        <Options options={['Sitting', 'Standing', 'Lying'].map((value) => ({ value, label: value }))} value={posture} onChange={setPosture} />
        <Text className="text-[11px] leading-4 text-slate">mmHg · Guideline target below 130/80 mmHg</Text>
      </Card>

      <View className="flex-row gap-2">
        <Card className="flex-1">{input('pulse')}</Card>
        <Card className="flex-1">{input('spo2')}</Card>
      </View>
      <View className="flex-row gap-2">
        <Card className="flex-1">{input('respiration')}</Card>
        <Card className="flex-1">{input('temperature')}</Card>
      </View>

      <Card>
        <CardTitle title="Height, Weight & BMI" />
        <View className="flex-row gap-2">
          {input('height')}
          {input('weight')}
        </View>
        <Grid>
          <Tile
            label="BMI"
            value={bmi === null ? '—' : bmi.toFixed(1)}
            unit="kg/m²"
            tag={bmi !== null && bmi >= 23 ? <Tag label={bmi >= 25 ? 'OBESE' : 'OVERWEIGHT'} tone="amber" /> : null}
          />
          <Tile
            label="WEIGHT CHANGE"
            value={previous && values.weight && inRange(values.weight, 1, 400) ? `${Number(values.weight) - previous.weightKg >= 0 ? '↑' : '↓'} ${Math.abs(Math.round((Number(values.weight) - previous.weightKg) * 10) / 10)}` : '—'}
            unit="kg"
            note={previous ? 'Since last visit' : 'No earlier weight'}
          />
        </Grid>
        <Text className="text-[11px] leading-4 text-slate">WHO Asian Indian cut-offs: overweight from 23.0, obese from 25.0 kg/m².</Text>
      </Card>

      <Card>
        <Kicker>BLOOD GLUCOSE (OPTIONAL)</Kicker>
        <View className="flex-row">{input('glucose')}</View>
      </Card>

      <Card>
        <View className="flex-row items-center justify-between">
          <Kicker>PAIN SCORE (OPTIONAL)</Kicker>
          {pain !== null ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setPain(null)}>
              <Text className="font-pj-bd text-[11px] leading-4 text-ink">Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <Text className="font-pj-xb text-[24px] leading-8 text-heading">
          {pain ?? '—'} <Text className="font-pj-md text-[12px] text-slate">/ 10</Text>
        </Text>
        <View accessibilityRole="radiogroup" className="flex-row gap-1">
          {Array.from({ length: 11 }, (_, score) => (
            <Pressable
              key={score}
              accessibilityRole="radio"
              accessibilityLabel={`Pain ${score} of 10`}
              accessibilityState={{ checked: pain === score }}
              disabled={sealed}
              onPress={() => setPain(score)}
              className={cn('h-9 flex-1 items-center justify-center rounded-md', pain === score ? 'bg-black' : 'bg-sky-150')}>
              <Text className={cn('font-pj-bd text-[11px]', pain === score ? 'text-white' : 'text-ink')}>{score}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
    </WorkflowScreen>
  );
}
