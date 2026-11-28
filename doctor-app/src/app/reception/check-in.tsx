import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/layout/Screen';
import { SearchField } from '@/components/ui/SearchField';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import {
  clock,
  GENDER_LABEL,
  initialsOf,
  isOpen,
  STATUS,
  TYPE_LABEL,
  useAppointmentAction,
  useDay,
  yearsOld,
  type Appointment,
  type DayAppointment,
} from '@/features/reception/desk';
import { ActionButton, Avatar, Box, Chip, Glyph, IconTile, ProfileButton, ReceptionHeader, TearLine } from '@/features/reception/ui';
import { cn } from '@/lib/cn';

export default function CheckIn() {
  const params = useLocalSearchParams<{ id?: string }>();
  const day = useDay();
  const action = useAppointmentAction();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string | null>(params.id ?? null);
  const [note, setNote] = useState('');
  const [issued, setIssued] = useState<Appointment | null>(null);

  const data = day.data;
  const rows = data?.appointments ?? [];
  const waiting = rows.filter((row) => isOpen(row.status));
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? waiting.filter((row) => `${row.patient.fullName} ${row.patient.mrn} ${row.reference}`.toLowerCase().includes(needle))
    : waiting;
  const visit = rows.find((row) => row.id === chosen) ?? null;
  const ahead = visit ? rows.filter((row) => row.status === 'arrived' && row.practitioner.id === visit.practitioner.id).length : 0;
  const lounge = rows.filter((row) => row.status === 'arrived').length;
  const done = !!issued || (visit !== null && !isOpen(visit.status));

  const confirm = async (row: DayAppointment) => {
    const updated = await action.run(row.id, 'check-in', note.trim() ? { note: note.trim() } : {});
    if (updated) {
      setIssued(updated);
      day.reload();
    }
  };

  const choose = (row: DayAppointment) => {
    setChosen(row.id);
    setIssued(null);
    setNote('');
  };

  return (
    <Screen
      className="bg-sky-50"
      header={<ReceptionHeader title="Check In & Arrival" subtitle={data?.branches.map((branch) => branch.name).join(' · ') ?? 'Front Desk'} subtitleIcon="place" right={<ProfileButton initials />} />}
      footer={
        done ? (
          <ActionButton large tone="dark" label="View Live Queue" iconRight="arrow-forward" onPress={() => router.replace('/reception/queue')} />
        ) : (
          <ActionButton
            large
            tone="dark"
            label={action.busy ? 'Confirming…' : 'Confirm Arrival & Issue Token'}
            icon="how-to-reg"
            iconRight="arrow-forward"
            disabled={!visit || action.busy}
            onPress={() => visit && confirm(visit)}
          />
        )
      }
      contentClassName="gap-3 px-4 pt-3 pb-6">
      <View className="flex-row rounded-2xl bg-sky-150 p-1">
        <View className="flex-1 items-center rounded-xl bg-black py-2">
          <Text className="font-pj-bd text-[12px] leading-4 text-white">• Scheduled ({waiting.length})</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/reception/register')} className="flex-1 items-center py-2">
          <Text className="font-pj-bd text-[12px] leading-4 text-slate">Walk-In Patient →</Text>
        </Pressable>
      </View>

      {day.error && !data ? <ErrorState message={day.error.message} onAction={day.reload} /> : null}
      {!data && !day.error ? <LoadingState label="Loading today's arrivals…" /> : null}

      {data && !visit ? (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder="Name, PT-ID or appointment reference..." />
          {matches.length === 0 ? (
            <Box className="items-center py-8">
              <Text className="font-pj-bd text-[15px] leading-5 text-ink">No scheduled arrival found</Text>
              <Text className="text-center text-[12px] leading-[17px] text-slate">
                {waiting.length ? 'Check the name or ID, or register a walk-in.' : 'Everyone booked for today has arrived or been closed.'}
              </Text>
            </Box>
          ) : null}
          {matches.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              accessibilityLabel={`Check in ${row.patient.fullName}`}
              onPress={() => choose(row)}
              className="flex-row items-center gap-3 rounded-2xl border border-sky-150/60 bg-white p-3">
              <Avatar initials={initialsOf(row.patient.fullName)} />
              <View className="flex-1">
                <Text className="font-pj-bd text-[14px] leading-5 text-ink">{row.patient.fullName}</Text>
                <Text className="text-[12px] leading-[17px] text-slate">
                  {clock(row.time)} · {row.practitioner.displayName} · {row.patient.mrn}
                </Text>
              </View>
              <Chip label={STATUS[row.status].label} tone={STATUS[row.status].tone} className="self-center" />
            </Pressable>
          ))}
        </>
      ) : null}

      {data && visit ? (
        <>
          <View className="overflow-hidden rounded-2xl border border-sky-150 bg-white">
            <View className="flex-row items-center gap-2 bg-sky-100 px-4 py-3">
              <Glyph name="confirmation-number" size={15} />
              <Text className="flex-1 font-pj-bd text-[11px] leading-4 text-ink">ARRIVAL CHECK-IN PASS</Text>
              <Chip label={visit.reference} tone="white" className="self-center" />
            </View>
            <View className="flex-row gap-3 p-4">
              <Avatar initials={initialsOf(visit.patient.fullName)} />
              <View className="flex-1 gap-1">
                <Text className="font-pj-bd text-[17px] leading-[23px] text-ink">{visit.patient.fullName}</Text>
                <View className="flex-row flex-wrap gap-1.5">
                  <Chip label={visit.patient.mrn} />
                  <Chip label={TYPE_LABEL[visit.type]} />
                </View>
                <Text className="text-[12px] leading-[17px] text-slate">
                  {yearsOld(visit.patient.dateOfBirth, data.today)}Y · {GENDER_LABEL[visit.patient.gender]}
                </Text>
              </View>
            </View>
            <TearLine />
            <View className="gap-3 p-4">
              <Text className="font-pj-bd text-[24px] leading-8 text-ink">
                {visit.waitingQueue ? 'Walk-in' : clock(visit.time)} <Text className="text-[13px] text-slate">Today</Text>
              </Text>
              <View className="flex-row items-center gap-3 rounded-2xl bg-sky-100 p-3">
                <IconTile icon="medical-services" />
                <View className="flex-1">
                  <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{visit.practitioner.displayName}</Text>
                  <Text className="text-[12px] leading-[17px] text-slate">{visit.practitioner.department}</Text>
                </View>
                {visit.practitioner.room ? <Text className="font-pj-bd text-[12px] leading-4 text-ink">{visit.practitioner.room}</Text> : null}
              </View>
              <View className={cn('flex-row items-center gap-2 rounded-xl px-3 py-2.5', done ? 'bg-teal-50' : 'bg-sky-100')}>
                <Glyph name={done ? 'verified' : 'info-outline'} size={15} />
                <Text className="flex-1 font-pj-bd text-[12px] leading-4 text-ink">
                  {issued ? 'Arrival confirmed.' : done ? `This appointment is ${STATUS[visit.status].label.toLowerCase()}.` : 'Check the patient’s name and ID before confirming.'}
                </Text>
              </View>
            </View>
          </View>

          <Box>
            <View className="flex-row items-center gap-2">
              <Glyph name="confirmation-number" size={16} />
              <Text className="flex-1 font-pj-bd text-[14px] leading-5 text-ink">Token & Queue</Text>
            </View>
            <View className="rounded-2xl bg-sky-150 p-3.5">
              <Text className="font-pj-bd text-[10px] leading-[15px] text-slate">{issued || visit.token ? 'ISSUED TOKEN' : 'TOKEN'}</Text>
              <Text className="font-pj-xb text-[28px] leading-9 text-ink">
                {issued?.queueToken ?? visit.token ? `TOKEN ${issued?.queueToken ?? visit.token}` : 'On arrival'}
              </Text>
              <Text className="text-[12px] leading-[17px] text-slate">Given in arrival order when you confirm.</Text>
            </View>
            <View className="flex-row justify-between">
              {[
                { label: 'Ahead', value: String(issued ? Math.max(0, ahead - 1) : ahead), note: `for ${visit.practitioner.displayName}` },
                { label: 'Lounge', value: String(lounge), note: 'waiting now' },
                { label: 'Slot', value: visit.waitingQueue ? 'Queue' : clock(visit.time), note: `${visit.durationMinutes} min` },
              ].map((item) => (
                <View key={item.label} className="w-[32%] gap-0.5 rounded-xl bg-sky-100 p-2.5">
                  <Text className="font-pj-bd text-[10px] leading-[15px] text-slate">{item.label}</Text>
                  <Text className="font-pj-bd text-[14px] leading-[18px] text-ink">{item.value}</Text>
                  <Text numberOfLines={1} className="text-[11px] leading-4 text-slate">
                    {item.note}
                  </Text>
                </View>
              ))}
            </View>
            {!done ? <TextField label="Arrival note" optionalLabel value={note} onChangeText={setNote} placeholder="For example: came with a relative" maxLength={500} /> : null}
          </Box>

          {!params.id && !done ? <ActionButton label="Choose a different patient" icon="arrow-back" tone="white" onPress={() => setChosen(null)} /> : null}

          <View className="flex-row gap-2.5 rounded-2xl bg-sky-100 p-3.5">
            <Glyph name="verified-user" size={16} />
            <View className="flex-1">
              <Text className="font-pj-bd text-[11px] leading-4 text-ink">Front desk view</Text>
              <Text className="text-[12px] leading-[17px] text-slate">
                Reception sees identity and the visit slot only. Clinical records stay with the care team.
              </Text>
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}
