import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import type { ClinicalDay, Encounter } from '@/features/doctor/clinical';
import { ageSex, clock, minutesSince, STATUS } from '@/features/reception/desk';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useConsultation } from '@/state/ConsultationState';
import { useSession } from '@/state/SessionState';

type Row = ClinicalDay['appointments'][number];

/** Starts the encounter for an arrived visit (or reopens its open one) and goes to the workspace. */
export function useStartConsultation() {
  const toast = useToast();
  const { call } = useSession();
  const { open } = useConsultation();
  const [busy, setBusy] = useState<string | null>(null);

  const start = async (row: Row) => {
    if (row.encounter) {
      open(row.encounter.id);
      router.push('/patients/workspace');
      return;
    }
    setBusy(row.id);
    try {
      const encounter = await call<Encounter>('/v1/encounters', { method: 'POST', body: { appointmentId: row.id } });
      open(encounter.id);
      router.push('/patients/workspace');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(null);
    }
  };
  return { start, busy };
}

/** One patient on the Today list. The first in line gets the primary action. */
export function FlowCard({ row, today, next, now }: { row: Row; today: string; next: boolean; now: number }) {
  const { start, busy } = useStartConsultation();
  const waiting = row.status === 'arrived';
  const inRoom = row.status === 'in_progress';
  const tokenBox = next || inRoom ? 'border-[#a8cec6] bg-mint/40' : 'border-sky-300 bg-sky-100';
  const openChart = () => router.push({ pathname: '/patients/record', params: { patientId: row.patient.id } });
  const badge = waiting && row.arrivedAt ? `Wait ${minutesSince(row.arrivedAt, now)}m` : STATUS[row.status].label;
  const vitals = row.vitals ? `BP ${row.vitals.systolic}/${row.vitals.diastolic}` : null;
  const allergy = row.allergies?.find((item) => item.severity === 'severe');

  return (
    <View className="gap-2.5 rounded-2xl border border-sky-300 bg-white p-3.5">
      <View className="flex-row items-start gap-3">
        <View className={cn('size-12 items-center justify-center rounded-xl border', tokenBox)}>
          <Text className={cn('font-pj-bd text-[9px] leading-3', next ? 'text-deep' : 'text-slate')}>TOKEN</Text>
          <Text className={cn('font-pj-bd text-[14px] leading-5', next ? 'text-teal' : 'text-ink')}>{row.token ?? '—'}</Text>
        </View>
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="shrink font-pj-bd text-[14px] leading-5 text-ink">{row.patient.fullName}</Text>
            <Text className="text-[11px] leading-4 text-slate">{ageSex(row.patient, today)}</Text>
          </View>
          <Text className="text-[11px] leading-4 text-slate">
            {row.waitingQueue ? 'Walk-in' : `Slot: ${clock(row.time)}`} · {row.patient.mrn}
          </Text>
        </View>
        <View className={cn('rounded-full border px-2 py-0.5', next ? 'border-[#a8cec6]/60 bg-mint/50' : 'border-sky-300 bg-sky-50')}>
          <Text className={cn('font-pj-bd text-[11px] leading-4', next ? 'text-deep' : 'text-ink')}>{badge}</Text>
        </View>
      </View>
      <View className="flex-row items-center justify-between gap-2 rounded-xl border border-sky-300/60 bg-sky-50 px-3 py-1.5">
        <Text className="flex-1 text-[12px] leading-[18px] text-[#4c4546]">{row.reason}</Text>
        <View className="flex-row items-center gap-1">
          {vitals ? <Icon name="vitals-done" /> : null}
          <Text className={cn('text-[11px] leading-4', vitals ? 'font-pj-bd text-teal' : 'font-pj-md text-slate')}>{vitals ?? (waiting ? 'In lounge' : '')}</Text>
        </View>
      </View>
      {allergy ? <Text className="text-[11px] leading-4 text-danger">Severe allergy: {allergy.substance}</Text> : null}
      {waiting || inRoom ? (
        <View className="flex-row gap-2">
          <Button
            label={inRoom ? 'Resume Consultation' : 'Start Consultation'}
            iconLeft="play-white"
            size="sm"
            className="flex-1 rounded-xl"
            loading={busy === row.id}
            onPress={() => start(row)}
          />
          <Button label="Chart" variant="soft" size="sm" className="rounded-xl" onPress={openChart} />
        </View>
      ) : (
        <View className="flex-row gap-2">
          <Button label="View Chart" variant="soft" size="sm" className="flex-1 rounded-xl border-sky-300 bg-sky-300" onPress={openChart} />
          <Button label="Visit" variant="outline" size="sm" className="rounded-xl border-ink" onPress={() => router.push(`/appointment/${row.id}`)} />
        </View>
      )}
    </View>
  );
}
