import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { AppointmentGate } from '@/features/appointments/AppointmentGate';
import { dayMonth, parseDay, weekday } from '@/lib/dates';
import { addressText, clock, doctorLine, feeText } from '@/lib/visit';
import type { Appointment } from '@/types';

const caption = 'font-pj-sb text-[10px] leading-[15px] tracking-[0.5px] text-slate';

export default function AppointmentConfirmed() {
  return (
    <AppointmentGate title="Booking" inTabs={false}>
      {(appointment) => <Confirmed appointment={appointment} />}
    </AppointmentGate>
  );
}

function Confirmed({ appointment }: { appointment: Appointment }) {
  const toast = useToast();
  const copy = async () => {
    await Clipboard.setStringAsync(appointment.reference);
    toast('Booking reference copied.');
  };

  return (
    <Screen contentClassName="items-stretch gap-6 pt-6 pb-6">
      <View className="items-center gap-3">
        <View className="size-24 items-center justify-center rounded-full border border-teal-200/60 bg-teal-100/80">
          <View className="size-20 items-center justify-center rounded-full border border-teal-200/80 bg-teal-50">
            <LinearGradient
              colors={['#006a61', '#182d35']}
              style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="check-large-white" />
            </LinearGradient>
          </View>
        </View>
        <Text accessibilityRole="header" className="text-center font-pj-bd text-[26px] leading-9 tracking-[-0.6px] text-heading">
          Appointment Confirmed
        </Text>
        <Text className="text-center text-[13px] leading-[21px] text-slate">
          Your booking is in the schedule at{' '}
          <Text className="font-pj-sb text-[13px] text-heading">{appointment.clinicName}</Text>.
        </Text>
      </View>

      <View className="overflow-hidden rounded-2xl border border-teal-200 bg-white">
        <View className="gap-1 bg-heading p-3">
          <Text className="font-pj-bd text-[15px] leading-5 text-white">{appointment.clinicName}</Text>
          <Text className="text-[11px] leading-[17px] text-white/80">{appointment.branch.name}</Text>
        </View>
        <View className="flex-row items-center justify-between border-b border-sky-250/60 bg-sky-50 px-4 py-2.5">
          <Pressable accessibilityRole="button" accessibilityLabel={`Copy booking reference ${appointment.reference}`} onPress={copy}>
            <Text className={caption}>BOOKING REFERENCE</Text>
            <View className="flex-row items-center gap-1.5">
              <Text className="font-pj-bd text-[14px] leading-[21px] text-heading">#{appointment.reference}</Text>
              <Icon name="copy" />
            </View>
          </Pressable>
          <View className="items-end">
            <Text className={caption}>PATIENT</Text>
            <Text className="font-pj-sb text-[11px] leading-[17px] text-heading">{appointment.patientName}</Text>
          </View>
        </View>
        <View className="gap-3.5 p-4">
          <View className="flex-row gap-2.5">
            <View className="flex-1 rounded-xl border border-sky-250 bg-sky-50 p-3">
              <Text className={caption}>CONSULTATION DATE</Text>
              <Text className="pt-1 font-pj-bd text-[16px] leading-5 text-heading">
                {weekday(appointment.date)}, {dayMonth(appointment.date)}
              </Text>
              <Text className="font-pj-md text-[11px] leading-[17px] text-slate">{parseDay(appointment.date).getFullYear()}</Text>
            </View>
            <View className="flex-1 rounded-xl border border-sky-250 bg-sky-50 p-3">
              <Text className={caption}>TIME</Text>
              <Text className="pt-1 font-pj-bd text-[16px] leading-5 text-teal">{clock(appointment.time)}</Text>
              <Text className="font-pj-md text-[11px] leading-[17px] text-slate">to {clock(appointment.endTime)}</Text>
            </View>
          </View>
          <View className="flex-row gap-2.5 rounded-xl border border-teal-200/60 bg-teal-100/50 p-3">
            <View className="size-7 items-center justify-center rounded-lg bg-teal">
              <Icon name="lab-desk" color="#ffffff" />
            </View>
            <View className="flex-1">
              <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">
                {appointment.serviceName ?? appointment.practitioner.department}
              </Text>
              <Text className="text-[11px] leading-[17px] text-slate">{addressText(appointment.branch)}</Text>
            </View>
          </View>
          <View className="flex-row gap-2.5 rounded-xl border border-sky-250 bg-sky-50 p-3">
            <Icon name="group-teal" />
            <View className="flex-1">
              <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">{doctorLine(appointment.practitioner)}</Text>
              <Text className="text-[11px] leading-[15px] text-slate">{appointment.practitioner.specialty}</Text>
            </View>
          </View>
          <View className="border-t-2 border-dashed border-teal-200/80 pt-3">
            <Text className="text-[10px] leading-4 text-slate">
              CONSULTATION FEE:{' '}
              <Text className="font-pj-bd text-[13px] text-heading">{feeText(appointment.fee)}</Text> (pay at the clinic)
            </Text>
          </View>
        </View>
      </View>

      <Text className="text-[12px] leading-[18px] text-slate">
        Give your booking reference at reception when you arrive. You get your queue token when you are checked in.
      </Text>

      <View className="gap-2.5">
        <Button
          label="View My Appointment"
          iconRight="arrow-forward-white"
          onPress={() => {
            router.dismissAll();
            router.push(`/appointments/${appointment.id}`);
          }}
        />
        <Button
          label="Back to Home Dashboard"
          variant="outline"
          className="border-edge"
          textClassName="font-pj text-heading"
          onPress={() => router.dismissTo('/home')}
        />
      </View>
    </Screen>
  );
}
