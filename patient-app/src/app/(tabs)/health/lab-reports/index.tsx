import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { PatientStrip, recordCard, recordKicker, recordMeta, recordTitle, RecordNotice, Row, StatRow } from '@/features/health/RecordKit';
import { counted, RecordListScreen } from '@/features/health/RecordScreen';
import { useList } from '@/hooks/useResource';
import { dateTime } from '@/lib/dates';
import { FLAG, ORDER_STATUS, stampText } from '@/lib/records';
import { useAccount } from '@/state/SessionState';
import type { DiagnosticOrder } from '@/types';

type Filter = 'all' | 'available' | 'processing';

function ReportCard({ report }: { report: DiagnosticOrder }) {
  const result = report.result;
  const flag = result?.flag ? FLAG[result.flag] : null;
  return (
    <View className={recordCard}>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Pill label={result ? 'Available' : ORDER_STATUS[report.status].label} tone={result ? 'mint' : 'amber'} />
        <Text className="text-[11px] leading-4 text-[#566b74]">#{report.reference}</Text>
      </View>
      <View>
        <Text className={recordTitle}>{report.title}</Text>
        <Text className={recordMeta}>{report.performing} · {report.clinicName}</Text>
      </View>
      <View className="gap-1.5 rounded-xl bg-[#f4f7f6] p-3">
        <Row label="Ordered by:" value={report.orderingName} />
        <Row label="Ordered:" value={stampText(report.ordered)} />
        {result?.reviewedAt ? <Row label="Released:" value={dateTime(result.reviewedAt)} /> : null}
      </View>
      {result ? (
        <View className="gap-1 rounded-xl border border-edge p-3">
          <Text className="font-pj-bd text-[11px] leading-4 text-teal">REVIEWED RESULT</Text>
          <Text numberOfLines={3} className="text-[13px] leading-[18px] text-heading">{result.summary}</Text>
          {flag ? <Pill label={flag.label} tone={flag.tone} /> : null}
        </View>
      ) : (
        <Text className={recordMeta}>The report unlocks once your doctor has reviewed it.</Text>
      )}
      <Button
        label={result ? 'View Report' : 'Track Status'}
        variant={result ? 'primary' : 'soft'}
        size="md"
        onPress={() => router.push(result ? `/health/lab-reports/${report.id}` : `/health/orders/${report.id}`)}
      />
    </View>
  );
}

export default function LabReports() {
  const account = useAccount();
  const records = useList<DiagnosticOrder>('/v1/patient/orders?scope=results&pageSize=50', ['records', 'app_access']);
  return (
    <RecordListScreen<DiagnosticOrder, Filter>
      title="Lab Reports"
      subtitle="Test results your doctor has released"
      records={records}
      summary={(items) => (
        <>
          <PatientStrip name={account?.fullName ?? ''} detail="Reports appear after your doctor's review" />
          <StatRow
            stats={[
              { label: 'Available', value: String(items.filter((item) => item.result).length), caption: 'Reviewed', highlight: true },
              { label: 'In Processing', value: String(items.filter((item) => !item.result).length), caption: 'Not yet released' },
              { label: 'Total Tests', value: String(records.data?.meta.total ?? items.length), caption: 'Done or under way' },
            ]}
          />
          <Text className={`${recordKicker} px-1`}>REPORTS</Text>
        </>
      )}
      searchPlaceholder="Search tests or reports..."
      filters={(items) => [
        { value: 'all', label: counted(items, 'All') },
        { value: 'available', label: counted(items, 'Available', (item) => !!item.result) },
        { value: 'processing', label: counted(items, 'Processing', (item) => !item.result) },
      ]}
      searchText={(report) => `${report.title} ${report.performing} ${report.reference}`}
      matches={(report, filter) => filter === 'all' || (filter === 'available' ? !!report.result : !report.result)}
      renderItems={(reports) => reports.map((report) => <ReportCard key={report.id} report={report} />)}
      emptyMessage="Test results appear here once a test has been done."
      footer={
        <RecordNotice
          title="Clinician-Reviewed Results"
          body="Results are released only after your doctor has reviewed them, and cannot be changed in the app. For what a result means for you, talk to your doctor. Downloading a report is not available in the app yet."
        />
      }
    />
  );
}
