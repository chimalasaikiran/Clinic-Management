import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import {
  ageSex,
  clock,
  dayLabel,
  dayOfMonth,
  GENDER_LABEL,
  initialsOf,
  localToday,
  minuteOf,
  phone,
  TYPE_LABEL,
  useDay,
  weekdayOf,
  type Appointment,
  type AppointmentType,
  type Paged,
  type Patient,
  type Practitioner,
  type Slots,
} from '@/features/reception/desk';
import { ActionButton, Box, Chip, Glyph, ProfileButton, ReceptionHeader } from '@/features/reception/ui';
import { useResource } from '@/hooks/useResource';
import { ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession, useSignedIn } from '@/state/SessionState';
import colors from '@/theme/colors';

const DAYS = 7;
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TYPES = Object.keys(TYPE_LABEL) as AppointmentType[];
const SESSIONS = [
  { label: 'Morning', range: 'Until 01:00 PM', end: 13 * 60 },
  { label: 'Afternoon', range: '01:00 PM – 05:00 PM', end: 17 * 60 },
  { label: 'Evening', range: 'From 05:00 PM', end: 24 * 60 },
];

function StepHeading({ title, step, subtitle }: { title: string; step: string; subtitle?: string }) {
  return (
    <View className="flex-row items-center gap-2 pt-1">
      <View className="flex-1">
        <Text accessibilityRole="header" className="font-pj-bd text-[17px] leading-6 text-ink">
          {title}
        </Text>
        {subtitle ? <Text className="text-[12px] leading-[17px] text-slate">{subtitle}</Text> : null}
      </View>
      <Chip label={step} className="self-center" />
    </View>
  );
}

