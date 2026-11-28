import { router } from 'expo-router';
import { View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { HISTORY, historyHref } from '@/features/health/history';
import { CardLink, PatientStrip, RecordNotice } from '@/features/health/RecordKit';
import { counted, RecordListScreen } from '@/features/health/RecordScreen';
import { useResource } from '@/hooks/useResource';
import type { Listed } from '@/lib/api';
import { dateTime } from '@/lib/dates';
import { useAccount } from '@/state/SessionState';
import type { HistoryEntry, HistoryKind } from '@/types';

type Filter = 'all' | 'consultation' | 'prescription' | 'tests' | 'care_plan';
const isTest = (kind: HistoryKind) => kind === 'order' || kind === 'result';

function Entry({ entry }: { entry: HistoryEntry }) {
  const kind = HISTORY[entry.kind];
  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View className="mt-5 size-3.5 items-center justify-center rounded-full border border-black bg-white">
          <View className="size-1.5 rounded-full bg-black" />
        </View>
        <View className="w-px flex-1 bg-line/50" />
      </View>
      <View className="flex-1 gap-2 rounded-2xl border border-line/40 bg-white p-4">
        <View className="flex-row flex-wrap items-center justify-between gap-1">
          <View className="flex-row items-center gap-1.5">
            <Icon name={kind.icon} size={13} />
            <Text className="font-pj-bd text-[11px] leading-4 text-ink">{kind.label}</Text>
          </View>
          <Text className="text-[12px] leading-[18px] text-slate">{dateTime(entry.at)}</Text>
        </View>
        <View className="gap-0.5">
          <Text className="font-pj-sb text-[18px] leading-6 text-ink">{entry.title}</Text>
          <Text className="font-pj-md text-[14px] leading-5 text-slate">{entry.detail}</Text>
        </View>
        <Text className="text-[12px] leading-4 text-slate">{entry.clinicName}</Text>
        <CardLink label={kind.action} onPress={() => router.push(historyHref(entry))} />
      </View>
    </View>
  );
}

export default function MedicalHistory() {
  const account = useAccount();
  const history = useResource<HistoryEntry[]>('/v1/patient/records/history', ['records', 'app_access']);
  // The timeline is one list; give it the shape the shared list screen reads.
  const records = { ...history, data: history.data ? ({ data: history.data, meta: {} } as Listed<HistoryEntry[]>) : null };
  return (
    <RecordListScreen<HistoryEntry, Filter>
      title="Medical History"
      subtitle="Your records, newest first"
      records={records}
      summary={() => <PatientStrip name={account?.fullName ?? ''} detail="Records released by your connected clinics" />}
      searchPlaceholder="Search records, doctors, medicines..."
      filters={(items) => [
        { value: 'all', label: counted(items, 'All Records') },
        { value: 'consultation', label: counted(items, 'Consultations', (item) => item.kind === 'consultation') },
        { value: 'prescription', label: counted(items, 'Prescriptions', (item) => item.kind === 'prescription') },
        { value: 'tests', label: counted(items, 'Tests & Reports', (item) => isTest(item.kind)) },
        { value: 'care_plan', label: counted(items, 'Care Plans', (item) => item.kind === 'care_plan') },
      ]}
      searchText={(entry) => `${entry.title} ${entry.detail} ${entry.clinicName}`}
      matches={(entry, filter) => filter === 'all' || (filter === 'tests' ? isTest(entry.kind) : entry.kind === filter)}
      renderItems={(entries) =>
        [...new Set(entries.map((entry) => entry.at.slice(0, 4)))].map((year) => (
          <View key={year} className="gap-3">
            <View className="flex-row items-center gap-3">
              <View className="rounded-full bg-sky-300/70 px-3 py-1">
                <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{year}</Text>
              </View>
              <View className="h-px flex-1 bg-line/40" />
            </View>
            {entries
              .filter((entry) => entry.at.startsWith(year))
              .map((entry) => (
                <Entry key={`${entry.kind}-${entry.id}`} entry={entry} />
              ))}
          </View>
        ))
      }
      emptyMessage="Records your clinic releases appear here: consultations, prescriptions, test results and care plans."
      footer={
        <RecordNotice
          title="Clinician-Authored Records"
          body="These records are written and signed by your clinic and cannot be changed in the app. To ask for a correction, contact the clinic that issued the record."
        />
      }
    />
  );
}
