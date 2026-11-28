import { router } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { AppointmentGate } from '@/features/appointments/AppointmentGate';
import { dayMonth, fullDay, longWeekday, parseDay } from '@/lib/dates';
import { addressText, clock, doctorLine, STATUS_TEXT } from '@/lib/visit';
import type { Appointment } from '@/types';

const label = 'text-[10px] leading-[15px] text-slate';

export default function Rescheduled() {
  return <AppointmentGate>{(appointment) => <RescheduledSummary appointment={appointment} />}</AppointmentGate>;
}

function RescheduledSummary({ appointment }: { appointment: Appointment }) {
  // The most recent move, from the booking's own history.
  const previous = [...(appointment.events ?? [])].reverse().find((event) => event.action === 'reschedule')?.from;

  return (
    <Screen inTabs className="bg-sky-50" contentClassName="gap-5 pt-6 pb-6">
      <View className="items-center gap-2">
        <View className="size-20 items-center justify-center rounded-full bg-mint/30">
          <View className="size-14 items-center justify-center rounded-full bg-[#00201c]">
            <Icon name="check-large-white" />
          </View>
        </View>
        <Text accessibilityRole="header" className="text-center font-pj-sb text-[22px] leading-7 text-ink">
          Appointment Rescheduled!
        </Text>
        <Text className="text-center text-[14px] leading-5 text-slate">The clinic’s schedule has been updated.</Text>
      </View>

      <View className="overflow-hidden rounded-2xl border border-line/40 bg-white">
        <View className="gap-2 px-4 pt-4">
          <Text className={label}>CLINIC</Text>
          <Text className="font-pj-bd text-[18px] leading-6 text-ink">{appointment.clinicName}</Text>
          <View className="flex-row gap-1">
            <Icon name="pin-slate" />
            <Text className="flex-1 text-[13px] leading-[18px] text-slate">{addressText(appointment.branch)}</Text>
          </View>
          <View className="flex-row items-center gap-1.5 self-start rounded-lg bg-sky-150 px-2.5 py-1">
            <Icon name="stethoscope" />
            <Text className="text-[12px] leading-4 text-ink">
              {appointment.serviceName ?? appointment.practitioner.department} · {doctorLine(appointment.practitioner)}
            </Text>
          </View>
        </View>
        <View className="gap-3.5 p-4">
          <View className="gap-1 rounded-xl border border-[#a8cec6]/70 bg-white p-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-[11px] leading-4 text-slate">UPDATED SLOT</Text>
              <View className="rounded-full bg-[#00201c] px-2 py-0.5">
                <Text className="font-pj-bd text-[10px] leading-[15px] text-mint">{STATUS_TEXT[appointment.status]}</Text>
              </View>
            </View>
            <Text className="font-pj-bd text-[22px] leading-7 text-ink">
              {longWeekday(appointment.date)}, {dayMonth(appointment.date)} {parseDay(appointment.date).getFullYear()}
            </Text>
            <Text className="font-pj-bd text-[18px] leading-6 text-ink">
              {clock(appointment.time)} – {clock(appointment.endTime)} <Text className="text-[11px] text-slate">(IST)</Text>
            </Text>
          </View>
          <View className="rounded-xl border border-line/20 bg-sky-150/60 p-2.5">
            <Text className={label}>BOOKING REFERENCE</Text>
            <Text className="font-pj-bd text-[13px] leading-5 text-ink">#{appointment.reference}</Text>
          </View>
          {previous ? (
            <View className="rounded-xl border border-[#ffdad6]/50 bg-[#ffdad6]/20 p-2.5">
              <Text className="font-pj-bd text-[10px] leading-[15px] text-[#ba1a1a]">PREVIOUS SLOT (RELEASED)</Text>
              <Text className="font-pj-md text-[13px] leading-[18px] text-ink line-through">
                {fullDay(previous.date)} · {clock(previous.time)}
              </Text>
            </View>
          ) : null}
        </View>
        <View className="border-t border-dashed border-line/50 bg-sky-150/40 px-4 py-2.5">
          <Text className="text-[12px] leading-4 text-slate">
            Patient: <Text className="font-pj-md text-[12px] text-ink">{appointment.patientName}</Text>
          </Text>
        </View>
      </View>

      <View className="gap-2.5">
        <Button
          label="View Updated Appointment"
          iconRight="arrow-forward-white"
          onPress={() => router.dismissTo(`/appointments/${appointment.id}`)}
        />
        <Button
          label="Back to Home"
          iconLeft="tab-home"
          iconColor="#081e26"
          variant="soft"
          className="border-line/30 bg-sky-150"
          textClassName="font-pj text-[14px]"
          onPress={() => router.navigate('/home')}
        />
      </View>
    </Screen>
  );
}
