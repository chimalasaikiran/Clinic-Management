import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { clock, minutesSince, useDay, useNow, type DayAppointment } from '@/features/reception/desk';
import { ActionButton, Box, Chip, Glyph, IconTile, Mono, ProfileButton, ReceptionHeader, RoundButton, type GlyphName } from '@/features/reception/ui';
import { cn } from '@/lib/cn';
import colors from '@/theme/colors';

// A patient waiting longer than this is flagged to the desk.
const WAIT_ALERT_MINUTES = 25;

function SectionTitle({ title, count, note }: { title: string; count: string; note: string }) {
  return (
    <View className="flex-row items-center gap-2 pt-2">
      <Text accessibilityRole="header" className="flex-1 font-pj-bd text-[16px] leading-[22px] text-ink">
        {title}
      </Text>
      <Chip label={count} tone="steel" className="self-center" />
      <Text className="text-[11px] leading-4 text-slate">{note}</Text>
    </View>
  );
}

const byArrival = (a: DayAppointment, b: DayAppointment) => (a.arrivedAt ?? '').localeCompare(b.arrivedAt ?? '');

export default function LiveQueue() {
  const now = useNow();
  const day = useDay();
  const [chamber, setChamber] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);

  const rows = day.data?.appointments ?? [];
  const doctors = [...new Map(rows.filter((row) => row.status !== 'cancelled' && row.status !== 'no_show').map((row) => [row.practitioner.id, row.practitioner])).values()];
  const mine = (row: DayAppointment) => chamber === 'all' || row.practitioner.id === chamber;
  const waiting = rows.filter((row) => row.status === 'arrived').sort(byArrival);
  const consulting = rows.filter((row) => row.status === 'in_progress').sort(byArrival);
  const completed = rows.filter((row) => row.status === 'completed');
  const expected = rows.filter((row) => row.status === 'confirmed' || row.status === 'pending');
  const waitOf = (row: DayAppointment) => (row.arrivedAt ? minutesSince(row.arrivedAt, now) : 0);
  const average = waiting.length ? Math.round(waiting.reduce((sum, row) => sum + waitOf(row), 0) / waiting.length) : 0;
  const overdue = waiting.filter((row) => mine(row) && waitOf(row) > WAIT_ALERT_MINUTES);

  // Position in each doctor's own line, by arrival.
  const position = (row: DayAppointment) => waiting.filter((other) => other.practitioner.id === row.practitioner.id).indexOf(row) + 1;

  const figures: { label: string; value: number; suffix: string; note: string; icon: GlyphName; box: string; dark?: boolean }[] = [
    { label: 'WAITING', value: waiting.length, suffix: waiting.length ? `~${average}m avg` : '', note: 'Checked in', icon: 'hourglass-top', box: 'bg-white' },
    { label: 'IN CONSULT', value: consulting.length, suffix: 'active', note: 'With the doctor', icon: 'medical-services', box: 'bg-[#1c1c1c]', dark: true },
    { label: 'EXPECTED', value: expected.length, suffix: 'booked', note: 'Not arrived yet', icon: 'schedule', box: 'bg-sky-300' },
    { label: 'COMPLETED', value: completed.length, suffix: 'today', note: 'Visits closed', icon: 'check-circle-outline', box: 'bg-sky-100' },
  ];

  const open = (row: DayAppointment) => router.push(`/reception/appointment/${row.id}`);

  return (
    <Screen
      className="bg-sky-50"
      header={
        <ReceptionHeader
          title="Live OPD Queue"
          subtitle={day.data?.branches.map((branch) => branch.name).join(' · ') ?? 'Front Desk'}
          subtitleIcon="place"
          right={
            <>
              <RoundButton icon="sync" label="Refresh queue" onPress={day.reload} />
              <ProfileButton initials />
            </>
          }
        />
      }
      contentClassName="gap-3 px-4 pt-3 pb-8">
      {day.error && !day.data ? <ErrorState message={day.error.message} onAction={day.reload} /> : null}
      {!day.data && !day.error ? <LoadingState label="Loading the queue…" /> : null}
      {day.data ? (
        <>
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {figures.map((figure) => (
              <View key={figure.label} className={cn('w-[48.3%] gap-1 rounded-2xl border border-sky-150/60 p-3', figure.box)}>
                <View className="flex-row items-center justify-between">
                  <Text className={cn('font-pj-bd text-[10px] leading-[15px]', figure.dark ? 'text-[#6ee7b7]' : 'text-slate')}>{figure.label}</Text>
                  <Glyph name={figure.icon} size={15} color={figure.dark ? '#6ee7b7' : colors.ink} />
                </View>
                <Text className={cn('font-pj-bd text-[26px] leading-9', figure.dark ? 'text-white' : 'text-ink')}>
                  {figure.value} <Text className={cn('font-pj-md text-[11px]', figure.dark ? 'text-white/70' : 'text-slate')}>{figure.suffix}</Text>
                </Text>
                <Chip label={figure.note} tone={figure.dark ? 'green' : 'white'} />
              </View>
            ))}
          </View>

          <Text className="font-pj-bd text-[11px] leading-4 text-ink">DOCTORS TODAY ●</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {[{ id: 'all', displayName: `All Doctors (${doctors.length})`, room: null as string | null }, ...doctors].map((item) => {
              const active = chamber === item.id;
              const line = waiting.filter((row) => row.practitioner.id === item.id).length;
              const inRoom = consulting.find((row) => row.practitioner.id === item.id);
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => setChamber(item.id)}
                  className={cn('min-h-[46px] justify-center rounded-2xl border px-4 py-1.5', active ? 'border-black bg-black' : 'border-sky-150 bg-white')}>
                  <Text className={cn('font-pj-bd text-[12px] leading-4', active ? 'text-white' : 'text-ink')}>
                    {item.room ? `${item.room} · ${item.displayName}` : item.displayName}
                  </Text>
                  {item.id !== 'all' ? (
                    <Text className={cn('text-[10px] leading-[15px]', active ? 'text-white/70' : 'text-slate')}>
                      {inRoom?.token ? `In: Token ${inRoom.token} · ` : ''}
                      {line} waiting
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {overdue.map((row) => (
            <View key={row.id} className="gap-2 rounded-2xl border border-[#fecaca] bg-[#fff5f5] p-3.5">
              <View className="flex-row gap-2.5">
                <IconTile icon="warning-amber" box="bg-[#ffdad6]" color="#ba1a1a" />
                <View className="flex-1 gap-1">
                  <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">Long Wait</Text>
                  <Chip label={`+${waitOf(row) - WAIT_ALERT_MINUTES}m past ${WAIT_ALERT_MINUTES}m`} tone="red" />
                  <Text className="text-[12px] leading-[17px] text-slate">
                    Token <Text className="font-pj-bd text-[12px] text-ink">{row.token ?? '—'} ({row.patient.fullName})</Text> has waited {waitOf(row)}m for{' '}
                    {row.practitioner.displayName}.
                  </Text>
                </View>
              </View>
              <ActionButton label="Open Appointment" icon="north-east" tone="dark" onPress={() => open(row)} />
            </View>
          ))}

          <SectionTitle title="In Consultation" count={`${consulting.filter(mine).length} Active`} note="With the doctor" />
          {consulting.filter(mine).length === 0 ? <EmptyState title="No one is with a doctor" message="Patients appear here once their consultation starts." /> : null}
          {consulting.filter(mine).map((row) => (
            <View key={row.id} className="gap-2 rounded-2xl border border-dashed border-sky-300 p-3">
              <View className="flex-row items-center gap-3">
                <View className="size-11 items-center justify-center rounded-xl bg-sky-300">
                  <Text className="font-pj-bd text-[13px] leading-4 text-ink">{row.token ?? '—'}</Text>
                </View>
                <View className="flex-1">
                  <Text numberOfLines={1} className="font-pj-bd text-[12px] leading-4 text-ink">
                    {row.patient.fullName} ({row.patient.mrn})
                  </Text>
                  <Text numberOfLines={1} className="text-[12px] leading-[17px] text-slate">
                    {[row.practitioner.displayName, row.practitioner.room].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-[10px] leading-[15px] text-slate">Arrived {clock(row.arrivedTime)}</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-2 rounded-lg bg-sky-100 px-3 py-2">
                <Glyph name="lock-outline" size={13} color={colors.slate} />
                <Text numberOfLines={1} className="flex-1 text-[11px] leading-4 text-slate">
                  Consultation notes stay with the doctor
                </Text>
              </View>
            </View>
          ))}

          <SectionTitle title="Waiting in Lounge" count={`${waiting.filter(mine).length} In Queue`} note="Arrival order" />
          {waiting.filter(mine).length === 0 ? <EmptyState title="Lounge is clear" message="No checked-in patient is waiting here." /> : null}
          {waiting.filter(mine).map((row) => {
            const place = position(row);
            return (
              <Box key={row.id}>
                <View className="flex-row gap-3">
                  <View className="w-14 items-center justify-center rounded-xl bg-sky-150 py-2">
                    <Text className="font-pj-bd text-[17px] leading-5 text-ink">{row.token ?? '—'}</Text>
                    <Text className="font-pj-bd text-[8px] leading-3 text-slate">{place === 1 ? 'NEXT #1' : `POS #${place}`}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-pj-bd text-[14px] leading-5 text-ink">{row.patient.fullName}</Text>
                    <Mono>{row.patient.mrn}</Mono>
                    <Text className="text-[12px] leading-[17px] text-slate">
                      {row.waitingQueue ? 'Walk-in' : `Appt ${clock(row.time)}`} · Arrived {clock(row.arrivedTime)} · Waiting {waitOf(row)}m
                    </Text>
                  </View>
                </View>
                <View className="flex-row flex-wrap gap-1.5">
                  {row.waitingQueue ? <Chip label="Walk-in" tone="amber" /> : null}
                  <Chip label={[row.practitioner.displayName, row.practitioner.room].filter(Boolean).join(' · ')} tone="pale" />
                </View>
                <View className="flex-row gap-2 border-t border-sky-150 pt-2.5">
                  <ActionButton label="Profile" icon="badge" onPress={() => router.push(`/reception/patient/${row.patient.id}`)} />
                  <ActionButton label="Details" icon="info-outline" tone="dark" className="flex-1" onPress={() => open(row)} />
                </View>
              </Box>
            );
          })}

          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showCompleted }} onPress={() => setShowCompleted(!showCompleted)}>
            <Box>
              <View className="flex-row items-center gap-3">
                <IconTile icon="check-circle-outline" color="#059669" />
                <View className="flex-1">
                  <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">Completed Today ({completed.length} visits)</Text>
                  <Text className="text-[11px] leading-4 text-slate">Updates as doctors close visits</Text>
                </View>
                <Text className="font-pj-bd text-[11px] leading-4 text-slate">{showCompleted ? 'Hide' : 'Show details'}</Text>
                <Glyph name={showCompleted ? 'expand-less' : 'expand-more'} size={18} />
              </View>
              {showCompleted
                ? completed.filter(mine).map((row) => (
                    <Pressable key={row.id} accessibilityRole="button" onPress={() => open(row)} className="flex-row items-center gap-2">
                      <Text className="w-12 font-pj-bd text-[12px] leading-4 text-ink">{row.token ?? '—'}</Text>
                      <Text numberOfLines={1} className="flex-1 text-[12px] leading-[17px] text-ink">
                        {row.patient.fullName}
                      </Text>
                      <Text className="text-[11px] leading-4 text-slate">{row.practitioner.displayName}</Text>
                    </Pressable>
                  ))
                : null}
            </Box>
          </Pressable>
        </>
      ) : null}
    </Screen>
  );
}
