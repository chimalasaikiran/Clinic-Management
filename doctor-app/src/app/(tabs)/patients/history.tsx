import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { FilterChips } from '@/components/ui/FilterChips';
import { Card, Tag } from '@/components/ui/Kit';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useChart, usePatient, type Encounter } from '@/features/doctor/clinical';
import { clock, dayLabel, initialsOf } from '@/features/reception/desk';
import { useConsultation } from '@/state/ConsultationState';

type Tab = 'visits' | 'rx' | 'orders' | 'plans';
const ORDER_STATUS: Record<string, string> = { ordered: 'Ordered', collected: 'Collected', awaiting_review: 'Awaiting Review', reviewed: 'Reviewed', cancelled: 'Cancelled' };
const RX_STATUS: Record<string, string> = { active: 'Active', discontinued: 'Stopped', dispensed: 'Dispensed', partially_dispensed: 'Partly Dispensed' };

function EncounterCard({ item, diagnoses }: { item: Encounter; diagnoses: string[] }) {
  const { open } = useConsultation();
  const live = item.status === 'in_progress';
  const doctor = item.practitioner?.displayName ?? item.startedBy;
  return (
    <Card className="border-sky-300">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Tag label={live ? 'In Progress' : 'Signed'} tone={live ? 'amber' : 'sky'} />
        <Text className="font-pj-bd text-[11px] leading-4 text-slate">#{item.reference}</Text>
      </View>
      <View>
        <Text className="font-pj-bd text-[16px] leading-6 text-ink">{item.chiefComplaint || item.type}</Text>
        <Text className="text-[12px] leading-[18px] text-slate">
          {dayLabel(item.started.date, true)} · {clock(item.started.time)} · {item.branch.name}
        </Text>
      </View>
      <View className="flex-row items-center gap-2.5 rounded-xl bg-sky-100/70 p-2.5">
        <View className="size-8 items-center justify-center rounded-full bg-sky-300">
          <Text className="font-pj-bd text-[12px] text-ink">{initialsOf(doctor)}</Text>
        </View>
        <View className="flex-1">
          <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{doctor}</Text>
          <Text className="text-[11px] leading-4 text-slate">{item.practitioner?.department ?? item.type}</Text>
        </View>
      </View>
      {item.soap.assessment ? (
        <Text numberOfLines={3} className="text-[13px] leading-[19px] text-slate">
          {item.soap.assessment}
        </Text>
      ) : null}
      {diagnoses.length ? (
        <View className="flex-row flex-wrap gap-1.5">
          {diagnoses.map((name) => (
            <View key={name} className="rounded-lg bg-sky-100 px-2 py-1">
              <Text className="font-pj-md text-[11px] leading-4 text-ink">{name}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {live ? (
        <Button
          label="Resume Consultation"
          iconRight="arrow-right-white"
          size="md"
          onPress={() => {
            open(item.id);
            router.push('/patients/workspace');
          }}
        />
      ) : (
        <Button label="View Encounter" variant="soft" size="md" onPress={() => router.push({ pathname: '/patients/encounter', params: { encounterId: item.id } })} />
      )}
    </Card>
  );
}

export default function ConsultationHistory() {
  const params = useLocalSearchParams<{ patientId?: string; tab?: Tab }>();
  const patient = usePatient(params.patientId);
  const chart = useChart(params.patientId);
  const [tab, setTab] = useState<Tab>(params.tab ?? 'visits');
  const [query, setQuery] = useState('');

  const data = chart.data;
  const needle = query.trim().toLowerCase();
  const matches = (text: string) => !needle || text.toLowerCase().includes(needle);
  const visits = (data?.encounters ?? []).filter((item) => matches(`${item.reference} ${item.chiefComplaint} ${item.type} ${item.soap.assessment} ${item.practitioner?.displayName ?? ''}`));
  const rx = (data?.prescriptions ?? []).filter((item) => matches(`${item.reference} ${item.items.map((entry) => entry.name).join(' ')} ${item.indication}`));
  const orders = (data?.orders ?? []).filter((item) => matches(`${item.reference} ${item.title} ${item.indication}`));
  const plans = (data?.carePlans ?? []).filter((item) => matches(`${item.reference} ${item.title} ${item.category}`));
  const tabs = [
    { value: 'visits' as const, label: `Visits  ${data?.encounters.length ?? 0}` },
    { value: 'rx' as const, label: `Prescriptions  ${data?.prescriptions.length ?? 0}` },
    { value: 'orders' as const, label: `Investigations  ${data?.orders.length ?? 0}` },
    { value: 'plans' as const, label: `Care Plans  ${data?.carePlans.length ?? 0}` },
  ];
  const count = { visits: visits.length, rx: rx.length, orders: orders.length, plans: plans.length }[tab];

  return (
    <Screen inTabs className="bg-sky-50" header={<AppHeader title="Clinical History" subtitle={patient.data ? `${patient.data.fullName} · ${patient.data.mrn}` : ''} />} contentClassName="gap-3 px-4 pt-3 pb-6">
      {!params.patientId ? <EmptyState title="No patient chosen" message="Open a patient's chart first." actionLabel="Search Patients" onAction={() => router.push('/patients/search')} /> : null}
      {chart.error && !data ? <ErrorState message={chart.error.message} onAction={chart.reload} /> : null}
      {params.patientId && !data && !chart.error ? <LoadingState label="Loading history…" /> : null}
      {data ? (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder="Search diagnosis, medicine, test or doctor..." />
          <FilterChips options={tabs} value={tab} onChange={setTab} />
          {count === 0 ? <EmptyState title="Nothing here" message={needle ? 'No records match this search.' : 'No records of this kind yet.'} /> : null}
          {tab === 'visits'
            ? visits.map((item) => (
                <EncounterCard
                  key={item.id}
                  item={item}
                  diagnoses={data.diagnoses.filter((entry) => entry.encounterId === item.id).map((entry) => `${entry.name} (${entry.icd})`)}
                />
              ))
            : null}
          {tab === 'rx'
            ? rx.map((item) => (
                <Card key={item.id} className="border-sky-300">
                  <View className="flex-row items-center justify-between gap-2">
                    <Tag label={RX_STATUS[item.status] ?? item.status} tone={item.status === 'active' ? 'teal' : 'sky'} />
                    <Text className="font-pj-bd text-[11px] leading-4 text-slate">#{item.reference}</Text>
                  </View>
                  {item.items.map((entry) => (
                    <View key={entry.id}>
                      <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">
                        {entry.name} {entry.strength}
                      </Text>
                      <Text className="text-[11px] leading-4 text-slate">
                        {entry.dose} · {entry.frequency} · {entry.durationDays} days
                      </Text>
                    </View>
                  ))}
                  <Text className="text-[11px] leading-4 text-slate">
                    {item.prescriberName} · {dayLabel(item.created.date, true)} · {item.indication}
                  </Text>
                </Card>
              ))
            : null}
          {tab === 'orders'
            ? orders.map((item) => (
                <Card key={item.id} className="border-sky-300">
                  <View className="flex-row items-center justify-between gap-2">
                    <Tag label={ORDER_STATUS[item.status] ?? item.status} tone={item.status === 'awaiting_review' ? 'amber' : 'sky'} />
                    <Text className="font-pj-bd text-[11px] leading-4 text-slate">#{item.reference}</Text>
                  </View>
                  <Text className="font-pj-bd text-[14px] leading-5 text-ink">{item.title}</Text>
                  {item.result ? <Text className="text-[12px] leading-[18px] text-ink">Result: {item.result.summary}</Text> : null}
                  <Text className="text-[11px] leading-4 text-slate">
                    {item.orderingName} · {dayLabel(item.created.date, true)}
                  </Text>
                  {item.result ? <Button label={item.status === 'awaiting_review' ? 'Review Result' : 'View Result'} variant="soft" size="md" onPress={() => router.push(`/results/${item.id}`)} /> : null}
                </Card>
              ))
            : null}
          {tab === 'plans'
            ? plans.map((item) => (
                <Card key={item.id} className="border-sky-300">
                  <View className="flex-row items-center justify-between gap-2">
                    <Tag label={item.status.replace('_', ' ')} tone="teal" />
                    <Text className="font-pj-bd text-[11px] leading-4 text-slate">#{item.reference}</Text>
                  </View>
                  <Text className="font-pj-bd text-[14px] leading-5 text-ink">{item.title}</Text>
                  <Text className="text-[12px] leading-[18px] text-slate">{item.goals.map((goal) => `${goal.title}: ${goal.target}`).join(' · ')}</Text>
                  <Text className="text-[11px] leading-4 text-slate">
                    Lead {item.lead?.displayName ?? '—'} · next review {dayLabel(item.nextReview, true)}
                  </Text>
                </Card>
              ))
            : null}
        </>
      ) : null}
    </Screen>
  );
}
