import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import {
  clock,
  dayLabel,
  GENDER_LABEL,
  initialsOf,
  isOpen,
  localToday,
  phone,
  STATUS,
  telOf,
  TYPE_LABEL,
  yearsOld,
  type Appointment,
  type Paged,
  type Patient,
  type Practitioner,
} from '@/features/reception/desk';
import { ActionButton, Avatar, Box, Chip, Glyph, Heading, IconTile, Mono, ProfileButton, ReceptionHeader, useDial, type GlyphName } from '@/features/reception/ui';
import { useResource } from '@/hooks/useResource';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession } from '@/state/SessionState';
import colors from '@/theme/colors';

const HISTORY = 50;

export default function PatientFile() {
  const toast = useToast();
  const dial = useDial();
  const { call, can } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const record = useResource<Patient>(`/v1/patients/${id}`);
  const visits = useResource<Paged<Appointment>>(`/v1/appointments?patientId=${id}&pageSize=${HISTORY}`, ['appointments']);
  const [walkIn, setWalkIn] = useState(false);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const patient = record.data;
  const practitioners = useResource<Practitioner[]>(walkIn && patient ? `/v1/practitioners?status=active&branchId=${patient.homeBranch.id}` : null);
  const header = <ReceptionHeader title="Patient Details" subtitle={patient?.homeBranch.name ?? 'Front Desk'} subtitleIcon="apartment" right={<ProfileButton initials />} />;

  if (!patient) {
    return (
      <Screen className="bg-sky-50" header={header} contentClassName="px-4 pt-3">
        {record.error ? (
          record.error.code === 'NOT_FOUND' ? (
            <EmptyState title="Patient not found" message="This record is not in your branches." actionLabel="Open Directory" onAction={() => router.navigate('/reception/patients')} />
          ) : (
            <ErrorState message={record.error.message} onAction={record.reload} />
          )
        ) : (
          <LoadingState label="Loading patient…" />
        )}
      </Screen>
    );
  }

  const today = localToday();
  const all = visits.data?.items ?? [];
  const upcoming = all.filter((visit) => isOpen(visit.status) && visit.date >= today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const inClinic = all.find((visit) => visit.date === today && (visit.status === 'arrived' || visit.status === 'in_progress'));
  const past = all.filter((visit) => !upcoming.includes(visit) && visit !== inClinic);
  const next = upcoming[0];
  const active = patient.status === 'active';

  const facts = [
    ['AGE', `${yearsOld(patient.dateOfBirth, today)}Y`],
    ['GENDER', GENDER_LABEL[patient.gender]],
    ['DOB', dayLabel(patient.dateOfBirth, true).split(', ')[1]!],
    ['BLOOD GRP', patient.bloodGroup ?? '—'],
  ];
  const address = [patient.addressLine, patient.area, patient.city, patient.state, patient.pinCode].filter(Boolean).join(', ');
  const contacts: { icon: GlyphName; label: string; value: string }[] = [
    ...(patient.abhaNumber ? [{ icon: 'badge' as const, label: 'ABHA Number', value: patient.abhaNumber }] : []),
    { icon: 'place', label: 'Address', value: address },
    ...(patient.emergencyName || patient.emergencyPhone
      ? [{ icon: 'contact-emergency' as const, label: 'Emergency Contact', value: [patient.emergencyName, patient.emergencyRelation && `(${patient.emergencyRelation})`, phone(patient.emergencyPhone)].filter(Boolean).join(' · ') }]
      : []),
  ];

  const todays = upcoming.find((visit) => visit.date === today);
  const dispatch: { title: string; body: string; icon: GlyphName; onPress: () => void; disabled?: boolean }[] = [
    { title: 'Book Visit', body: 'Choose a slot', icon: 'calendar-month', onPress: () => router.push({ pathname: '/reception/book', params: { patientId: patient.id } }), disabled: !active || !can('bookings.create') },
    {
      title: todays ? 'Check-In' : 'Walk-in',
      body: todays ? clock(todays.time) : 'Join the queue',
      icon: 'confirmation-number',
      onPress: () => (todays ? router.push({ pathname: '/reception/check-in', params: { id: todays.id } }) : setWalkIn(true)),
      disabled: !active || !!inClinic || !can('bookings.create'),
    },
    { title: 'All Visits', body: `${all.length} on file`, icon: 'receipt-long', onPress: () => router.navigate('/reception/appointments') },
  ];

  const addWalkIn = async () => {
    if (!doctorId) return;
    setSaving(true);
    try {
      const created = await call<Appointment>('/v1/appointments', {
        method: 'POST',
        body: {
          patientId: patient.id,
          practitionerId: doctorId,
          branchId: patient.homeBranch.id,
          date: today,
          type: 'consultation',
          channel: 'walk_in',
          status: 'confirmed',
          reason: reason.trim(),
          arrivedNow: true,
          waitingQueue: true,
        },
      });
      setWalkIn(false);
      toast(`${patient.fullName} joined the queue${created.queueToken ? ` · Token ${created.queueToken}` : ''}.`);
      router.push(`/reception/appointment/${created.id}`);
    } catch (failure) {
      toast(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen className="bg-sky-50" header={header} contentClassName="gap-3 px-4 pt-3 pb-8">
      <View className="flex-row gap-2.5 rounded-2xl bg-sky-100 p-3.5">
        <Glyph name="admin-panel-settings" size={17} />
        <View className="flex-1 gap-1">
          <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">Administrative view</Text>
          <Text className="text-[12px] leading-[17px] text-slate">Identity, contact details and visits only. Diagnoses, vitals, prescriptions and results stay with the care team.</Text>
        </View>
      </View>

      <Box>
        <View className="flex-row gap-3">
          <Avatar initials={initialsOf(patient.fullName)} verified={!!patient.abhaNumber} className="size-14" />
          <View className="flex-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="font-pj-bd text-[20px] leading-7 text-ink">
                {patient.title} {patient.fullName}
              </Text>
              <Chip label={active ? 'Active' : 'Inactive'} tone={active ? 'mint' : 'red'} className="self-center" />
            </View>
            <Text className="text-[12px] leading-[17px] text-slate">
              {patient.mrn} • {patient.homeBranch.name}
            </Text>
          </View>
        </View>
        <View className="flex-row rounded-xl bg-sky-100 py-2.5">
          {facts.map(([label, value]) => (
            <View key={label} className="flex-1 items-center px-1">
              <Text className="font-pj-bd text-[10px] leading-[15px] text-slate">{label}</Text>
              <Text className="text-center font-pj-md text-[13px] leading-[18px] text-ink">{value}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row items-center gap-2.5 rounded-xl bg-sky-100 p-2.5">
          <IconTile icon="call" box="bg-white" />
          <View className="flex-1">
            <Text className="font-pj-bd text-[10px] leading-[15px] text-slate">Primary Mobile</Text>
            <Mono className="text-[12px] leading-[17px] text-ink">{phone(patient.mobile)}</Mono>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Call ${patient.fullName}`} onPress={() => dial(telOf(patient.mobile))}>
            <IconTile icon="call" box="bg-black" color="#ffffff" />
          </Pressable>
        </View>
        {contacts.map((item) => (
          <View key={item.label} className="flex-row items-center gap-2.5 rounded-xl bg-sky-100 p-2.5">
            <IconTile icon={item.icon} box="bg-white" />
            <View className="flex-1">
              <Text className="font-pj-bd text-[10px] leading-[15px] text-slate">{item.label}</Text>
              <Text className="text-[13px] leading-[18px] text-ink">{item.value}</Text>
            </View>
          </View>
        ))}
        <Text className="text-[12px] leading-[17px] text-slate">
          Registered {dayLabel(patient.createdAt.slice(0, 10), true)} · Details can be edited in the admin panel.
        </Text>
      </Box>

      <Text className="font-pj-bd text-[14px] leading-5 text-ink">DESK ACTIONS</Text>
      <View className="flex-row justify-between">
        {dispatch.map((item) => {
          const dark = item.title === 'Check-In' || item.title === 'Walk-in';
          return (
            <Pressable
              key={item.title}
              accessibilityRole="button"
              accessibilityLabel={item.title}
              accessibilityState={{ disabled: !!item.disabled }}
              disabled={item.disabled}
              onPress={item.onPress}
              className={cn('w-[31.5%] items-center gap-1 rounded-2xl py-3', dark ? 'bg-black' : 'bg-white', item.disabled && 'opacity-40')}>
              <IconTile icon={item.icon} box={dark ? 'bg-white/10' : 'bg-sky-150'} color={dark ? '#ffffff' : undefined} />
              <Text className={cn('font-pj-bd text-[11px] leading-4', dark ? 'text-white' : 'text-ink')}>{item.title}</Text>
              <Text className={cn('text-[11px] leading-4', dark ? 'text-white/60' : 'text-slate')}>{item.body}</Text>
            </Pressable>
          );
        })}
      </View>

      <Heading title="Appointment Schedule" right={<Chip label={`${upcoming.length} upcoming`} tone="steel" className="self-center" />} />
      {visits.error && !visits.data ? <ErrorState message={visits.error.message} onAction={visits.reload} /> : null}
      {!visits.data && !visits.error ? <LoadingState label="Loading visits…" /> : null}
      {inClinic ? (
        <Pressable accessibilityRole="button" onPress={() => router.push(`/reception/appointment/${inClinic.id}`)} className="gap-1 rounded-2xl bg-mint p-3.5">
          <Text className="font-pj-bd text-[12px] leading-4 text-ink">
            In clinic now{inClinic.queueToken ? ` · Token ${inClinic.queueToken}` : ''}
          </Text>
          <Text className="text-[12px] leading-[17px] text-ink">
            {inClinic.practitioner.displayName} · {STATUS[inClinic.status].label}
          </Text>
        </Pressable>
      ) : null}
      {visits.data && next ? (
        <View className="gap-3 rounded-2xl bg-sky-100 p-3.5">
          <View className="flex-row items-center justify-between gap-2">
            <Text className="flex-1 font-pj-bd text-[12px] leading-4 text-ink">
              • {next.date === today ? 'Today' : dayLabel(next.date, true)} · {clock(next.time)}
            </Text>
            <Chip label={STATUS[next.status].label} tone={STATUS[next.status].tone} />
          </View>
          <View className="flex-row gap-3">
            <IconTile icon="medical-services" box="bg-white" className="size-11 rounded-xl" />
            <View className="flex-1">
              <Text className="font-pj-bd text-[16px] leading-[22px] text-ink">{next.practitioner.displayName}</Text>
              <Text className="text-[12px] leading-[17px] text-slate">{[next.practitioner.department, next.practitioner.room].filter(Boolean).join(' · ')}</Text>
              <Text className="text-[12px] leading-[17px] text-slate">{TYPE_LABEL[next.type]}</Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            {next.date === today ? (
              <ActionButton label="Check In" icon="check-circle-outline" tone="dark" onPress={() => router.push({ pathname: '/reception/check-in', params: { id: next.id } })} />
            ) : null}
            <ActionButton label="Open Appointment" icon="north-east" tone="white" className="flex-1" onPress={() => router.push(`/reception/appointment/${next.id}`)} />
          </View>
          {upcoming.length > 1 ? <Text className="text-[12px] leading-[17px] text-slate">+{upcoming.length - 1} more booked later</Text> : null}
        </View>
      ) : null}
      {visits.data && !next && !inClinic ? (
        <EmptyState
          title="No upcoming appointment"
          message="Nothing is booked for this patient."
          actionLabel={active && can('bookings.create') ? 'Book Visit' : undefined}
          onAction={active ? () => router.push({ pathname: '/reception/book', params: { patientId: patient.id } }) : undefined}
        />
      ) : null}

      <Box>
        <Text className="font-pj-bd text-[11px] leading-4 text-slate">PAST VISITS</Text>
        {past.length ? (
          past.map((visit) => (
            <Pressable key={visit.id} accessibilityRole="button" onPress={() => router.push(`/reception/appointment/${visit.id}`)} className="flex-row items-center gap-2.5">
              <IconTile icon={visit.status === 'completed' ? 'check-circle-outline' : 'event-busy'} box="bg-sky-100" />
              <View className="flex-1">
                <Text numberOfLines={1} className="text-[13px] leading-[18px] text-ink">
                  {visit.practitioner.displayName} · {visit.practitioner.department}
                </Text>
                <Text className="text-[12px] leading-[17px] text-slate">
                  {dayLabel(visit.date, true)} · {clock(visit.time)}
                  {visit.queueToken ? ` · Token ${visit.queueToken}` : ''}
                </Text>
              </View>
              <Chip label={STATUS[visit.status].label} tone={STATUS[visit.status].tone} className="self-center" />
            </Pressable>
          ))
        ) : (
          <Text className="text-[12px] leading-[17px] text-slate">No past visits are recorded.</Text>
        )}
      </Box>

      <Sheet visible={walkIn} onClose={() => setWalkIn(false)} title="Add to walk-in queue">
        <Text className="pb-3 text-[13px] leading-5 text-slate">
          {patient.fullName} is at the desk now. Choose the doctor; the token is given in arrival order.
        </Text>
        {practitioners.error ? <Text className="text-[13px] leading-5 text-[#93000a]">{practitioners.error.message}</Text> : null}
        {!practitioners.data && !practitioners.error ? <LoadingState label="Loading doctors…" /> : null}
        <View className="gap-2">
          {practitioners.data?.map((doctor) => (
            <Pressable
              key={doctor.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: doctor.id === doctorId }}
              onPress={() => setDoctorId(doctor.id)}
              className={cn('flex-row items-center gap-3 rounded-xl p-3', doctor.id === doctorId ? 'bg-mint' : 'bg-sky-100')}>
              <View className="flex-1">
                <Text className="font-pj-sb text-[14px] leading-5 text-ink">{doctor.displayName}</Text>
                <Text className="text-[12px] leading-[17px] text-slate">{[doctor.specialty, doctor.room].filter(Boolean).join(' · ')}</Text>
              </View>
              <Glyph name={doctor.id === doctorId ? 'check-circle' : 'radio-button-unchecked'} color={doctor.id === doctorId ? '#000000' : colors.line} size={20} />
            </Pressable>
          ))}
        </View>
        <TextField label="Reason for the visit" className="mt-3" value={reason} onChangeText={setReason} maxLength={500} placeholder="What brings them in today" />
        <Button label={saving ? 'Adding…' : 'Add to Queue'} className="mt-4" disabled={!doctorId || !reason.trim() || saving} onPress={addWalkIn} />
      </Sheet>
    </Screen>
  );
}
