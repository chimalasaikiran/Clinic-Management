import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Card, Kicker, Tag } from '@/components/ui/Kit';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useClinicalDay } from '@/features/doctor/clinical';
import { ageSex, dayLabel, GENDER_LABEL, initialsOf, localToday, phone, STATUS, type Paged, type Patient } from '@/features/reception/desk';
import { useResource } from '@/hooks/useResource';
import { cn } from '@/lib/cn';

function Field({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View className="flex-1">
      <Kicker>{label}</Kicker>
      <Text className="font-pj-sb text-[12px] leading-[18px] text-ink">{value}</Text>
      {note ? <Text className="text-[11px] leading-4 text-slate">{note}</Text> : null}
    </View>
  );
}

export default function PatientSearch() {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);
  // Searches the patients in this doctor's care scope; an empty search shows the most recent.
  const results = useResource<Paged<Patient>>(`/v1/patients?pageSize=20${query ? `&query=${encodeURIComponent(query)}` : ''}`);
  const day = useClinicalDay();
  const today = localToday();
  const todays = new Map((day.data?.appointments ?? []).map((row) => [row.patient.id, row]));
  const items = results.data?.items ?? [];

  return (
    <Screen inTabs className="bg-sky-50" header={<AppHeader title="Patient Search" subtitle="Your patients" />} contentClassName="gap-3 px-4 pt-3 pb-6">
      <SearchField value={text} onChangeText={setText} placeholder="Name, mobile, MRN or ABHA number..." />
      <Text className="text-[12px] leading-[17px] text-slate">
        {results.data ? `${results.data.total} ${results.data.total === 1 ? 'patient' : 'patients'}${query ? ` match “${query}”` : ''}` : ' '}
      </Text>
      {results.error && !results.data ? <ErrorState message={results.error.message} onAction={results.reload} /> : null}
      {results.loading && !results.data ? <LoadingState label="Searching…" /> : null}
      {results.data && items.length === 0 ? <EmptyState title="No matching patient" message="Check the spelling or try the mobile number or MRN." /> : null}
      {items.map((record) => {
        const visit = todays.get(record.id);
        return (
          <Card key={record.id} className="border-line/40">
            <View className="flex-row gap-3">
              <View className={cn('size-11 items-center justify-center rounded-2xl', visit ? 'bg-deep' : 'bg-sky-300')}>
                <Text className={cn('font-pj-bd text-[16px]', visit ? 'text-mint' : 'text-[#526871]')}>{initialsOf(record.fullName)}</Text>
              </View>
              <View className="flex-1">
                <View className="flex-row flex-wrap items-center gap-1.5">
                  <Text className="font-pj-bd text-[16px] leading-6 text-ink">{record.fullName}</Text>
                  <Tag label={ageSex(record, today)} />
                </View>
                <Text className="font-pj-md text-[12px] leading-[18px] text-slate">
                  {record.mrn} · {phone(record.mobile)}
                </Text>
              </View>
              {visit ? <Tag label={visit.token ? `Today · ${visit.token}` : `Today · ${STATUS[visit.status].label}`} tone="mint" className="self-start" /> : null}
            </View>
            <View className="flex-row gap-2 rounded-xl bg-sky-100 p-2.5">
              <Field label="GENDER" value={GENDER_LABEL[record.gender]} note={record.bloodGroup ?? undefined} />
              <Field label="LAST VISIT" value={record.lastVisit ? dayLabel(record.lastVisit.date, true) : 'None'} note={record.lastVisit?.practitioner} />
            </View>
            <Button label="Open Chart" size="md" onPress={() => router.push({ pathname: '/patients/record', params: { patientId: record.id } })} />
          </Card>
        );
      })}
    </Screen>
  );
}
