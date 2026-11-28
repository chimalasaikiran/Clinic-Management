import { router } from 'expo-router';
import { Share, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { OrderProgress, ResultCard } from '@/features/health/OrderParts';
import { RecordDetailScreen } from '@/features/health/RecordDetailScreen';
import { CardLink, ClinicContext, PatientStrip, recordCard, recordMeta, recordTitle, Row } from '@/features/health/RecordKit';
import { stampText } from '@/lib/records';
import type { DiagnosticOrder } from '@/types';

export default function ReportDetails() {
  return (
    <RecordDetailScreen<DiagnosticOrder>
      title="Report Details"
      path="/v1/patient/orders"
      listHref="/health/lab-reports"
      subtitle={(report) => `#${report.reference}`}
      shareMessage={(report) => `${report.title} (#${report.reference})${report.result ? `: ${report.result.summary}` : ''}`}>
      {(report) => (
        <>
          <PatientStrip name={report.patientName} detail={`Patient number ${report.mrn}`} badge={report.result ? 'Reviewed' : undefined} />
          <ClinicContext clinicName={report.clinicName} branchName={report.branch.name} />

          <View className={recordCard}>
            <Text className={recordTitle}>{report.title}</Text>
            <Text className={recordMeta}>{report.performing}</Text>
            <View className="gap-1.5 rounded-xl bg-[#f4f7f6] p-3">
              <Row label="Ordered by:" value={report.orderingName} />
              <Row label="Ordered:" value={stampText(report.ordered)} />
            </View>
            <CardLink label={`Order #${report.reference}`} onPress={() => router.push(`/health/orders/${report.id}`)} />
          </View>

          <ResultCard order={report} />
          <OrderProgress order={report} />

          <View className="flex-row gap-2.5">
            <Button
              label="Share with Doctor"
              variant="soft"
              size="md"
              className="flex-1"
              onPress={() => Share.share({ message: `${report.title} (#${report.reference})${report.result ? `: ${report.result.summary}` : ''}` })}
            />
          </View>
        </>
      )}
    </RecordDetailScreen>
  );
}
