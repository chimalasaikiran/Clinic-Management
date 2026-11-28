import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { PatientStrip, recordCard, recordMeta, recordTitle, RecordNotice, StatRow } from '@/features/health/RecordKit';
import { counted, RecordListScreen } from '@/features/health/RecordScreen';
import { REFILL } from '@/features/health/RefillPanel';
import { useList } from '@/hooks/useResource';
import { prescriptionState, shortDate } from '@/lib/records';
import { useAccount } from '@/state/SessionState';
import type { Prescription } from '@/types';

type Filter = 'all' | 'active' | 'finished' | 'discontinued';

function PrescriptionCard({ item }: { item: Prescription }) {
  const state = prescriptionState(item);
  return (
    <View className={recordCard}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-pj-bd text-[14px] leading-5 text-heading">
            {shortDate(item.issued.date)} <Text className="text-[12px] text-[#566b74]">#{item.reference}</Text>
          </Text>
          <Text className={recordMeta}>{item.clinicName} · {item.branch.name}</Text>
        </View>
        <Pill label={state.label} tone={state.tone} />
      </View>
      <View className="rounded-xl bg-[#f4f7f6] p-2.5">
        <Text className={recordTitle}>{item.prescriber.name}</Text>
        <Text className={recordMeta}>{[item.prescriber.department, item.indication].filter(Boolean).join(' · ')}</Text>
      </View>
      {item.items.map((medicine) => (
        <View key={`${medicine.name}-${medicine.strength}`} className="gap-1 rounded-xl border border-edge p-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <Text className="font-pj-bd text-[14px] leading-5 text-heading">
              {medicine.name} {medicine.strength}
            </Text>
            <Pill label={medicine.form} tone="sky" />
          </View>
          <Text className={recordMeta}>
            {medicine.dose} · {medicine.frequency} · {medicine.food} · {medicine.durationDays} days
          </Text>
        </View>
      ))}
      <Text className="text-[11px] leading-4 text-[#566b74]">
        {item.dispensedAt ? `Dispensed at the clinic pharmacy on ${shortDate(item.dispensedAt.slice(0, 10))}` : 'Not dispensed at the clinic pharmacy'}
      </Text>
      {item.refill ? <Pill label={REFILL[item.refill.status].label} tone={REFILL[item.refill.status].tone} /> : null}
      <Button label="View Prescription Details" variant={state.key === 'active' ? 'primary' : 'soft'} size="md" onPress={() => router.push(`/health/prescriptions/${item.id}`)} />
    </View>
  );
}

export default function Prescriptions() {
  const account = useAccount();
  const records = useList<Prescription>('/v1/patient/prescriptions?pageSize=50', ['records', 'requests', 'app_access']);
  return (
    <RecordListScreen<Prescription, Filter>
      title="Prescriptions"
      subtitle="Prescriptions issued by your clinic"
      records={records}
      summary={(items) => {
        const active = items.filter((item) => prescriptionState(item).key === 'active');
        return (
          <>
            <PatientStrip name={account?.fullName ?? ''} detail="Signed by your doctor when issued" />
            <StatRow
              stats={[
                { label: 'ACTIVE', value: String(active.length), caption: active.map((item) => item.items[0]?.name).filter(Boolean).slice(0, 2).join(', ') || 'None', highlight: true },
                { label: 'LATEST', value: shortDate(items[0]!.issued.date), caption: items[0]!.prescriber.name },
                { label: 'TOTAL ISSUED', value: String(records.data?.meta.total ?? items.length), caption: 'Prescriptions' },
              ]}
            />
          </>
        );
      }}
      searchPlaceholder="Search prescriptions or medicines..."
      filters={(items) => [
        { value: 'all', label: counted(items, 'All') },
        { value: 'active', label: counted(items, 'Active', (item) => prescriptionState(item).key === 'active') },
        { value: 'finished', label: counted(items, 'Finished', (item) => prescriptionState(item).key === 'finished') },
        { value: 'discontinued', label: counted(items, 'Stopped', (item) => prescriptionState(item).key === 'discontinued') },
      ]}
      searchText={(item) => `${item.reference} ${item.prescriber.name} ${item.indication} ${item.items.map((medicine) => medicine.name).join(' ')}`}
      matches={(item, filter) => filter === 'all' || prescriptionState(item).key === filter}
      renderItems={(items) => items.map((item) => <PrescriptionCard key={item.id} item={item} />)}
      emptyMessage="Prescriptions appear here as soon as your doctor issues them."
      footer={
        <RecordNotice
          title="Clinician-Authored Records"
          body="Prescriptions are signed by your doctor and cannot be changed in the app. Do not change a dose without speaking to your doctor. Open an active prescription to request a refill. Home delivery is not available in the app yet."
        />
      }
    />
  );
}
