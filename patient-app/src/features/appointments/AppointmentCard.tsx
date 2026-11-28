import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { fullDay } from '@/lib/dates';
import { addressText, clock, doctorLine, isUpcoming, relativeDay, STATUS_TEXT, statusTone } from '@/lib/visit';
import type { Appointment } from '@/types';

const open = (id: string) => router.push(`/appointments/${id}`);
const reschedule = (id: string) => router.push(`/reschedule/${id}`);

const label = 'font-pj-sb text-[10px] leading-[15px] text-slate';

/** The highlighted card for the soonest visit. */
export function NextVisitCard({ appointment, onMore }: { appointment: Appointment; onMore: () => void }) {
  return (
    <View className="gap-3 rounded-2xl border border-[#a8cec6]/70 bg-white p-4">
      <View className="flex-row items-center justify-between border-b border-line/20 pb-3">
        <View className="flex-row items-center gap-1.5">
          <View className="size-2.5 rounded-full bg-[#00201c]" />
          <Text className="font-pj-bd text-[11px] leading-[14px] tracking-[0.3px] text-ink">
            NEXT IMMEDIATE VISIT
          </Text>
        </View>
        <View className="rounded-full bg-mint px-2.5 py-0.5">
          <Text className="font-pj-sb text-[11px] leading-[14px] text-[#00201c]">
            {relativeDay(appointment.date)}
          </Text>
        </View>
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Text className="font-pj-md text-[11px] leading-[14px] text-slate">{appointment.branch.name}</Text>
          <Text className="font-pj-bd text-[18px] leading-[23px] tracking-[-0.2px] text-ink">
            {appointment.clinicName}
          </Text>
          <View className="flex-row gap-1 pt-1">
            <Icon name="pin-slate" />
            <Text className="flex-1 text-[13px] leading-[18px] text-slate">{addressText(appointment.branch)}</Text>
          </View>
        </View>
        <View className="size-10 items-center justify-center rounded-xl border border-line/30 bg-sky-200">
          <Icon name="hospital-white" color="#000000" />
        </View>
      </View>
      <View className="gap-2 rounded-xl border border-line/25 bg-sky-50 p-3">
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Text className={label}>SERVICE</Text>
            <Text className="pt-1 font-pj-sb text-[14px] leading-5 text-ink">
              {appointment.serviceName ?? appointment.practitioner.department}
            </Text>
            <Text className="text-[11px] leading-[17px] text-slate">{appointment.practitioner.department}</Text>
          </View>
          <View className="flex-1">
            <Text className={label}>BOOKING REFERENCE</Text>
            <Text className="pt-1 font-pj-sb text-[14px] leading-5 text-ink">#{appointment.reference}</Text>
            <Text className="text-[11px] leading-[17px] text-[#668b83]">{STATUS_TEXT[appointment.status]}</Text>
          </View>
        </View>
        <View className="flex-row gap-2 border-t border-line/20 pt-2">
          <Icon name="schedule-clock" />
          <View className="flex-1">
            <Text className="font-pj-bd text-[13px] leading-5 text-ink">
              {fullDay(appointment.date)} · {clock(appointment.time)} – {clock(appointment.endTime)}
            </Text>
            <Text className="text-[12px] leading-[18px] text-slate">For {appointment.patientName}</Text>
          </View>
        </View>
      </View>
      <View className="flex-row items-center gap-2 rounded-xl border border-[#a8cec6]/60 bg-mint/30 px-3 py-2">
        <Icon name="triage-note" color="#294d47" />
        <Text className="flex-1 font-pj-sb text-[13px] leading-4 tracking-[0.3px] text-[#294d47]">
          {doctorLine(appointment.practitioner)}
        </Text>
        <View className="size-2 rounded-full bg-[#a8cec6]" />
      </View>
      {appointment.queueToken ? (
        <View className="flex-row items-center gap-2 rounded-xl border border-line/20 bg-sky-200/70 px-3 py-2">
          <Icon name="qr-scan" />
          <Text className="flex-1 font-pj-bd text-[11px] leading-[14px] text-ink">
            Queue token {appointment.queueToken}
          </Text>
        </View>
      ) : null}
      <View className="flex-row gap-2 border-t border-line/20 pt-3">
        <Button label="View Details" iconRight="arrow-forward-white" size="md" className="flex-1" onPress={() => open(appointment.id)} />
        {appointment.canReschedule ? (
          <Button label="Reschedule" variant="soft" size="md" className="border-line/60 bg-sky-50" onPress={() => reschedule(appointment.id)} />
        ) : null}
        {appointment.canCancel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More actions"
            onPress={onMore}
            className="size-11 items-center justify-center rounded-xl border border-line/60 bg-sky-50">
            <Icon name="more-horizontal" />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/** The compact card used for later, past and cancelled visits. */
export function AppointmentCard({ appointment }: { appointment: Appointment }) {
  const upcoming = isUpcoming(appointment);
  return (
    <View className="gap-2.5 rounded-2xl border border-line/40 bg-white p-4">
      <View className="flex-row items-center justify-between gap-2 border-b border-line/20 pb-2.5">
        <Pill label={STATUS_TEXT[appointment.status]} tone={statusTone(appointment.status)} />
        {upcoming ? <Pill label={relativeDay(appointment.date)} tone="sky" /> : null}
      </View>
      <View>
        <Text className="font-pj-md text-[11px] leading-[14px] text-slate">{appointment.branch.name}</Text>
        <Text className="font-pj-bd text-[18px] leading-[23px] tracking-[-0.2px] text-ink">
          {appointment.clinicName}
        </Text>
        <Text className="text-[13px] leading-[18px] text-slate">{addressText(appointment.branch)}</Text>
      </View>
      <View className="gap-2 rounded-xl border border-line/20 bg-sky-50 p-3">
        <View className="flex-row items-start gap-2">
          <Icon name="calendar-outline" color="#000000" />
          <Text className="flex-1 font-pj-bd text-[14px] leading-5 text-ink">
            {fullDay(appointment.date)} · {clock(appointment.time)}
          </Text>
          <Text className="text-[11px] leading-[17px] text-slate">#{appointment.reference}</Text>
        </View>
        <View className="flex-row justify-between gap-2 border-t border-line/15 pt-1.5">
          <Text className="flex-1 text-[12px] leading-[18px] text-slate">
            {appointment.serviceName ?? appointment.practitioner.department} · {appointment.patientName}
          </Text>
          {appointment.queueToken ? (
            <Text className="font-pj-bd text-[12px] leading-[18px] text-ink">Token {appointment.queueToken}</Text>
          ) : null}
        </View>
      </View>
      {appointment.cancelReason ? (
        <Text className="text-[12px] leading-[18px] text-slate">Reason: {appointment.cancelReason}</Text>
      ) : null}
      {upcoming && appointment.canReschedule ? (
        <View className="flex-row gap-2 border-t border-line/20 pt-3">
          <Button
            label="View Details"
            iconRight="chevron-right-ink"
            variant="soft"
            size="md"
            className="min-h-[40px] flex-1 border-line/60 bg-sky-50"
            onPress={() => open(appointment.id)}
          />
          <Button
            label="Reschedule"
            variant="soft"
            size="md"
            className="min-h-[40px] flex-1 border-line/60 bg-sky-50"
            textClassName="font-pj-md text-slate"
            onPress={() => reschedule(appointment.id)}
          />
        </View>
      ) : (
        <Button label="View Details" variant="soft" size="md" className="min-h-[40px] border-line/60 bg-sky-50" onPress={() => open(appointment.id)} />
      )}
    </View>
  );
}
