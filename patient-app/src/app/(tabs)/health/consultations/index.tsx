import { router } from 'expo-router';
import { View } from 'react-native';

import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { CardLink, PatientStrip, recordCard, recordMeta, recordTitle, RecordNotice, StatRow } from '@/features/health/RecordKit';
import { counted, RecordListScreen } from '@/features/health/RecordScreen';
import { useList } from '@/hooks/useResource';
import { clinicianLine, shortDate } from '@/lib/records';
import { clock } from '@/lib/visit';
import { useAccount } from '@/state/SessionState';
import type { Consultation } from '@/types';

type Filter = 'all' | 'prescriptions' | 'orders';

function ConsultationCard({ item }: { item: Consultation }) {
  const name = item.practitioner?.displayName ?? item.signedBy ?? 'Clinic team';
  const links = [
    item.prescriptions ? `${item.prescriptions} prescription${item.prescriptions === 1 ? '' : 's'}` : null,
    item.orders ? `${item.orders} test order${item.orders === 1 ? '' : 's'}` : null,
  ].filter((link): link is string => !!link);
  return (
    <View className={recordCard}>
      <View className="flex-row items-center justify-between gap-2 border-b border-[#eef2f4] pb-2.5">
        <Text className="font-pj-bd text-[14px] leading-5 text-heading">
          {shortDate(item.started.date)} <Text className="font-pj-md text-[13px] text-[#566b74]">· {clock(item.started.time)}</Text>
        </Text>
        <Pill label="Signed" />
      </View>
      <View className="flex-row gap-3">
        <View className="size-11 items-center justify-center rounded-[18px] border border-teal-200 bg-teal-100">
          <Text className="font-pj-bd text-[14px] text-teal">{name.replace(/^Dr\.?\s*/, '').slice(0, 2).toUpperCase()}</Text>
        </View>
        <View className="flex-1">
          <Text className={recordTitle}>{clinicianLine(item.practitioner, item.signedBy)}</Text>
          <Text className={recordMeta}>#{item.reference} · {item.type}</Text>
          <Text className={recordMeta}>
            {item.clinicName} · {item.branch.name}
          </Text>
        </View>
      </View>
      <View className="gap-1 rounded-[18px] border border-edge/70 bg-[#f8faf9] p-3">
        <Text className="font-pj-bd text-[11px] leading-4 text-teal">REASON FOR VISIT</Text>
        <Text className="text-[13px] leading-[18px] text-heading">{item.reason}</Text>
        {item.diagnoses.length ? (
          <Text className="pt-1 text-[12px] leading-[18px] text-[#566b74]">
            Diagnosis: {item.diagnoses.map((diagnosis) => diagnosis.name).join('; ')}
          </Text>
        ) : null}
      </View>
      {links.length ? (
        <View className="flex-row flex-wrap gap-1.5">
          {links.map((link) => (
            <Pill key={link} label={link} tone="plain" />
          ))}
        </View>
      ) : null}
      <CardLink label="View Full Consultation Note" onPress={() => router.push(`/health/consultations/${item.id}`)} />
    </View>
  );
}

export default function ConsultationHistory() {
  const account = useAccount();
  const records = useList<Consultation>('/v1/patient/consultations?pageSize=50', ['records', 'app_access']);
  return (
    <RecordListScreen<Consultation, Filter>
      title="Consultation History"
      subtitle="Signed summaries of your clinic visits"
      records={records}
      summary={(items) => (
        <>
          <PatientStrip name={account?.fullName ?? ''} detail="Only signed consultations are shown" />
          <StatRow
            stats={[
              { label: 'TOTAL', value: String(records.data?.meta.total ?? items.length), caption: 'Signed visits' },
              { label: 'WITH PRESCRIPTION', value: String(items.filter((item) => item.prescriptions).length), caption: 'Visits', highlight: true },
              { label: 'MOST RECENT', value: shortDate(items[0]!.started.date), caption: items[0]!.practitioner?.displayName ?? items[0]!.signedBy ?? items[0]!.clinicName },
            ]}
          />
        </>
      )}
      searchPlaceholder="Search consultations, doctors, diagnoses..."
      filters={(items) => [
        { value: 'all', label: counted(items, 'All') },
        { value: 'prescriptions', label: counted(items, 'With prescription', (item) => item.prescriptions > 0) },
        { value: 'orders', label: counted(items, 'With tests', (item) => item.orders > 0) },
      ]}
      searchText={(item) => `${item.practitioner?.displayName ?? ''} ${item.type} ${item.reason} ${item.diagnoses.map((diagnosis) => diagnosis.name).join(' ')}`}
      matches={(item, filter) => filter === 'all' || (filter === 'prescriptions' ? item.prescriptions > 0 : item.orders > 0)}
      renderItems={(items) => items.map((item) => <ConsultationCard key={item.id} item={item} />)}
      emptyMessage="Visit summaries appear here once your doctor signs them."
      footer={
        <RecordNotice
          title="Clinician-Authored Records"
          body="Consultation notes are written and signed by your doctor and cannot be changed in the app. If something looks wrong, ask the clinic. Corrections are added as dated notes."
        />
      }
    />
  );
}
