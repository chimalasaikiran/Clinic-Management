import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { PatientStrip, recordCard, recordMeta, recordTitle, RecordNotice, Row, StatRow } from '@/features/health/RecordKit';
import { counted, RecordListScreen } from '@/features/health/RecordScreen';
import { useList } from '@/hooks/useResource';
import { ORDER_STATUS, stampText } from '@/lib/records';
import { useAccount } from '@/state/SessionState';
import type { DiagnosticOrder } from '@/types';

type Filter = 'all' | 'open' | 'reviewed' | 'cancelled';
const isOpen = (order: DiagnosticOrder) => ['ordered', 'processing', 'awaiting_review'].includes(order.status);

function OrderCard({ order }: { order: DiagnosticOrder }) {
  const status = ORDER_STATUS[order.status];
  return (
    <View className={recordCard}>
      <View className="flex-row flex-wrap gap-1.5">
        <Pill label={status.label} tone={status.tone} />
        {order.urgent ? <Pill label="Urgent" tone="red" /> : null}
      </View>
      <View>
        <Text className={recordTitle}>{order.title}</Text>
        <Text className={recordMeta}>{order.category}</Text>
      </View>
      <View className="gap-1.5 rounded-xl bg-[#f4f7f6] p-3">
        <Row label="Order reference:" value={`#${order.reference}`} />
        <Row label="Ordered:" value={stampText(order.ordered)} />
        <Row label="Ordered by:" value={order.orderingName} />
        <Row label="Where:" value={order.performing} />
      </View>
      <Button
        label={order.result ? 'View Result' : 'View Order Details'}
        variant={order.result ? 'primary' : 'soft'}
        size="md"
        onPress={() => router.push(`/health/orders/${order.id}`)}
      />
    </View>
  );
}

export default function DiagnosticOrders() {
  const account = useAccount();
  const records = useList<DiagnosticOrder>('/v1/patient/orders?pageSize=50', ['records', 'app_access']);
  return (
    <RecordListScreen<DiagnosticOrder, Filter>
      title="Diagnostic Orders"
      subtitle="Tests your doctor has ordered"
      records={records}
      summary={(items) => (
        <>
          <PatientStrip name={account?.fullName ?? ''} detail="Results are shown after your doctor reviews them" />
          <StatRow
            stats={[
              { label: 'IN PROGRESS', value: String(items.filter(isOpen).length), caption: 'Not yet released', highlight: true },
              { label: 'RESULTS READY', value: String(items.filter((item) => item.result).length), caption: 'Reviewed' },
              { label: 'TOTAL', value: String(records.data?.meta.total ?? items.length), caption: 'Orders' },
            ]}
          />
        </>
      )}
      searchPlaceholder="Search tests..."
      filters={(items) => [
        { value: 'all', label: counted(items, 'All') },
        { value: 'open', label: counted(items, 'In progress', isOpen) },
        { value: 'reviewed', label: counted(items, 'Result ready', (item) => item.status === 'reviewed') },
        { value: 'cancelled', label: counted(items, 'Cancelled', (item) => item.status === 'cancelled') },
      ]}
      searchText={(order) => `${order.title} ${order.category} ${order.reference}`}
      matches={(order, filter) => filter === 'all' || (filter === 'open' ? isOpen(order) : order.status === filter)}
      renderItems={(items) => items.map((order) => <OrderCard key={order.id} order={order} />)}
      emptyMessage="Tests your doctor orders appear here, with their progress."
      footer={
        <RecordNotice
          title="When results are released"
          body="A result is shown here only after your doctor has reviewed it. To change a test appointment, contact the clinic."
        />
      }
    />
  );
}
