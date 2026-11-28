import { View } from 'react-native';

import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { OrderProgress, ResultCard } from '@/features/health/OrderParts';
import { RecordDetailScreen } from '@/features/health/RecordDetailScreen';
import { ClinicContext, PatientStrip, recordCard, recordKicker, recordMeta, Row } from '@/features/health/RecordKit';
import { ORDER_STATUS, stampText } from '@/lib/records';
import type { DiagnosticOrder } from '@/types';

const body = 'text-[13px] leading-[19px] text-[#566b74]';

export default function OrderDetails() {
  return (
    <RecordDetailScreen<DiagnosticOrder>
      title="Order Details"
      path="/v1/patient/orders"
      listHref="/health/orders"
      subtitle={(order) => `#${order.reference}`}
      shareMessage={(order) => `${order.title} (#${order.reference}), ${ORDER_STATUS[order.status].label}`}>
      {(order) => (
        <>
          <PatientStrip name={order.patientName} detail={`Patient number ${order.mrn}`} />
          <ClinicContext clinicName={order.clinicName} branchName={order.branch.name} />

          <View className={recordCard}>
            <View className="flex-row flex-wrap gap-1.5">
              <Pill label={ORDER_STATUS[order.status].label} tone={ORDER_STATUS[order.status].tone} />
              {order.urgent ? <Pill label="Urgent" tone="red" /> : null}
            </View>
            <Text className={recordKicker}>{order.kind === 'lab' ? 'LABORATORY TEST' : 'IMAGING & DIAGNOSTICS'}</Text>
            <Text className="font-pj-bd text-[18px] leading-6 text-heading">{order.title}</Text>
            <Text className={recordMeta}>{order.category}</Text>
            <View className="gap-1.5 border-t border-edge pt-3">
              <Row label="Order reference" value={`#${order.reference}`} />
              <Row label="Ordered" value={stampText(order.ordered)} />
              <Row label="Ordered by" value={order.orderingName} />
              <Row label="Where" value={order.performing} />
            </View>
            {order.items.length > 1 ? (
              <View className="gap-1 border-t border-edge pt-3">
                {order.items.map((item) => (
                  <Text key={item.name} className={body}>
                    • {item.name} ({item.priority})
                  </Text>
                ))}
              </View>
            ) : null}
            <View className="gap-1 rounded-xl border border-edge bg-[#f8faf9] p-3">
              <Text className={recordKicker}>WHY IT WAS ORDERED</Text>
              <Text className={body}>{order.indication}</Text>
            </View>
          </View>

          <ResultCard order={order} />
          <OrderProgress order={order} />
        </>
      )}
    </RecordDetailScreen>
  );
}
