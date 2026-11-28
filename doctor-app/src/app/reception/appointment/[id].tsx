import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Options } from '@/components/ui/Kit';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import {
  CANCEL_REASONS,
  clock,
  dayLabel,
  EVENT_LABEL,
  GENDER_LABEL,
  initialsOf,
  isOpen,
  localToday,
  NO_SHOW_REASONS,
  NOTE_MIN,
  phone,
  RESCHEDULE_REASONS,
  STATUS,
  telOf,
  TYPE_LABEL,
  useAppointmentAction,
  yearsOld,
  type Appointment,
  type Slots,
} from '@/features/reception/desk';
import { ActionButton, Avatar, Box, Chip, Glyph, IconTile, Mono, ProfileButton, ReceptionHeader, RoundButton, TearLine, Timeline, useDial } from '@/features/reception/ui';
import { useResource } from '@/hooks/useResource';
import { cn } from '@/lib/cn';
import { useSession } from '@/state/SessionState';

type SheetKind = 'reschedule' | 'cancel' | 'no-show' | null;

const SLOT_DAYS = 7;

export default function ReceptionAppointmentDetails() {
  const toast = useToast();
  const dial = useDial();
  const { can } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const appointment = useResource<Appointment>(`/v1/appointments/${id}`, ['appointments']);
  const action = useAppointmentAction();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  const visit = appointment.data;
  const slots = useResource<Slots>(
    sheet === 'reschedule' && visit
      ? `/v1/practitioners/${visit.practitioner.id}/slots?branchId=${visit.branch.id}&from=${localToday()}&days=${SLOT_DAYS}&excludeAppointmentId=${visit.id}`
      : null,
  );

  if (!visit) {
    return (
      <Screen className="bg-sky-50" header={<ReceptionHeader title="Appointment Details" subtitle="Front Desk" />} contentClassName="px-4 pt-3">
        {appointment.error ? (
          appointment.error.code === 'NOT_FOUND' ? (
            <EmptyState title="Appointment not found" message="It may have been removed, or it is outside your branches." actionLabel="Open Schedule" onAction={() => router.navigate('/reception/appointments')} />
          ) : (
            <ErrorState message={appointment.error.message} onAction={appointment.reload} />
          )
        ) : (
          <LoadingState label="Loading appointment…" />
        )}
      </Screen>
    );
  }

  const status = STATUS[visit.status];
  const open = isOpen(visit.status);
  const today = localToday();
  const when = `${dayLabel(visit.date, true)}, ${clock(visit.time)}`;

  const openSheet = (kind: Exclude<SheetKind, null>) => {
    setReason('');
    setNote('');
    setDate('');
    setTime('');
    setSheet(kind);
  };
  const share = () =>
    Share.share({ message: `Appointment ${visit.reference} · ${when} · ${visit.practitioner.displayName} · ${visit.branch.name}` }).catch(() =>
      toast('This device cannot share the details.'),
    );
  const finish = (updated: Appointment | null) => {
    if (!updated) return;
    setSheet(null);
    appointment.reload();
  };

  const noteShort = note.trim().length < NOTE_MIN;
  const day = slots.data?.days.find((entry) => entry.date === date);
  const milestones = (visit.events ?? []).map((event) => ({
    title: EVENT_LABEL[event.action] ?? event.action,
    time: `${dayLabel(event.date)}, ${clock(event.time)}`,
    body: [
      event.action === 'reschedule' && event.from && event.to ? `${dayLabel(event.from.date)} ${clock(event.from.time)} → ${dayLabel(event.to.date)} ${clock(event.to.time)}.` : null,
      event.reason,
      event.note,
      `By ${event.actor}.`,
    ]
      .filter(Boolean)
      .join(' '),
  }));

  return (
    <Screen
      className="bg-sky-50"
      header={
        <ReceptionHeader
          title="Appointment Details"
          subtitle={visit.branch.name}
          subtitleIcon="apartment"
          right={
            <>
              <RoundButton icon="share" label="Share details" onPress={share} />
              <ProfileButton initials />
            </>
          }
        />
      }
      footer={
        open ? (
          <View className="flex-row gap-2">
            {can('bookings.cancel') ? <ActionButton large label="Cancel" icon="highlight-off" tone="dangerLine" onPress={() => openSheet('cancel')} /> : null}
            {can('bookings.reschedule') ? <ActionButton large label="Reschedule" icon="schedule" onPress={() => openSheet('reschedule')} /> : null}
            {visit.date === today ? (
              <ActionButton large label="Check In" icon="how-to-reg" tone="dark" className="flex-1" onPress={() => router.push({ pathname: '/reception/check-in', params: { id: visit.id } })} />
            ) : null}
          </View>
        ) : (
          <ActionButton large tone="dark" label="Back to Schedule" onPress={() => router.navigate('/reception/appointments')} />
        )
      }
      contentClassName="gap-3 px-4 pt-3 pb-6">
      <View className="overflow-hidden rounded-2xl bg-white">
        <View className="flex-row items-start gap-3 bg-[#1f333b] p-4">
          <View className="flex-1">
            <Text className="font-pj-bd text-[11px] leading-4 text-white/60">APPOINTMENT</Text>
            <Text className="font-pj-bd text-[19px] leading-6 text-white">#{visit.reference}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Copy appointment reference"
            hitSlop={8}
            onPress={async () => {
              await Clipboard.setStringAsync(visit.reference);
              toast('Appointment reference copied.');
            }}
            className="size-8 items-center justify-center rounded-lg bg-white/10">
            <Glyph name="content-copy" size={14} color="#ffffff" />
          </Pressable>
          <Chip label={status.label} tone={status.tone} dot="#081e26" />
        </View>
        <View className="pt-3">
          <TearLine />
        </View>
        <View className="gap-3 p-4">
          {visit.queueToken ? (
            <View className="flex-row gap-2">
              <Chip label={`Token ${visit.queueToken}`} icon="confirmation-number" tone="mint" />
              {visit.arrivedAt ? <Chip label={`Arrived ${clock(visit.arrivedAt)}`} icon="how-to-reg" /> : null}
            </View>
          ) : null}
          <View className="flex-row items-center gap-3 rounded-2xl bg-sky-100 p-3">
            <IconTile icon="calendar-today" box="bg-white" className="size-10" />
            <View className="flex-1">
              <Text className="font-pj-md text-[15px] leading-5 text-ink">{dayLabel(visit.date, true)}</Text>
              <Text className="text-[12px] leading-[17px] text-slate">
                {visit.waitingQueue ? 'Walk-in queue' : `${clock(visit.time)} – ${clock(visit.endTime)}`} · {visit.durationMinutes} min
              </Text>
            </View>
            {open ? <Chip label="Slot Active" tone="dark" className="self-center" /> : null}
          </View>
          {visit.closedReason ? <Text className="text-[12px] leading-[17px] text-slate">Reason: {visit.closedReason}</Text> : null}
        </View>
      </View>

      <Box>
        <View className="flex-row items-center gap-3">
          <Avatar initials={initialsOf(visit.patient.fullName)} tone="deep" />
          <View className="flex-1">
            <Text className="font-pj-bd text-[16px] leading-[22px] text-ink">
              {visit.patient.fullName}{' '}
              <Text className="text-[11px] text-slate">
                • {yearsOld(visit.patient.dateOfBirth, today)}Y · {GENDER_LABEL[visit.patient.gender]}
              </Text>
            </Text>
            <Text className="text-[12px] leading-[17px] text-slate">Patient ID: {visit.patient.mrn}</Text>
          </View>
          <IconTile icon="lock-person" box="bg-sky-100" />
        </View>
        <View className="flex-row items-center gap-2 rounded-xl bg-sky-100 p-2.5">
          <Glyph name="smartphone" size={14} />
          <Text className="flex-1 text-[13px] leading-[18px] text-ink">{phone(visit.patient.mobile)}</Text>
          <ActionButton label="Call" icon="call" tone="white" onPress={() => dial(telOf(visit.patient.mobile))} />
        </View>
        <View className="flex-row gap-2 rounded-xl bg-sky-100 p-3">
          <Glyph name="privacy-tip" size={14} />
          <Text className="flex-1 text-[12px] leading-[17px] text-slate">
            Front Desk Privacy Scope: results, prescriptions and clinical notes are not shown at the desk.
          </Text>
        </View>
        <ActionButton label="View Patient File" iconRight="arrow-forward" onPress={() => router.push(`/reception/patient/${visit.patient.id}`)} />
      </Box>

      <Box>
        <View className="flex-row items-center justify-between gap-2">
          <Text className="flex-1 font-pj-bd text-[12px] leading-[17px] text-slate">DOCTOR & CHAMBER</Text>
          {visit.practitioner.room ? <Mono className="rounded bg-sky-150 px-2 py-1 text-ink">{visit.practitioner.room}</Mono> : null}
        </View>
        <View className="flex-row gap-3 rounded-2xl bg-sky-100 p-3">
          <IconTile icon="medical-services" box="bg-black" color="#ffffff" className="size-11 rounded-xl" />
          <View className="flex-1">
            <Text className="font-pj-md text-[15px] leading-5 text-ink">{visit.practitioner.displayName}</Text>
            <Text className="text-[12px] leading-[17px] text-slate">
              {[visit.practitioner.specialty, visit.practitioner.credentials].filter(Boolean).join(' · ')}
            </Text>
            <Text className="font-pj-bd text-[11px] leading-4 text-ink">{[visit.practitioner.department, visit.branch.name].join(' · ')}</Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1 gap-1 rounded-xl bg-sky-100 p-3">
            <Text className="text-[12px] leading-[17px] text-slate">Visit Type</Text>
            <Text className="font-pj-md text-[13px] leading-[18px] text-ink">{TYPE_LABEL[visit.type]}</Text>
            {visit.service ? <Text className="font-pj-bd text-[10px] leading-[15px] text-slate">{visit.service}</Text> : null}
          </View>
          <View className="flex-1 gap-1 rounded-xl bg-sky-100 p-3">
            <Text className="text-[12px] leading-[17px] text-slate">Reason for Visit</Text>
            <Text numberOfLines={3} className="font-pj-md text-[13px] leading-[18px] text-ink">
              {visit.reason}
            </Text>
          </View>
        </View>
        {visit.internalNote ? (
          <View className="gap-1 rounded-xl bg-[#fffbeb] p-3">
            <Text className="font-pj-bd text-[11px] leading-4 text-[#b45309]">DESK NOTE</Text>
            <Text className="text-[12px] leading-[17px] text-ink">{visit.internalNote}</Text>
          </View>
        ) : null}
        <View className="flex-row justify-between gap-2">
          <Text className="text-[12px] leading-[17px] text-slate">Booked by {visit.bookedBy}</Text>
          <Text className="font-pj-bd text-[11px] leading-[17px] text-slate">{dayLabel(visit.createdAt.slice(0, 10))}</Text>
        </View>
      </Box>

      <Box>
        <View className="flex-row justify-between">
          <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">Next Step</Text>
          <Text className="font-pj-bd text-[11px] leading-[18px] text-slate">State: {status.label}</Text>
        </View>
        {open ? (
          <>
            {visit.status === 'pending' ? (
              <ActionButton
                large
                tone="mint"
                label="Confirm Appointment"
                icon="check"
                disabled={action.busy}
                onPress={() => action.run(visit.id, 'confirm', {}, 'Appointment confirmed.').then(finish)}
              />
            ) : null}
            {visit.date === today ? (
              <ActionButton
                large
                tone="dark"
                label="Check In Patient"
                icon="how-to-reg"
                iconRight="arrow-forward"
                onPress={() => router.push({ pathname: '/reception/check-in', params: { id: visit.id } })}
              />
            ) : null}
            <View className="flex-row gap-2">
              {can('bookings.reschedule') ? <ActionButton label="Reschedule" icon="event-repeat" className="flex-1" onPress={() => openSheet('reschedule')} /> : null}
              {can('bookings.cancel') ? <ActionButton label="Cancel Slot" icon="highlight-off" tone="danger" className="flex-1" onPress={() => openSheet('cancel')} /> : null}
            </View>
            {can('bookings.cancel') && visit.date <= today ? (
              <ActionButton label="Mark No-show" icon="person-off" tone="white" onPress={() => openSheet('no-show')} />
            ) : null}
          </>
        ) : (
          <Text className="text-[12px] leading-[17px] text-slate">
            {visit.status === 'cancelled'
              ? 'This slot was cancelled and released.'
              : visit.status === 'no_show'
                ? 'The patient did not arrive. Book a new appointment if they call.'
                : visit.status === 'completed'
                  ? 'This visit is complete.'
                  : 'The patient has arrived and is with the care team.'}
          </Text>
        )}
      </Box>

      <Box>
        <View className="flex-row justify-between">
          <Text className="font-pj-bd text-[12px] leading-[17px] text-slate">HISTORY</Text>
          <Chip label={`${milestones.length} ${milestones.length === 1 ? 'entry' : 'entries'}`} tone="pale" />
        </View>
        {milestones.length ? <Timeline items={milestones} /> : <Text className="text-[12px] leading-[17px] text-slate">No changes recorded yet.</Text>}
      </Box>

      <Sheet visible={sheet === 'cancel' || sheet === 'no-show'} onClose={() => setSheet(null)} title={sheet === 'cancel' ? 'Cancel this appointment?' : 'Mark as no-show?'}>
        <Text className="pb-3 text-[13px] leading-5 text-slate">
          {visit.patient.fullName} · {when} with {visit.practitioner.displayName}.{sheet === 'cancel' ? ' The slot will be released.' : ''}
        </Text>
        <Options options={(sheet === 'cancel' ? CANCEL_REASONS : NO_SHOW_REASONS).map((value) => ({ value, label: value }))} value={reason || null} onChange={setReason} />
        <TextField
          label="Operational note"
          className="mt-3"
          multiline
          value={note}
          onChangeText={setNote}
          placeholder="What happened, for the audit history"
          hint={`At least ${NOTE_MIN} characters.`}
        />
        <Button
          label={sheet === 'cancel' ? 'Cancel Appointment' : 'Mark No-show'}
          variant="danger"
          className="mt-4"
          disabled={!reason || noteShort || action.busy}
          onPress={() =>
            action
              .run(visit.id, sheet === 'cancel' ? 'cancel' : 'no-show', { reason, note: note.trim() }, sheet === 'cancel' ? 'Appointment cancelled.' : 'Marked as no-show.')
              .then(finish)
          }
        />
        <Button label="Keep Appointment" variant="soft" className="mt-2" onPress={() => setSheet(null)} />
      </Sheet>

      <Sheet visible={sheet === 'reschedule'} onClose={() => setSheet(null)} title="Reschedule appointment">
        {slots.error ? <Text className="pb-2 text-[13px] leading-5 text-[#93000a]">{slots.error.message}</Text> : null}
        {!slots.data && !slots.error ? <LoadingState label="Finding open slots…" /> : null}
        {slots.data ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-3">
              {slots.data.days.map((entry) => {
                const free = entry.slots.filter((slot) => slot.state === 'available').length;
                return (
                  <Pressable
                    key={entry.date}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: entry.date === date, disabled: free === 0 }}
                    disabled={free === 0}
                    onPress={() => {
                      setDate(entry.date);
                      setTime('');
                    }}
                    className={cn('items-center rounded-xl border px-3 py-2', entry.date === date ? 'border-black bg-black' : 'border-sky-150 bg-sky-100', free === 0 && 'opacity-40')}>
                    <Text className={cn('font-pj-bd text-[12px] leading-4', entry.date === date ? 'text-white' : 'text-ink')}>{dayLabel(entry.date)}</Text>
                    <Text className={cn('text-[10px] leading-[15px]', entry.date === date ? 'text-white/70' : 'text-slate')}>
                      {entry.closed ? 'Closed' : `${free} slots`}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {day ? (
              <Options
                options={day.slots.filter((slot) => slot.state === 'available').map((slot) => ({ value: slot.time, label: clock(slot.time) }))}
                value={time || null}
                onChange={setTime}
              />
            ) : (
              <Text className="text-[12px] leading-[17px] text-slate">Choose a day to see open times.</Text>
            )}
          </>
        ) : null}
        <Text className="pt-4 pb-2 font-pj-bd text-[12px] leading-4 text-slate">REASON</Text>
        <Options options={RESCHEDULE_REASONS.map((value) => ({ value, label: value }))} value={reason || null} onChange={setReason} />
        <TextField label="Operational note" className="mt-3" multiline value={note} onChangeText={setNote} placeholder="Why the time changed" hint={`At least ${NOTE_MIN} characters.`} />
        <Button
          label={date && time ? `Move to ${dayLabel(date)}, ${clock(time)}` : 'Confirm New Time'}
          className="mt-4"
          disabled={!date || !time || !reason || noteShort || action.busy}
          onPress={() => action.run(visit.id, 'reschedule', { date, time, reason, note: note.trim() }, `Appointment moved to ${dayLabel(date)}, ${clock(time)}.`).then(finish)}
        />
      </Sheet>
    </Screen>
  );
}
