import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Dock, DockButton, DocHeader, Pill, SoftCard, T } from '@/features/consultation/design';
import { useClinicalDay } from '@/features/doctor/clinical';
import { ageSex, clock, dayLabel, EVENT_LABEL, GENDER_LABEL, localToday, phone, STATUS, telOf, TYPE_LABEL, type Appointment } from '@/features/reception/desk';
import { useDial } from '@/features/reception/ui';
import { useStartConsultation } from '@/features/today/FlowCard';
import { useResource } from '@/hooks/useResource';

const CHANNEL: Record<Appointment['channel'], string> = { reception: 'Reception desk', phone: 'Phone call', portal: 'Patient app', referral: 'Referral', walk_in: 'Walk-in' };

function Line({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View className="flex-row justify-between gap-3 border-b border-sky-150 py-2">
      <T v="body" className="w-[40%]">{label}</T>
      <View className="flex-1 items-end">
        <T v="label" className="text-right">{value}</T>
        {note ? <T v="kicker" className="text-right">{note}</T> : null}
      </View>
    </View>
  );
}

export default function AppointmentDetails() {
  const dial = useDial();
  const { id } = useLocalSearchParams<{ id: string }>();
  const appointment = useResource<Appointment>(`/v1/appointments/${id}`, ['appointments', 'records']);
  const day = useClinicalDay();
  const { start, busy } = useStartConsultation();

  if (!appointment.data) {
    return (
      <Screen className="bg-sky-50" header={<AppHeader title="Appointment" />} contentClassName="px-4 pt-6">
        {appointment.error ? (
          appointment.error.code === 'NOT_FOUND' ? (
            <EmptyState title="Appointment not found" message="It may be outside your patients or branches." actionLabel="Open Schedule" onAction={() => router.navigate('/schedule')} />
          ) : (
            <ErrorState message={appointment.error.message} onAction={appointment.reload} />
          )
        ) : (
          <LoadingState label="Loading the appointment…" />
        )}
      </Screen>
    );
  }

  const visit = appointment.data;
  const status = STATUS[visit.status];
  const dayRow = (day.data?.appointments ?? []).find((row) => row.id === visit.id);
  const canStart = !!dayRow && (visit.status === 'arrived' || visit.status === 'in_progress');

  return (
    <Screen
      className="bg-sky-50"
      bareFooter
      header={<DocHeader title="Appointment" below={<Pill label={`${status.label} • ${visit.reference}`} dot="#000000" className="bg-mint/60" textClassName="text-deep" />} />}
      footer={
        <Dock>
          <View className="flex-row gap-2">
            <DockButton label="Chart" tone="soft" onPress={() => router.push({ pathname: '/patients/record', params: { patientId: visit.patient.id } })} className="min-h-[48px]" />
            {canStart ? (
              <DockButton label={visit.status === 'in_progress' ? 'Resume Consultation' : 'Start Consultation'} iconRight="arrow-white-sm" loading={busy === visit.id} onPress={() => start(dayRow!)} className="min-h-[48px] flex-1" />
            ) : (
              <DockButton label="Back" onPress={() => (router.canGoBack() ? router.back() : router.navigate('/schedule'))} className="min-h-[48px] flex-1" />
            )}
          </View>
          {!canStart && (visit.status === 'pending' || visit.status === 'confirmed') ? <T v="kicker" className="text-center">The consultation can start once reception checks the patient in.</T> : null}
        </Dock>
      }
      contentClassName="gap-3.5 px-5 pb-6 pt-1">
      <SoftCard className="gap-1.5 rounded-2xl">
        <T v="kicker">{`${dayLabel(visit.date, true)} • ${visit.waitingQueue ? 'Walk-in queue' : `${clock(visit.time)} – ${clock(visit.endTime)}`}`}</T>
        <T v="heading">{visit.patient.fullName}</T>
        <T v="body">{`${ageSex(visit.patient, localToday())} • ${GENDER_LABEL[visit.patient.gender]} • ${visit.patient.mrn}`}</T>
        <T v="body">{visit.reason}</T>
        <View className="flex-row gap-2 pt-1">
          <DockButton label="Call Patient" tone="soft" onPress={() => dial(telOf(visit.patient.mobile))} className="min-h-[40px] flex-1" />
        </View>
        <T v="kicker">{phone(visit.patient.mobile)}</T>
      </SoftCard>

      <SoftCard className="gap-0 rounded-2xl">
        <Line label="Visit type" value={TYPE_LABEL[visit.type]} note={visit.service ?? undefined} />
        <Line label="Booked through" value={CHANNEL[visit.channel]} note={`by ${visit.bookedBy}`} />
        <Line label="Doctor" value={visit.practitioner.displayName} note={visit.practitioner.specialty} />
        <Line label="Location" value={visit.branch.name} note={visit.practitioner.room ?? undefined} />
        {visit.queueToken ? <Line label="Token" value={visit.queueToken} note={visit.arrivedAt ? `Arrived ${clock(visit.arrivedAt)}` : undefined} /> : null}
        {visit.internalNote ? <Line label="Desk note" value={visit.internalNote} /> : null}
      </SoftCard>

      <SoftCard className="gap-2 rounded-2xl">
        <T v="heading">History</T>
        {(visit.events ?? []).map((event) => (
          <View key={event.id} className="gap-0.5 border-l-2 border-sky-250 pl-3">
            <T v="label">{EVENT_LABEL[event.action] ?? event.action}</T>
            <T v="kicker">{`${dayLabel(event.date)}, ${clock(event.time)} • ${event.actor}`}</T>
            {event.reason ? <T v="body">{event.reason}</T> : null}
          </View>
        ))}
        {(visit.events ?? []).length === 0 ? <T v="body">No changes recorded.</T> : null}
      </SoftCard>
    </Screen>
  );
}
