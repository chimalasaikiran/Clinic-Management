import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppHeader, goBack } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { AppointmentGate } from '@/features/appointments/AppointmentGate';
import { Calendar } from '@/features/booking/Calendar';
import { SlotPicker } from '@/features/booking/SlotPicker';
import { useResource } from '@/hooks/useResource';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { addDays, dayMonth, fullDay, longWeekday, weekday } from '@/lib/dates';
import { addressText, clinicToday, clock, doctorLine } from '@/lib/visit';
import { useSession } from '@/state/SessionState';
import type { Appointment, Slots } from '@/types';
import type { IconName } from '@/theme/icons';

const card = 'gap-3 rounded-2xl border border-line/40 bg-white p-4';
const sectionTitle = 'font-pj-sb text-[18px] leading-6 text-ink';

function CurrentRow({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <View className="flex-row gap-3">
      <View className="size-8 items-center justify-center rounded-lg bg-sky-150">
        <Icon name={icon} />
      </View>
      <View className="flex-1">
        <Text className="font-pj-md text-[14px] leading-5 text-ink">{title}</Text>
        <Text className="text-[13px] leading-[18px] text-slate">{body}</Text>
      </View>
    </View>
  );
}

export default function Reschedule() {
  return (
    <AppointmentGate title="Reschedule" inTabs={false}>
      {(appointment) => <RescheduleForm appointment={appointment} />}
    </AppointmentGate>
  );
}

function RescheduleForm({ appointment }: { appointment: Appointment }) {
  const { call } = useSession();
  const [date, setDate] = useState(() => (appointment.date > clinicToday() ? appointment.date : addDays(clinicToday(), 1)));
  const [time, setTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const slots = useResource<Slots>(
    appointment.canReschedule ? `/v1/patient/appointments/${appointment.id}/slots?from=${date}&days=1` : null,
    ['appointments'],
  );

  if (!appointment.canReschedule) {
    return (
      <Screen header={<AppHeader title="Reschedule" />}>
        <ErrorState
          title="This visit cannot be moved here"
          message="Call the clinic to change this appointment."
          actionLabel="My appointments"
          onAction={() => router.dismissTo('/appointments')}
        />
      </Screen>
    );
  }

  const isCurrent = (value: string) => date === appointment.date && value === appointment.time;
  const open = slots.data?.days[0]?.slots.some((slot) => slot.time === time && slot.available) ?? false;
  const chosen = time && open && !isCurrent(time) ? time : null;

  const confirm = async () => {
    if (!chosen) return;
    setSaving(true);
    setFailure('');
    try {
      await call(`/v1/patient/appointments/${appointment.id}/reschedule`, { method: 'POST', body: { date, time: chosen } });
      router.dismissAll();
      router.push(`/appointments/${appointment.id}/rescheduled`);
    } catch (error) {
      setFailure(errorMessage(error));
      setSaving(false);
      slots.reload();
    }
  };

  return (
    <Screen
      className="bg-sky-50"
      header={<AppHeader title="Reschedule" subtitle={`${appointment.branch.name} · #${appointment.reference}`} />}
      footer={
        <View className="gap-2">
          {failure ? (
            <Text accessibilityRole="alert" className="text-[13px] leading-[18px] text-[#ba1a1a]">
              {failure}
            </Text>
          ) : null}
          <View className="flex-row gap-3">
            <Button label="Keep Current" variant="outline" onPress={goBack} />
            <Button
              label="Confirm Slot"
              iconRight="arrow-forward-white"
              className="flex-1"
              textClassName="font-pj-bd"
              disabled={!chosen}
              loading={saving}
              onPress={confirm}
            />
          </View>
        </View>
      }
      contentClassName="gap-5 pt-4 pb-6">
      <View>
        <Text className="font-pj-bd text-[11px] leading-[14px] text-slate">
          {(appointment.serviceName ?? appointment.practitioner.department).toUpperCase()}
        </Text>
        <Text accessibilityRole="header" className="pt-1 font-pj-bd text-[22px] leading-7 text-ink">
          Select New Slot
        </Text>
        <Text className="text-[13px] leading-[18px] text-slate">
          For patient <Text className="font-pj-md text-[13px] text-ink">{appointment.patientName}</Text>
        </Text>
      </View>

      <View className={cn(card, 'bg-sky-50')}>
        <View className="flex-row items-center gap-2 border-b border-line/20 pb-2">
          <View className="size-2 rounded-full bg-slate" />
          <Text className="font-pj-bd text-[11px] leading-[14px] text-slate">CURRENT APPOINTMENT</Text>
        </View>
        <CurrentRow icon="clinic-building" title={appointment.clinicName} body={addressText(appointment.branch)} />
        <CurrentRow
          icon="schedule-clock"
          title={`${fullDay(appointment.date)} · ${clock(appointment.time)} – ${clock(appointment.endTime)}`}
          body={doctorLine(appointment.practitioner)}
        />
        <View className="flex-row gap-2.5 rounded-xl border border-line/30 bg-white p-2.5">
          <Icon name="triage-note" />
          <Text className="flex-1 text-[13px] leading-[18px] text-slate">
            You keep the same clinician if they are free at the new time. Otherwise another one in the department is assigned.
          </Text>
        </View>
      </View>

      <View className="gap-3">
        <Text className={sectionTitle}>1. Select New Date</Text>
        <Calendar
          selected={date}
          current={appointment.date}
          onSelect={(next) => {
            setDate(next);
            setTime(null);
          }}
        />
      </View>

      <View className="gap-4">
        <View>
          <Text className={sectionTitle}>2. Choose New Time</Text>
          <Text className="text-[13px] leading-[18px] text-slate">
            {longWeekday(date)}, {dayMonth(date)}
          </Text>
        </View>
        <SlotPicker slots={slots} selected={chosen} onSelect={setTime} />
        {time && isCurrent(time) ? (
          <Text className="text-[12px] leading-[18px] text-slate">That is the time you already have.</Text>
        ) : null}
      </View>

      {chosen ? (
        <View className="gap-3 rounded-2xl border border-[#a8cec6]/60 bg-mint/30 p-4">
          <Text className="font-pj-bd text-[11px] leading-[14px] text-[#00201c]">PROPOSED CHANGE</Text>
          <View className="flex-row gap-3">
            <View className="flex-1 rounded-xl border border-line/40 bg-white/90 p-3">
              <Text className="text-[10px] leading-[15px] text-slate">CURRENT</Text>
              <Text className="font-pj-sb text-[14px] leading-5 text-ink">
                {weekday(appointment.date)}, {dayMonth(appointment.date)}
              </Text>
              <Text className="text-[13px] leading-[18px] text-slate">{clock(appointment.time)}</Text>
              <Text className="text-[10px] leading-[15px] text-[#ba1a1a]">To be released</Text>
            </View>
            <View className="flex-1 rounded-xl border border-black bg-white p-3">
              <Text className="font-pj-bd text-[10px] leading-[15px] text-black">NEW SLOT</Text>
              <Text className="font-pj-bd text-[14px] leading-5 text-ink">
                {weekday(date)}, {dayMonth(date)}
              </Text>
              <Text className="font-pj-sb text-[14px] leading-5 text-black">{clock(chosen)}</Text>
            </View>
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