export default function BookAppointment() {
  const toast = useToast();
  const { call } = useSession();
  const signedIn = useSignedIn();
  const params = useLocalSearchParams<{ patientId?: string }>();
  const day = useDay();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [patientId, setPatientId] = useState<string | null>(params.patientId ?? null);
  const [pickedBranch, setBranchId] = useState<string | null>(null);
  const [practitionerId, setPractitionerId] = useState<string | null>(null);
  const [type, setType] = useState<AppointmentType>('consultation');
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  // The desk books into its own branch first.
  const branches = day.data?.branches ?? [];
  const primary = signedIn?.me.staff?.branches.find((entry) => entry.primary)?.id;
  const branchId = pickedBranch ?? (branches.find((entry) => entry.id === primary) ?? branches[0])?.id ?? null;

  const patient = useResource<Patient>(patientId ? `/v1/patients/${patientId}` : null);
  const matches = useResource<Paged<Patient>>(search ? `/v1/patients?status=active&pageSize=8&query=${encodeURIComponent(search)}` : null);
  const practitioners = useResource<Practitioner[]>(branchId ? `/v1/practitioners?status=active&branchId=${branchId}` : null);
  const slots = useResource<Slots>(
    practitionerId && branchId ? `/v1/practitioners/${practitionerId}/slots?branchId=${branchId}&from=${localToday()}&days=${DAYS}` : null,
    ['appointments'],
  );

  const chosen = patient.data;
  const doctor = practitioners.data?.find((entry) => entry.id === practitionerId) ?? null;
  const branch = branches.find((entry) => entry.id === branchId);
  const days = slots.data?.days ?? [];
  const selectedDay = days.find((entry) => entry.date === date);
  const open = (selectedDay?.slots ?? []).filter((slot) => slot.state === 'available' || slot.state === 'booked');
  const stillFree = !!time && selectedDay?.slots.some((slot) => slot.time === time && slot.state === 'available');
  const ready = !!chosen && !!doctor && !!date && stillFree && reason.trim().length > 0;
  const today = day.data?.today ?? localToday();

  const confirm = async () => {
    if (!ready || !chosen || !doctor || !branchId || !date || !time) return;
    setBooking(true);
    setError('');
    try {
      const created = await call<Appointment>('/v1/appointments', {
        method: 'POST',
        body: {
          patientId: chosen.id,
          practitionerId: doctor.id,
          branchId,
          date,
          time,
          type,
          channel: 'reception',
          status: 'confirmed',
          reason: reason.trim(),
          notifyWhatsapp: notify,
          notifySms: notify,
        },
      });
      toast(`Booked ${chosen.fullName} with ${doctor.displayName}, ${dayLabel(date)} at ${clock(time)}.`);
      router.replace(`/reception/appointment/${created.id}`);
    } catch (failure) {
      // Someone else may have taken the slot since it was shown.
      if (failure instanceof ApiError && failure.status === 409) slots.reload();
      setError(errorMessage(failure));
    } finally {
      setBooking(false);
    }
  };

  const consultingDays = (entry: Practitioner) =>
    [...new Set(entry.availability.filter((window) => window.branchId === branchId).map((window) => window.weekday))]
      .sort()
      .map((weekday) => WEEKDAY_NAMES[weekday])
      .join(', ');

  const summary = [
    ['Patient', chosen ? `${chosen.fullName} (${chosen.mrn})` : 'Not selected'],
    ['Doctor', doctor ? `${doctor.displayName} · ${doctor.specialty}` : 'Not selected'],
    ['Clinic', branch?.name ?? '—'],
    ['Date & Time', date ? `${dayLabel(date, true)} · ${time ? clock(time) : 'Choose a time'}` : 'Choose a date'],
    ['Type', TYPE_LABEL[type]],
  ];

  return (
    <Screen
      className="bg-sky-50"
      header={<ReceptionHeader title="Book Appointment" subtitle={branch?.name ?? 'Front Desk'} right={<ProfileButton initials />} />}
      footer={
        <View className="gap-1.5">
          {error ? (
            <Text accessibilityRole="alert" className="text-center text-[12px] leading-4 text-[#93000a]">
              {error}
            </Text>
          ) : null}
          <ActionButton large tone="dark" label={booking ? 'Booking…' : 'Confirm appointment'} iconRight="arrow-forward" disabled={!ready || booking} onPress={confirm} />
          <Text className="text-center text-[12px] leading-4 text-slate">The slot is checked again when you confirm</Text>
        </View>
      }
      contentClassName="gap-3 px-4 pt-3 pb-6">
      <StepHeading title="Patient" step="Step 1 of 6" />
      {chosen ? (
        <View className="gap-3 rounded-2xl bg-mint p-4">
          <View className="flex-row items-center gap-3">
            <View className="size-11 items-center justify-center rounded-full bg-black">
              <Text className="font-pj-bd text-[13px] leading-4 text-white">{initialsOf(chosen.fullName)}</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-pj-sb text-[15px] leading-5 text-ink">{chosen.fullName}</Text>
              <Text className="text-[12px] leading-[17px] text-ink">
                {ageSex(chosen, today)} · {GENDER_LABEL[chosen.gender]} · {chosen.mrn}
              </Text>
            </View>
            <ActionButton label="Change" tone="white" onPress={() => setPatientId(null)} />
          </View>
          <Text className="text-[12px] leading-[17px] text-ink">{phone(chosen.mobile)}</Text>
        </View>
      ) : patientId && patient.loading ? (
        <LoadingState label="Loading patient…" />
      ) : (
        <>
          <SearchField value={text} onChangeText={setText} placeholder="Search patient by name, mobile or PT-ID" />
          {search && matches.data?.items.length === 0 ? <Text className="text-[12px] leading-[17px] text-slate">No active patient matches that search.</Text> : null}
          {matches.data?.items.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              onPress={() => {
                setPatientId(item.id);
                setText('');
              }}
              className="rounded-xl bg-white px-4 py-2.5">
              <Text className="font-pj-sb text-[13px] leading-[18px] text-ink">{item.fullName}</Text>
              <Text className="text-[12px] leading-[17px] text-slate">
                {item.mrn} · {phone(item.mobile)}
              </Text>
            </Pressable>
          ))}
          {!search ? <Text className="rounded-xl bg-white p-4 text-center text-[12px] leading-[17px] text-slate">Search above and choose a patient.</Text> : null}
        </>
      )}
      <Pressable accessibilityRole="link" hitSlop={8} onPress={() => router.push('/reception/register')}>
        <Text className="font-pj-bd text-[12px] leading-[17px] text-ink">No existing record? Register new patient →</Text>
      </Pressable>

      <StepHeading title="Choose doctor" subtitle={branch?.name} step="Step 2 of 6" />
      {branches.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {branches.map((entry) => (
            <Pressable
              key={entry.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: entry.id === branchId }}
              onPress={() => {
                setBranchId(entry.id);
                setPractitionerId(null);
                setDate(null);
                setTime(null);
              }}
              className={cn('rounded-full px-3 py-1.5', entry.id === branchId ? 'bg-black' : 'bg-white')}>
              <Text className={cn('font-pj-bd text-[11px] leading-4', entry.id === branchId ? 'text-white' : 'text-slate')}>{entry.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {practitioners.error ? <ErrorState message={practitioners.error.message} onAction={practitioners.reload} /> : null}
      {!practitioners.data && !practitioners.error ? <LoadingState label="Loading doctors…" /> : null}
      {practitioners.data?.length === 0 ? <EmptyState title="No doctors at this branch" message="Ask an administrator to set consulting hours for this branch." /> : null}
      {practitioners.data?.map((item) => {
        const active = item.id === practitionerId;
        const hours = consultingDays(item);
        return (
          <Pressable
            key={item.id}
            accessibilityRole="radio"
            accessibilityLabel={item.displayName}
            accessibilityState={{ checked: active }}
            onPress={() => {
              setPractitionerId(item.id);
              setDate(null);
              setTime(null);
            }}
            className={cn('flex-row items-center gap-3 rounded-2xl p-3.5', active ? 'bg-mint' : 'bg-white')}>
            <View className={cn('size-10 items-center justify-center rounded-xl', active ? 'bg-black' : 'bg-sky-150')}>
              <Text className={cn('font-pj-bd text-[12px] leading-4', active ? 'text-white' : 'text-ink')}>{initialsOf(item.displayName)}</Text>
            </View>
            <View className="flex-1">
              <Text className="font-pj-sb text-[14px] leading-5 text-ink">{item.displayName}</Text>
              <Text className="text-[12px] leading-[17px] text-slate">{[item.specialty, item.room].filter(Boolean).join(' · ')}</Text>
              <Text className="font-pj-bd text-[11px] leading-4 text-ink">{hours ? `Consults ${hours} · ${item.slotMinutes} min slots` : 'No consulting hours here'}</Text>
            </View>
            <Glyph name={active ? 'check-circle' : 'radio-button-unchecked'} color={active ? '#000000' : colors.line} size={20} />
          </Pressable>
        );
      })}

      <StepHeading title="Appointment type" step="Step 3 of 6" />
      <View className="flex-row flex-wrap justify-between gap-y-2">
        {TYPES.map((value) => {
          const active = value === type;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => setType(value)}
              className={cn('w-[48.5%] items-center rounded-xl py-2.5', active ? 'bg-black' : 'bg-white')}>
              <Text className={cn('font-pj-sb text-[13px] leading-[18px]', active ? 'text-white' : 'text-ink')}>{TYPE_LABEL[value]}</Text>
            </Pressable>
          );
        })}
      </View>

      <StepHeading title="Select date" step="Step 4 of 6" />
      {!doctor ? <Text className="text-[12px] leading-[17px] text-slate">Choose a doctor to see their open days.</Text> : null}
      {doctor && slots.error ? <ErrorState message={slots.error.message} onAction={slots.reload} /> : null}
      {doctor && !slots.data && !slots.error ? <LoadingState label="Finding open slots…" /> : null}
      {days.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {days.map((item) => {
            const free = item.slots.filter((slot) => slot.state === 'available').length;
            const active = item.date === date;
            const closed = free === 0;
            return (
              <Pressable
                key={item.date}
                accessibilityRole="button"
                accessibilityLabel={dayLabel(item.date, true)}
                accessibilityState={{ selected: active, disabled: closed }}
                disabled={closed}
                onPress={() => {
                  setDate(item.date);
                  setTime(null);
                }}
                className={cn('w-[64px] items-center rounded-2xl py-2.5', active ? 'bg-black' : closed ? 'bg-sky-100 opacity-50' : 'bg-white')}>
                <Text className={cn('font-pj-bd text-[11px] leading-4', active ? 'text-white' : 'text-slate')}>{weekdayOf(item.date)}</Text>
                <Text className={cn('font-pj-bd text-[18px] leading-6', active ? 'text-white' : 'text-ink')}>{dayOfMonth(item.date)}</Text>
                <Text className={cn('font-pj-bd text-[10px] leading-[15px]', active ? 'text-white' : 'text-ink')}>
                  {item.date === today ? 'Today' : item.closed ? 'Closed' : free ? `${free} slots` : 'Full'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <StepHeading title="Available time" step="Step 5 of 6" />
      {!date ? <Text className="text-[12px] leading-[17px] text-slate">Choose a date to see times.</Text> : null}
      {date
        ? SESSIONS.map((session, index) => {
            const start = index === 0 ? 0 : SESSIONS[index - 1]!.end;
            const times = open.filter((slot) => minuteOf(slot.time) >= start && minuteOf(slot.time) < session.end);
            if (!times.length) return null;
            return (
              <View key={session.label} className="gap-2">
                <View className="flex-row justify-between">
                  <Text className="font-pj-md text-[12px] leading-[17px] text-slate">{session.label}</Text>
                  <Text className="text-[12px] leading-[17px] text-slate">{session.range}</Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {times.map((slot) => {
                    const taken = slot.state !== 'available';
                    const active = slot.time === time;
                    return (
                      <Pressable
                        key={slot.time}
                        accessibilityRole="button"
                        accessibilityLabel={`${clock(slot.time)}${taken ? ', booked' : ''}`}
                        accessibilityState={{ selected: active, disabled: taken }}
                        disabled={taken}
                        onPress={() => setTime(slot.time)}
                        className={cn('w-[31.5%] items-center rounded-xl py-2.5', active ? 'bg-black' : taken ? 'bg-sky-100' : 'bg-white')}>
                        <Text className={cn('font-pj-bd text-[12px] leading-4', active ? 'text-white' : taken ? 'text-slate/50 line-through' : 'text-ink')}>{clock(slot.time)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })
        : null}

      <StepHeading title="Additional details" step="Step 6 of 6" />
      <Text className="text-[12px] leading-[17px] text-slate">Reason for the visit</Text>
      <TextInput
        accessibilityLabel="Reason for the visit"
        value={reason}
        onChangeText={setReason}
        maxLength={500}
        placeholder="e.g., Routine BP follow-up, lab report review..."
        placeholderTextColor={colors.muted}
        className="rounded-2xl bg-white px-4 py-3 font-pj text-[14px] text-ink"
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: notify }}
        onPress={() => setNotify(!notify)}
        className="flex-row items-center gap-3 rounded-2xl bg-white p-3.5">
        <Glyph name="chat" size={17} />
        <Text className="flex-1 text-[13px] leading-[18px] text-ink">Send WhatsApp & SMS confirmation to patient</Text>
        <Glyph name={notify ? 'check-box' : 'check-box-outline-blank'} size={20} color="#000000" />
      </Pressable>

      <Box>
        <View className="flex-row items-center justify-between">
          <Text accessibilityRole="header" className="font-pj-bd text-[17px] leading-6 text-ink">
            Booking Summary
          </Text>
          <Chip label={ready ? 'Ready' : 'Incomplete'} tone={ready ? 'mint' : 'amber'} className="self-center" />
        </View>
        {summary.map(([label, value]) => (
          <View key={label}>
            <Text className="font-pj-bd text-[11px] leading-4 text-slate">{label}</Text>
            <Text className="text-[13px] leading-[18px] text-ink">{value}</Text>
          </View>
        ))}
      </Box>
    </Screen>
  );
}
