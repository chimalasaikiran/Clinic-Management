import { router } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { AppointmentGate } from '@/features/appointments/AppointmentGate';
import { dayMonth, longWeekday, parseDay } from '@/lib/dates';
import { addressText, clock } from '@/lib/visit';
import type { Appointment } from '@/types';

const tile = 'flex-1 gap-0.5 rounded-xl border border-line/20 bg-sky-100 p-2.5';
const label = 'text-[10px] leading-[15px] text-slate';

export default function Cancelled() {
  return <AppointmentGate>{(appointment) => <CancelledSummary appointment={appointment} />}</AppointmentGate>;
}

function CancelledSummary({ appointment }: { appointment: Appointment }) {
  return (
    <Screen inTabs className="bg-sky-50" contentClassName="gap-5 pt-5 pb-6">
      <View className="items-center gap-2">
        <View className="size-16 items-center justify-center rounded-full border border-line/40 bg-sky-150">
          <Icon name="calendar-cancelled" />
        </View>
        <Text accessibilityRole="header" className="text-center font-pj-bd text-[26px] leading-[34px] text-ink">
          Appointment Cancelled
        </Text>
        <Text className="text-center text-[14px] leading-5 text-slate">
          The clinic’s schedule has been updated and this time has been released.
        </Text>
      </View>

      <View className="gap-3.5 rounded-2xl border border-line/30 bg-white p-4">
        <View className="flex-row gap-3 border-b border-line/20 pb-3">
          <View className="size-10 items-center justify-center rounded-xl border border-line/30 bg-sky-150">
            <Icon name="clinic-building" />
          </View>
          <View className="flex-1">
            <Text className="font-pj-sb text-[18px] leading-6 text-ink">{appointment.clinicName}</Text>
            <Text className="text-[13px] leading-[18px] text-slate">{addressText(appointment.branch)}</Text>
          </View>
          <View className="self-start rounded-full border border-line/40 bg-sky-200 px-2.5 py-0.5">
            <Text className="font-pj-bd text-[10px] leading-[15px] text-ink">CANCELLED</Text>
          </View>
        </View>
        <View className="flex-row gap-2.5">
          <View className={tile}>
            <Text className={label}>SERVICE</Text>
            <Text className="font-pj-sb text-[14px] leading-5 text-ink">
              {appointment.serviceName ?? appointment.practitioner.department}
            </Text>
          </View>
          <View className={tile}>
            <Text className={label}>BOOKING REFERENCE</Text>
            <Text className="font-pj-sb text-[14px] leading-5 text-ink">#{appointment.reference}</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2.5 rounded-xl border border-line/30 bg-sky-100 p-3">
          <View className="size-8 items-center justify-center rounded-lg bg-sky-150">
            <Icon name="calendar-outline" />
          </View>
          <View className="flex-1">
            <Text className="font-pj-md text-[14px] leading-5 text-slate line-through">
              {longWeekday(appointment.date)}, {dayMonth(appointment.date)} {parseDay(appointment.date).getFullYear()}
            </Text>
            <Text className="text-[13px] leading-[18px] text-slate line-through">
              {clock(appointment.time)} – {clock(appointment.endTime)} IST
            </Text>
          </View>
        </View>
        <View className="border-t border-line/20 pt-2">
          <Text className={label}>PATIENT</Text>
          <Text className="font-pj-md text-[14px] leading-5 text-ink">{appointment.patientName}</Text>
          {appointment.cancelReason ? <Text className="text-[13px] leading-[18px] text-slate">Reason: {appointment.cancelReason}</Text> : null}
        </View>
      </View>

      <View className="flex-row gap-3 rounded-2xl border border-line/30 bg-white p-3.5">
        <View className="size-10 items-center justify-center rounded-xl bg-sky-150">
          <Icon name="service-records" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="font-pj-sb text-[15px] leading-5 text-ink">Kept in your history</Text>
          <Text className="text-[13px] leading-[18px] text-slate">
            This booking stays under Cancelled in My Appointments. If you paid the clinic anything in advance, ask its reception desk about it.
          </Text>
        </View>
      </View>

      <View className="gap-2.5">
        <Button label="Book Another Appointment" iconLeft="calendar-add-white" onPress={() => router.push('/clinics')} />
        <Button
          label="Back to My Appointments"
          iconLeft="arrow-back"
          variant="outline"
          className="border-line/40"
          textClassName="font-pj-md"
          onPress={() => router.dismissTo('/appointments')}
        />
      </View>
    </Screen>
  );
}
