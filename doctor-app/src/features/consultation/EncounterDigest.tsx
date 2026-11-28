import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { followUpLine, useActiveEncounter, type Step } from '@/features/doctor/clinical';
import { clock, dayLabel } from '@/features/reception/desk';
import { cn } from '@/lib/cn';

import { T, type } from './design';

function Block({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View className="gap-1 rounded-lg bg-sky-100 px-2 py-3">
      {label ? <T v="kicker">{label}</T> : null}
      {children}
    </View>
  );
}

function Reading({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View className="w-[48.7%] gap-1.5 rounded-lg bg-sky-100 px-2.5 py-3">
      <T v="kicker">{label}</T>
      <Text className={type.heading}>
        {value}
        {unit ? <Text className={type.body}> {unit}</Text> : null}
      </Text>
    </View>
  );
}

const Empty = ({ text }: { text: string }) => <T v="body">{text}</T>;
const toC = (fahrenheit: number) => Math.round(((fahrenheit - 32) * 5) / 9 * 10) / 10;

/** What each part of the open encounter holds, written from the saved records. */
export function useEncounterDigest(): Record<Step, ReactNode> {
  const { encounter, vitals, diagnoses, prescriptions, orders, referrals, chart, followUp } = useActiveEncounter();
  const visit = encounter.data;
  const latest = vitals[0];
  const plans = (chart.data?.carePlans ?? []).filter((plan) => visit && plan.created.date >= visit.started.date);
  const planned = visit ? followUpLine(visit.soap.plan) : null;

  return {
    notes: visit ? (
      <View className="gap-2">
        <Block label="CHIEF COMPLAINT">
          <T v="para">{visit.chiefComplaint || 'Not documented yet.'}</T>
        </Block>
        {visit.soap.subjective ? (
          <Block label="HISTORY (SUBJECTIVE)">
            <T v="para">{visit.soap.subjective}</T>
          </Block>
        ) : null}
        {visit.soap.objective ? (
          <Block label="EXAMINATION (OBJECTIVE)">
            <T v="para">{visit.soap.objective}</T>
          </Block>
        ) : null}
      </View>
    ) : null,
    vitals: latest ? (
      <View className="flex-row flex-wrap justify-between gap-y-2">
        <Reading label="Blood Pressure" value={`${latest.systolic}/${latest.diastolic}`} unit="mmHg" />
        <Reading label="Heart Rate" value={String(latest.pulse)} unit="bpm" />
        <Reading label="SpO2" value={`${latest.spo2}%`} />
        <Reading label="Resp. Rate" value={String(latest.respiration)} unit="/min" />
        <Reading label="Weight & Height" value={`${latest.weightKg} kg`} unit={`${latest.heightCm} cm`} />
        <Reading label="Temperature" value={`${toC(latest.temperatureF)}`} unit="°C" />
      </View>
    ) : (
      <Empty text="No vitals recorded for this visit." />
    ),
    assessment: (
      <View className="gap-2.5">
        {visit?.soap.assessment ? (
          <Block label="ASSESSMENT">
            <T v="para">{visit.soap.assessment}</T>
          </Block>
        ) : null}
        {diagnoses.filter((item) => item.status === 'active').map((item) => (
          <View key={item.id} className="gap-1 rounded-lg bg-sky-100 p-2">
            <View className="flex-row items-center justify-between gap-2">
              <T v="kicker" className="flex-1">{`${item.designation.toUpperCase()} · ${item.verification.toUpperCase()}`}</T>
              <View className="rounded bg-sky-200 px-1.5 py-0.5">
                <T v="kicker" className="text-ink">{`ICD-10 ${item.icd}`}</T>
              </View>
            </View>
            <T v="label" className="font-pj-md">{item.name}</T>
          </View>
        ))}
        {diagnoses.length === 0 ? <Empty text="No diagnosis yet. Signing needs at least one." /> : null}
        {visit?.soap.plan ? (
          <Block label="PLAN">
            <T v="para">{visit.soap.plan}</T>
          </Block>
        ) : null}
      </View>
    ),
    prescription: prescriptions.length ? (
      <View className="gap-2">
        {prescriptions.flatMap((rx) =>
          rx.items.map((item, index) => (
            <View key={item.id} className="flex-row items-center justify-between gap-2 rounded-lg bg-sky-100 p-2.5">
              <View className="flex-1 gap-0.5">
                <T v="label">{`${index + 1}. ${item.name} ${item.strength}`}</T>
                <T v="body">{`${item.dose} • ${item.frequency} • ${item.food}`}</T>
              </View>
              <View className="rounded bg-white px-2 py-1">
                <T v="kicker" className="text-ink">{`${item.durationDays} Days`}</T>
              </View>
            </View>
          )),
        )}
        <T v="kicker" className="pt-1">{prescriptions.map((rx) => rx.reference).join(', ')}</T>
      </View>
    ) : (
      <Empty text="No prescription this visit." />
    ),
    orders: orders.length ? (
      <View className="gap-2">
        {orders.map((order) => (
          <View key={order.id} className="gap-0.5 rounded-lg bg-sky-100 p-2.5">
            <T v="label">{order.title}</T>
            <T v="body">{`${order.reference} • ${order.indication}`}</T>
          </View>
        ))}
      </View>
    ) : (
      <Empty text="No tests ordered this visit." />
    ),
    referral: referrals.length ? (
      <View className="gap-2">
        {referrals.map((item) => (
          <View key={item.id} className="gap-1 rounded-lg bg-sky-100 p-3">
            <T v="label">{item.targetPractitioner?.displayName ?? item.facility}</T>
            <T v="body">{`${item.specialty} • ${item.priority}`}</T>
            <T v="body">{item.indication}</T>
          </View>
        ))}
      </View>
    ) : (
      <Empty text="No referral this visit." />
    ),
    carePlan: plans.length ? (
      <View className="gap-2">
        {plans.map((plan) => (
          <View key={plan.id} className="gap-1 rounded-lg bg-sky-100 p-2.5">
            <T v="label">{plan.title}</T>
            <T v="body">{`${plan.goals.length} goals • review ${dayLabel(plan.nextReview, true)}`}</T>
          </View>
        ))}
      </View>
    ) : (
      <Empty text="No care plan started this visit." />
    ),
    followUp: followUp ? (
      <View className="gap-1.5 rounded-lg bg-sky-100 p-3">
        <T v="heading">{dayLabel(followUp.date, true)}</T>
        <T v="body">{`${clock(followUp.time)} • ${followUp.practitioner.displayName} • ${followUp.reference}`}</T>
      </View>
    ) : planned ? (
      <View className={cn('rounded-lg bg-sky-100 p-3')}>
        <Text className={cn(type.body, 'text-ink')}>{planned === 'none' ? 'No follow-up needed.' : planned}</Text>
      </View>
    ) : (
      <Empty text="No follow-up recorded." />
    ),
  };
}
