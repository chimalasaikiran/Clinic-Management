import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { FilterChips } from '@/components/ui/FilterChips';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { ageSex, dayLabel, GENDER_LABEL, initialsOf, isPresent, localToday, phone, telOf, useDay, type Paged, type Patient } from '@/features/reception/desk';
import { ActionButton, Avatar, Box, Chip, Glyph, IconTile, ProfileButton, ReceptionHeader, RoundButton, useDial } from '@/features/reception/ui';
import { useResource } from '@/hooks/useResource';
import { useSignedIn } from '@/state/SessionState';
import colors from '@/theme/colors';

const filters = [
  { value: 'all', label: 'All Patients' },
  { value: 'recent', label: 'Visited in 30 Days' },
  { value: 'inactive', label: 'Inactive' },
] as const;
type Filter = (typeof filters)[number]['value'];

const PAGE = 25;
const MAX_PAGE = 100;

const query = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

export default function PatientDirectory() {
  const dial = useDial();
  const signedIn = useSignedIn();
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [byName, setByName] = useState(false);
  // How many rows to show; going back to one page whenever the search or filter changes.
  const [paging, setPaging] = useState({ key: '', size: PAGE });

  // Waits for a pause in typing before asking the server.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  const pageKey = `${search}|${filter}`;
  const size = paging.key === pageKey ? paging.size : PAGE;

  const list = useResource<Paged<Patient>>(
    `/v1/patients?${query({
      query: search,
      pageSize: size,
      visitWithinDays: filter === 'recent' ? 30 : undefined,
      status: filter === 'inactive' ? 'inactive' : filter === 'all' ? undefined : 'active',
    })}`,
    ['appointments'],
  );
  const registered = useResource<Paged<Patient>>('/v1/patients?pageSize=1');
  const recent = useResource<Paged<Patient>>('/v1/patients?pageSize=1&visitWithinDays=30');
  const day = useDay();

  const today = day.data?.today ?? localToday();
  const inClinic = new Set((day.data?.appointments ?? []).filter((row) => isPresent(row.status)).map((row) => row.patient.id));
  const items = list.data?.items ?? [];
  const visible = byName ? [...items].sort((a, b) => a.fullName.localeCompare(b.fullName)) : items;
  const total = list.data?.total ?? 0;

  const figures = [
    { label: 'Registered', value: registered.data?.total, note: 'All records' },
    { label: 'Visited', value: recent.data?.total, note: 'Last 30 days' },
    { label: 'In Clinic', value: day.data ? inClinic.size : undefined, note: 'Right now' },
  ];

  const name = signedIn?.user.fullName ?? '';
  const designation = signedIn?.me.staff?.designation;
  const branch = signedIn?.me.staff?.branches.find((entry) => entry.primary)?.name;

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <ReceptionHeader
          title="Patients"
          subtitle={signedIn?.membership?.organisation.name ?? 'Front Desk'}
          subtitleIcon="add-box"
          back={false}
          right={
            <>
              <RoundButton icon="notifications-none" label="Notifications" onPress={() => router.push('/notifications')} />
              <ProfileButton initials />
            </>
          }
        />
      }
      contentClassName="gap-3 px-4 pt-3 pb-6">
      <View className="flex-row items-center gap-2">
        <Text accessibilityRole="header" className="flex-1 font-pj-bd text-[21px] leading-7 text-ink">
          Patient Directory
        </Text>
      </View>

      <Box>
        <View className="flex-row items-center gap-2.5">
          <Avatar initials={initialsOf(name)} className="size-8 rounded-full" />
          <View className="flex-1">
            <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{name}</Text>
            <Text className="font-pj-sb text-[11px] leading-4 text-slate">{[branch, designation].filter(Boolean).join(' · ') || 'Front Desk'}</Text>
          </View>
        </View>
        <View className="rounded-xl bg-sky-100 p-3">
          <Text className="text-[12px] leading-[17px] text-slate">
            <Text className="font-pj-bd text-[12px] text-ink">Reception Privacy Scope:</Text> Administrative and demographic details only.
            Diagnoses, results and consultation notes are not shown at the desk.
          </Text>
        </View>
      </Box>

      <SearchField value={text} onChangeText={setText} placeholder="Name, mobile, ABHA number or PT-..." />

      <View className="flex-row justify-between">
        {figures.map((figure) => (
          <View key={figure.label} className="w-[32%] gap-1 rounded-2xl bg-white p-2.5">
            <Text numberOfLines={1} className="font-pj-sb text-[11px] leading-4 text-slate">
              {figure.label}
            </Text>
            <Text className="font-pj-bd text-[18px] leading-6 text-ink">{figure.value === undefined ? '—' : figure.value.toLocaleString('en-IN')}</Text>
            <Chip label={figure.note} tone={figure.label === 'In Clinic' ? 'mint' : 'sky'} />
          </View>
        ))}
      </View>

      <FilterChips options={filters} value={filter} onChange={setFilter} />
      <View className="flex-row items-center justify-between">
        <Text className="text-[12px] leading-[17px] text-slate">
          Showing {visible.length} of {total.toLocaleString('en-IN')} records
        </Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setByName(!byName)}>
          <Text className="font-pj-bd text-[12px] leading-[17px] text-ink">{byName ? 'Name A–Z' : 'Newest First'} ⇅</Text>
        </Pressable>
      </View>

      {list.error && !list.data ? <ErrorState message={list.error.message} onAction={list.reload} /> : null}
      {list.loading && !list.data ? <LoadingState label="Searching patients…" /> : null}
      {list.data && visible.length === 0 ? (
        <EmptyState
          title="No matching patient"
          message="Check the spelling, or register a new patient."
          actionLabel="Register Patient"
          onAction={() => router.push('/reception/register')}
        />
      ) : null}
      {visible.map((patient, index) => {
        const here = inClinic.has(patient.id);
        const badge = patient.status === 'inactive' ? 'Inactive' : here ? 'In Clinic' : patient.lastVisit ? `Visited ${dayLabel(patient.lastVisit.date)}` : 'No visits yet';
        return (
          <Box key={patient.id}>
            <View className="flex-row items-start gap-3">
              <Avatar initials={initialsOf(patient.fullName)} tone={index % 2 === 0 ? 'black' : 'slate'} verified={!!patient.abhaNumber} />
              <View className="flex-1 gap-1">
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="flex-1 font-pj-bd text-[16px] leading-[22px] text-ink">{patient.fullName}</Text>
                  <Chip label={badge} tone={here ? 'mint' : patient.status === 'inactive' ? 'red' : 'sky'} />
                </View>
                <Chip label={patient.mrn} tone="steel" />
                <Text className="text-[12px] leading-[17px] text-slate">
                  {ageSex(patient, today)} · {GENDER_LABEL[patient.gender]} • {phone(patient.mobile)}
                </Text>
              </View>
            </View>
            <View className="gap-1 rounded-xl bg-sky-100 p-3">
              <View className="flex-row justify-between gap-3">
                <Text className="text-[12px] leading-[17px] text-slate">ABHA Number</Text>
                <Text className="text-[12px] leading-[17px] text-ink">{patient.abhaNumber || 'Not recorded'}</Text>
              </View>
              <View className="flex-row justify-between gap-3">
                <Text className="text-[12px] leading-[17px] text-slate">Last Visit</Text>
                <Text numberOfLines={1} className="flex-1 text-right text-[12px] leading-[17px] text-ink">
                  {patient.lastVisit ? `${dayLabel(patient.lastVisit.date, true)} · ${patient.lastVisit.practitioner}` : `Registered ${dayLabel(patient.createdAt.slice(0, 10), true)}`}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-2">
              <Pressable accessibilityRole="button" accessibilityLabel={`Call ${patient.fullName}`} onPress={() => dial(telOf(patient.mobile))}>
                <IconTile icon="call" className="size-9" color={colors.ink} />
              </Pressable>
              {patient.status === 'active' ? (
                <ActionButton
                  label="Book"
                  icon="edit-calendar"
                  tone="pale"
                  onPress={() => router.push({ pathname: '/reception/book', params: { patientId: patient.id } })}
                />
              ) : null}
              <ActionButton
                label="View File"
                iconRight="arrow-forward"
                tone={index === 0 ? 'dark' : 'steel'}
                className="flex-1"
                onPress={() => router.push(`/reception/patient/${patient.id}`)}
              />
            </View>
          </Box>
        );
      })}
      {total > items.length && size < MAX_PAGE ? (
        <ActionButton label="Show More" icon="expand-more" tone="white" onPress={() => setPaging({ key: pageKey, size: Math.min(MAX_PAGE, size + PAGE) })} />
      ) : null}
      {total > items.length && size >= MAX_PAGE ? (
        <Text className="text-center text-[12px] leading-[17px] text-slate">Refine the search to see other records.</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Register Patient"
        onPress={() => router.push('/reception/register')}
        className="flex-row items-center gap-3 rounded-2xl bg-black p-3.5 active:opacity-80">
        <IconTile icon="person-add-alt" box="bg-white/10" color="#ffffff" className="size-10" />
        <View className="flex-1">
          <Text className="font-pj-bd text-[14px] leading-5 text-white">+ Register Patient</Text>
          <Text className="text-[12px] leading-[17px] text-white/70">Checks for an existing record by mobile</Text>
        </View>
        <View className="size-9 items-center justify-center rounded-xl bg-white">
          <Glyph name="arrow-forward" size={17} />
        </View>
      </Pressable>
    </Screen>
  );
}
