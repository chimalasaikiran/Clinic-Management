import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { AppHeader, goBack } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ErrorState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { AppointmentGate } from '@/features/appointments/AppointmentGate';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fullDay } from '@/lib/dates';
import { addressText, clock, feeText } from '@/lib/visit';
import { useSession } from '@/state/SessionState';
import type { Appointment } from '@/types';

// Sent to the clinic as written, which keeps up to 120 characters.
const REASON_LIMIT = 120;

const reasons = [
  'Schedule conflict or unexpected emergency',
  'Health condition resolved / feeling better',
  'Prefer to reschedule for a later date',
  'Consulting another clinic or physician',
  'Other reason',
];

const label = 'font-pj-bd text-[11px] leading-[14px] text-slate';

export default function CancelAppointment() {
  return <AppointmentGate title="Cancel Appointment">{(appointment) => <CancelForm appointment={appointment} />}</AppointmentGate>;
}

function CancelForm({ appointment }: { appointment: Appointment }) {
  const { call } = useSession();
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  if (!appointment.canCancel) {
    // Also what is briefly true right after cancelling, while the app moves on to the confirmation.
    return (
      <Screen inTabs header={<AppHeader title="Cancel Appointment" />}>
        <ErrorState
          title="This visit cannot be cancelled here"
          message="Only upcoming appointments can be cancelled in the app. Call the clinic if you need help."
          actionLabel="My appointments"
          onAction={() => router.dismissTo('/appointments')}
        />
      </Screen>
    );
  }

  const confirm = async () => {
    if (!reason) {
      setError('Choose a reason for cancelling.');
      return;
    }
    if (reason === 'Other reason' && !other.trim()) {
      setError('Write your reason below.');
      return;
    }
    setCancelling(true);
    setError('');
    try {
      await call(`/v1/patient/appointments/${appointment.id}/cancel`, {
        method: 'POST',
        body: { reason: reason === 'Other reason' ? other.trim() : reason },
      });
      router.replace(`/appointments/${appointment.id}/cancelled`);
    } catch (failure) {
      setError(errorMessage(failure));
      setCancelling(false);
    }
  };

  return (
    <Screen
      inTabs
      header={<AppHeader title="Cancel Appointment" subtitle={`Booking #${appointment.reference}`} />}
      contentClassName="gap-4 pb-6">
      <Text className="font-pj-md text-[14px] leading-5 text-ink">For {appointment.patientName}</Text>

      <View className="gap-3 rounded-[20px] border border-[#a8cec6]/50 bg-sky-100 p-4">
        <View className="self-start rounded-full bg-[#ffdad6] px-2.5 py-1">
          <Text className="font-pj-bd text-[11px] leading-[14px] text-[#93000a]">APPOINTMENT TO BE CANCELLED</Text>
        </View>
        <View className="gap-0.5">
          <Text className="font-pj-sb text-[18px] leading-6 text-black">{appointment.clinicName}</Text>
          <Text className="text-[13px] leading-[18px] text-slate">{addressText(appointment.branch)}</Text>
        </View>
        <View className="flex-row gap-2 border-t border-line/30 pt-2">
          <View className="flex-1 gap-0.5 rounded-xl bg-white/80 p-2.5">
            <Text className={label}>SERVICE</Text>
            <Text className="font-pj-md text-[14px] leading-5 text-black">
              {appointment.serviceName ?? appointment.practitioner.department}
            </Text>
            <Text className="text-[11px] leading-4 text-slate">{appointment.practitioner.displayName}</Text>
          </View>
          <View className="flex-1 gap-0.5 rounded-xl bg-white/80 p-2.5">
            <Text className={label}>SCHEDULE</Text>
            <Text className="font-pj-md text-[14px] leading-5 text-black">{fullDay(appointment.date)}</Text>
            <Text className="text-[11px] leading-4 text-slate">
              {clock(appointment.time)} – {clock(appointment.endTime)}
            </Text>
          </View>
        </View>
        <View className="flex-row justify-between gap-3 rounded-xl border border-[#a8cec6]/40 bg-mint/30 p-2.5">
          <Text className={label}>Consultation Fee</Text>
          <Text className="font-pj-sb text-[14px] leading-5 text-black">{feeText(appointment.fee)}</Text>
        </View>
      </View>

      {appointment.canReschedule ? (
        <View className="gap-1 rounded-[18px] border border-[#b4cad4] bg-sky-300/40 p-4">
          <Text className="font-pj-sb text-[14px] leading-5 text-black">Need to see the doctor at another time?</Text>
          <Text className="text-[13px] leading-[18px] text-slate">
            You can move this appointment to another date or time instead of cancelling.
          </Text>
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => router.push(`/reschedule/${appointment.id}`)}
            className="self-start pt-1">
            <Text className="font-pj-bd text-[13px] leading-[18px] text-black">Reschedule Appointment instead →</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="gap-3">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="font-pj-sb text-[15px] leading-5 text-black">Reason for Cancellation</Text>
          <View className="rounded-full bg-sky-200 px-2 py-0.5">
            <Text className={label}>Shared with the clinic</Text>
          </View>
        </View>
        <View accessibilityRole="radiogroup" className="gap-2">
          {reasons.map((item) => {
            const active = item === reason;
            return (
              <Pressable
                key={item}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => {
                  setReason(item);
                  setError('');
                }}
                className={cn('flex-row items-center gap-3 rounded-2xl border bg-white p-3.5', active ? 'border-black' : 'border-line/50')}>
                <View className={cn('size-5 items-center justify-center rounded-full', active ? 'bg-black' : 'border border-line')}>
                  {active ? <View className="size-2 rounded-full bg-white" /> : null}
                </View>
                <Text className="flex-1 font-pj-md text-[14px] leading-5 text-black">{item}</Text>
              </Pressable>
            );
          })}
        </View>
        {reason === 'Other reason' ? (
          <TextField
            label="YOUR REASON"
            labelClassName={label}
            placeholder="Tell the clinic why you are cancelling"
            value={other}
            onChangeText={(value) => {
              setOther(value);
              setError('');
            }}
            maxLength={REASON_LIMIT}
            multiline
            inputClassName="min-h-[56px] text-[13px]"
          />
        ) : null}
      </View>

      <View className="flex-row gap-2.5 rounded-xl border border-[#ba1a1a]/20 bg-[#ffdad6]/40 p-3">
        <Icon name="warning-red" />
        <Text className="flex-1 text-[13px] leading-[18px] text-ink">
          Once cancelled, this time is released for other patients and may not be available again.
        </Text>
      </View>

      <View className="gap-2.5">
        {error ? (
          <Text accessibilityRole="alert" className="text-[13px] leading-[18px] text-[#ba1a1a]">
            {error}
          </Text>
        ) : null}
        <Button
          label="Confirm Cancellation"
          iconLeft="cancel-white"
          variant="danger"
          className="rounded-[18px]"
          textClassName="font-pj-bd"
          loading={cancelling}
          onPress={confirm}
        />
        <Button label="Keep Appointment" className="rounded-[18px]" onPress={goBack} />
      </View>
    </Screen>
  );
}
