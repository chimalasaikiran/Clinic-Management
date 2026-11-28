import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';

import { AppHeader, IconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { AppointmentGate } from '@/features/appointments/AppointmentGate';
import { dateTime, dayMonth, longWeekday, parseDay } from '@/lib/dates';
import { addressText, clock, directionsUrl, doctorLine, feeText, isUpcoming, relativeDay, STATUS_TEXT } from '@/lib/visit';
import { formatMobile } from '@/lib/validation';
import { useAccount } from '@/state/SessionState';
import type { Appointment, AppointmentEvent } from '@/types';

const card = 'gap-3 rounded-2xl border border-line/40 bg-white p-5';
const cardTitle = 'font-pj-bd text-[18px] leading-6 tracking-[-0.2px] text-ink';
const caption = 'font-pj-sb text-[11px] leading-[14px] tracking-[0.6px] text-slate';

const ACTIONS: Record<string, string> = {
  booked: 'Booked',
  walk_in: 'Checked in as a walk-in',
  confirm: 'Confirmed',
  reschedule: 'Moved',
  checkIn: 'Checked in',
  start: 'Consultation started',
  complete: 'Visit completed',
  cancel: 'Cancelled',
  noShow: 'Marked as missed',
};

const historyLine = (event: AppointmentEvent) =>
  `${ACTIONS[event.action] ?? STATUS_TEXT[event.status]} by ${event.by === 'you' ? 'you' : 'the clinic'}`;

export default function AppointmentDetails() {
  return <AppointmentGate title="Appointment Details">{(appointment) => <Details appointment={appointment} />}</AppointmentGate>;
}

function Details({ appointment }: { appointment: Appointment }) {
  const toast = useToast();
  const account = useAccount();
  const { branch, practitioner } = appointment;
  const upcoming = isUpcoming(appointment);
  const summary = `${appointment.clinicName}, ${longWeekday(appointment.date)} ${dayMonth(appointment.date)} at ${clock(appointment.time)}`;
  const openLink = (url: string) => Linking.openURL(url).catch(() => toast('This device cannot open that link.'));
  const copy = async () => {
    await Clipboard.setStringAsync(appointment.reference);
    toast('Booking reference copied.');
  };

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <AppHeader
          title="Appointment Details"
          right={<IconButton icon="share" label="Share appointment" onPress={() => Share.share({ message: summary })} />}
        />
      }
      contentClassName="gap-5 py-3 pb-6">
      <View className="overflow-hidden rounded-2xl border border-line/60 bg-white">
        <View className="h-36 justify-between p-3">
          <Image
            source={require('../../../../../assets/images/appointment-hero.jpg')}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.4)', '#ffffff']} style={StyleSheet.absoluteFill} />
          <View className="flex-row items-center gap-1.5 self-start rounded-full border border-line/30 bg-white/90 px-2.5 py-1">
            <View className="size-2 rounded-full bg-black" />
            <Text className="font-pj-bd text-[11px] leading-[17px] text-ink">{STATUS_TEXT[appointment.status].toUpperCase()}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Icon name="clinic-building" />
            <Text className="flex-1 font-pj-sb text-[12px] leading-[18px] text-slate">{appointment.clinicName}</Text>
          </View>
        </View>

        <View className="gap-1 px-5 pb-5 pt-2">
          <View className="flex-row items-center justify-between">
            <Text className="font-pj-bd text-[12px] leading-4 tracking-[0.6px] text-slate">CONSULTATION WINDOW</Text>
            {upcoming ? (
              <View className="rounded bg-sky-200/40 px-2 py-0.5">
                <Text className="font-pj-sb text-[11px] leading-[17px] text-slate">{relativeDay(appointment.date)}</Text>
              </View>
            ) : null}
          </View>
          <Text className="font-pj-bd text-[18px] leading-6 tracking-[-0.4px] text-ink">
            {longWeekday(appointment.date)}, {dayMonth(appointment.date)} {parseDay(appointment.date).getFullYear()}
          </Text>
          <Text className="font-pj-bd text-[30px] leading-[38px] tracking-[-0.7px] text-black">
            {clock(appointment.time)} <Text className="font-pj-md text-[18px] text-slate">to {clock(appointment.endTime)}</Text>
          </Text>
        </View>

        <View className="flex-row justify-between gap-3 border-t-2 border-dashed border-line/50 p-5">
          <View className="flex-1">
            <Text className={caption}>BOOKING REFERENCE</Text>
            <Text className="font-pj-bd text-[16px] leading-6 tracking-[0.8px] text-ink">#{appointment.reference}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy booking reference"
              onPress={copy}
              className="mt-1 flex-row items-center gap-1 self-start rounded-md border border-line px-2 py-0.5">
              <Icon name="copy" size={16} />
              <Text className="font-pj-sb text-[11px] leading-[17px] text-ink">Copy</Text>
            </Pressable>
          </View>
          <View className="items-end">
            <Text className={caption}>QUEUE TOKEN</Text>
            <Text className="font-pj-bd text-[18px] leading-6 text-black">{appointment.queueToken ?? 'At check-in'}</Text>
          </View>
        </View>
      </View>

      <View className="gap-3 rounded-2xl border border-teal-200 bg-teal-100 p-4">
        <View className="flex-row items-center gap-1.5">
          <Icon name="verified-user" color="#064e3b" />
          <Text className={caption}>ASSIGNED CLINICIAN</Text>
        </View>
        <View>
          <Text className="font-pj-sb text-[18px] leading-[25px] tracking-[-0.2px] text-ink">{doctorLine(practitioner)}</Text>
          <Text className="text-[14px] leading-5 text-slate">{practitioner.specialty}</Text>
          {practitioner.room ? <Text className="text-[13px] leading-[18px] text-slate">{practitioner.room}</Text> : null}
        </View>
      </View>

      <View className={card}>
        <View>
          <Text className={cardTitle}>{appointment.clinicName}</Text>
          <Text className={caption}>{branch.name.toUpperCase()}</Text>
        </View>
        <View className="flex-row gap-2.5">
          <Icon name="pin-slate" size={15} />
          <Text className="flex-1 text-[13px] leading-[18px] text-slate">{addressText(branch)}</Text>
        </View>
        <View className="flex-row gap-2.5 border-t border-line/30 pt-3">
          <Button
            label="Directions"
            iconLeft="directions"
            variant="soft"
            size="md"
            className="flex-1 border-line/60 bg-sky-200/30"
            onPress={() => openLink(directionsUrl(branch, appointment.clinicName))}
          />
          {branch.phone ? (
            <Button
              label="Call Clinic"
              iconLeft="call-small"
              variant="soft"
              size="md"
              className="flex-1 border-line/60 bg-sky-200/30"
              onPress={() => openLink(`tel:${branch.phone}`)}
            />
          ) : null}
        </View>
      </View>

      <View className={card}>
        <Text className={cardTitle}>Patient & Payment Profile</Text>
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-xl border border-line/30 bg-sky-100/40 p-3">
            <Text className={caption}>PATIENT NAME</Text>
            <Text className="pt-0.5 font-pj-bd text-[14px] leading-5 text-ink">{appointment.patientName}</Text>
            {account ? <Text className="text-[13px] leading-[18px] text-slate">+91 {formatMobile(account.mobile)}</Text> : null}
          </View>
          <View className="flex-1 rounded-xl border border-line/30 bg-sky-100/40 p-3">
            <Text className={caption}>PATIENT NUMBER</Text>
            <Text className="pt-0.5 font-pj-bd text-[14px] leading-5 text-ink">{appointment.mrn}</Text>
          </View>
        </View>
        <View className="rounded-xl border border-line/30 bg-sky-100/40 p-3.5">
          <Text className={caption}>CONSULTATION CHARGE</Text>
          <Text className={cardTitle}>{feeText(appointment.fee)}</Text>
          <Text className="mt-2 border-t border-line/20 pt-2 text-[13px] leading-[18px] text-slate">
            {appointment.serviceName ? `${appointment.serviceName}. ` : ''}Payment is made at the clinic.
          </Text>
        </View>
      </View>

      {appointment.events?.length ? (
        <View className={card}>
          <Text className={cardTitle}>Booking History</Text>
          {appointment.events.map((event) => (
            <View key={event.id} className="flex-row gap-2.5">
              <Icon name="history" color="#000000" />
              <View className="flex-1">
                <Text className="font-pj-sb text-[13px] leading-[18px] text-ink">{historyLine(event)}</Text>
                <Text className="text-[12px] leading-[18px] text-slate">{dateTime(event.at)}</Text>
              </View>
            </View>
          ))}
          {appointment.cancelReason ? (
            <Text className="text-[13px] leading-[18px] text-slate">Reason: {appointment.cancelReason}</Text>
          ) : null}
        </View>
      ) : null}

      {appointment.canReschedule || appointment.canCancel ? (
        <View className="gap-2.5">
          {appointment.canReschedule ? (
            <Button
              label="Reschedule Appointment"
              iconLeft="calendar-add-white"
              className="rounded-xl"
              textClassName="font-pj-bd"
              onPress={() => router.push(`/reschedule/${appointment.id}`)}
            />
          ) : null}
          {appointment.canCancel ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/appointments/${appointment.id}/cancel`)}
              className="flex-row items-center justify-center gap-1.5 py-2.5">
              <Icon name="cancel-circle" color="#ba1a1a" size={13} />
              <Text className="shrink font-pj-sb text-[11px] leading-[14px] tracking-[0.6px] text-[#ba1a1a]">
                Cancel Consultation Slot
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}
