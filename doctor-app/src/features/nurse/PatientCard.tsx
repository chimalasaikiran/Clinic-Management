import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { ActionButton, Avatar, Chip, Glyph, RoundButton } from '@/components/staff/ui';
import { Text } from '@/components/ui/Text';
import { ageSex, clock, initialsOf, minutesSince, STATUS } from '@/features/reception/desk';
import colors from '@/theme/colors';

import { flagsOf, GROUP, groupOf, type WardRow } from './ward';

export const openPreparation = (row: WardRow) => router.push({ pathname: '/nurse/preparation', params: { id: row.id } });
export const recordVitalsFor = (row: WardRow) => router.push({ pathname: '/nurse/vitals', params: { id: row.id } });

/** One of today's patients, as the nurse sees them. */
export function PatientCard({ row, today, now }: { row: WardRow; today: string; now: number }) {
  const group = groupOf(row);
  const look = GROUP[group];
  const flags = flagsOf(row.vitals);
  const severe = (row.allergies ?? []).filter((allergy) => allergy.severity === 'severe');
  const present = row.status === 'arrived' || row.status === 'in_progress';

  return (
    <View className="gap-2.5 rounded-2xl border border-sky-150/50 bg-white p-3.5" style={{ borderLeftWidth: 5, borderLeftColor: look.edge }}>
      <View className="flex-row items-center gap-2">
        {row.token ? (
          <View className="rounded-lg bg-sky-150 px-2 py-1">
            <Text className="font-pj-bd text-[11px] leading-4 text-ink">Token {row.token}</Text>
          </View>
        ) : null}
        <Chip label={group === 'expected' ? STATUS[row.status].label : look.label} tone={look.tone} className="shrink self-center" />
        <Text className="flex-1 text-right text-[11px] leading-4 text-slate">
          {row.status === 'arrived' && row.arrivedAt ? `${minutesSince(row.arrivedAt, now)}m waiting` : row.waitingQueue ? 'Walk-in' : clock(row.time)}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Open ${row.patient.fullName}`} onPress={() => openPreparation(row)} className="flex-row items-center gap-3">
        <Avatar initials={initialsOf(row.patient.fullName)} />
        <View className="flex-1">
          <Text className="font-pj-bd text-[16px] leading-6 text-ink">
            {row.patient.fullName} <Text className="text-[11px] text-slate">{ageSex(row.patient, today)}</Text>
          </Text>
          <Text className="text-[12px] leading-[17px] text-slate">
            {row.patient.mrn} · {row.practitioner.displayName}
            {row.practitioner.room ? ` · ${row.practitioner.room}` : ''}
          </Text>
        </View>
      </Pressable>
      <View className="flex-row items-center gap-1.5">
        <Glyph name="assignment" size={13} color={colors.slate} />
        <Text className="flex-1 text-[12px] leading-[17px] text-slate">{row.reason}</Text>
      </View>
      {severe.length ? (
        <Text className="text-[12px] leading-[17px] text-danger">Severe allergy: {severe.map((allergy) => allergy.substance).join(', ')}</Text>
      ) : null}
      {row.vitals ? (
        <View className={flags.length ? 'gap-1 rounded-xl bg-[#fff0ef] p-3' : 'rounded-xl bg-sky-100 p-3'}>
          <Text className={flags.length ? 'font-pj-bd text-[13px] leading-[18px] text-danger' : 'text-[12px] leading-[17px] text-ink'}>
            BP {row.vitals.systolic}/{row.vitals.diastolic} · Pulse {row.vitals.pulse} · SpO2 {row.vitals.spo2}%
          </Text>
          {flags.length ? <Text className="text-[12px] leading-[17px] text-ink">Tell {row.practitioner.displayName}: {flags.join(', ')}.</Text> : null}
        </View>
      ) : null}
      {present ? (
        <View className="flex-row gap-2">
          <ActionButton
            large
            tone={row.vitals ? 'sky' : 'dark'}
            label={row.vitals ? 'View Preparation' : 'Record Vitals'}
            iconRight="arrow-forward"
            onPress={() => (row.vitals ? openPreparation(row) : recordVitalsFor(row))}
            className="min-h-[42px] flex-1"
          />
          {row.vitals ? <RoundButton icon="show-chart" label="Record vitals again" onPress={() => recordVitalsFor(row)} className="size-[42px] rounded-xl bg-mint" /> : null}
        </View>
      ) : null}
    </View>
  );
}
