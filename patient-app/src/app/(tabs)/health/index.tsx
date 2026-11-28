import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { HISTORY, historyHref } from '@/features/health/history';
import { useResource } from '@/hooks/useResource';
import { cn } from '@/lib/cn';
import { dateTime } from '@/lib/dates';
import { formatMobile } from '@/lib/validation';
import { useAccount } from '@/state/SessionState';
import type { IconName } from '@/theme/icons';
import type { ClinicLink, HistoryEntry, RecordsOverview } from '@/types';

type Module = {
  icon: IconName;
  title: string;
  line: string;
  note: string;
  count: string;
  href: Href;
  highlight?: boolean;
};

const sectionTitle = 'font-pj-bd text-[18px] leading-6 text-ink';
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const latestLine = (entry: HistoryEntry | null, fallback: string) => (entry ? entry.title : fallback);
const latestNote = (entry: HistoryEntry | null) => (entry ? dateTime(entry.at) : 'Nothing yet');

function modules({ counts, latest }: RecordsOverview): Module[] {
  return [
    { icon: 'module-consultations', title: 'Consultations', line: latestLine(latest.consultation, 'No signed visits'), note: latestNote(latest.consultation), count: plural(counts.consultations, 'Visit'), href: '/health/consultations' },
    { icon: 'module-prescriptions', title: 'Prescriptions', line: latestLine(latest.prescription, 'None issued'), note: latestNote(latest.prescription), count: `${counts.activePrescriptions} Active`, href: '/health/prescriptions', highlight: counts.activePrescriptions > 0 },
    { icon: 'module-lab', title: 'Lab & Diagnostics', line: latestLine(latest.result, 'No results yet'), note: latestNote(latest.result), count: plural(counts.reportsReady, 'Report'), href: '/health/lab-reports' },
    { icon: 'module-orders', title: 'Diagnostic Orders', line: latestLine(latest.order ?? latest.result, 'No tests ordered'), note: `${counts.openOrders} in progress`, count: plural(counts.orders, 'Order'), href: '/health/orders' },
    { icon: 'module-careplans', title: 'Care Plans', line: latestLine(latest.care_plan, 'No care plans'), note: latestNote(latest.care_plan), count: `${counts.activePlans} Active`, href: '/health/care-plans' },
    { icon: 'module-scans', title: 'Medical History', line: 'All records together', note: 'Newest first', count: 'Timeline', href: '/health/history' },
  ];
}

export default function MyHealth() {
  const toast = useToast();
  const account = useAccount();
  const overview = useResource<RecordsOverview>('/v1/patient/records/overview', ['records', 'app_access']);
  const links = useResource<ClinicLink[]>('/v1/patient/links', ['app_access']);
  const connected = links.data ?? [];
  const name = account?.fullName ?? '';

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <View className="flex-row items-center gap-3 border-b border-line/20 bg-sky-50 px-5 py-2.5">
          <View className="size-9 items-center justify-center rounded-full border border-teal-200 bg-teal-100">
            <Text className="font-pj-bd text-[13px] leading-5 text-teal">{name.slice(0, 1).toUpperCase()}</Text>
          </View>
          <Text className="flex-1 font-pj-bd text-[18px] leading-6 text-ink">Clinic OS</Text>
          <IconButton icon="search" label="Search records" className="border border-line/30 bg-white" onPress={() => router.push('/health/history')} />
          <IconButton icon="bell" label="Notifications" className="border border-line/30 bg-white" onPress={() => router.push('/health/notifications')} />
        </View>
      }
      contentClassName="gap-4 pt-3 pb-6">
      <View>
        <Text className="font-pj-md text-[11px] leading-4 text-slate">YOUR CLINIC RECORDS</Text>
        <Text accessibilityRole="header" className="font-pj-xb text-[28px] leading-9 text-ink">
          My Health
        </Text>
      </View>

      <LinearGradient
        colors={['#0c232c', '#10303b', '#08171d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 22, borderWidth: 1, borderColor: '#234552', padding: 16, gap: 12 }}>
        <View className="gap-1">
          <Text className="font-pj-md text-[11px] leading-4 text-[#94a3b8]">RECORD HOLDER</Text>
          <Text className="font-pj-bd text-[18px] leading-6 text-white">{name}</Text>
          {account ? <Text className="text-[13px] leading-[18px] text-[#cbd5e1]">+91 {formatMobile(account.mobile)}</Text> : null}
        </View>
        <View className="gap-1 border-t border-white/10 pt-2.5">
          <Text className="font-pj-md text-[11px] leading-4 text-[#94a3b8]">CLINIC PATIENT NUMBERS</Text>
          {connected.length ? (
            connected.map((link) => (
              <Text key={link.id} className="font-pj-bd text-[12px] leading-[18px] text-[#a7f3d0]">
                {link.mrn} · {link.clinicName}
              </Text>
            ))
          ) : (
            <Text className="text-[12px] leading-[18px] text-[#cbd5e1]">No clinic connected yet</Text>
          )}
        </View>
        <Text className="border-t border-white/10 pt-2.5 text-[11px] leading-4 text-[#94a3b8]">
          National health ID (ABHA): linking is not available in the app yet.
        </Text>
      </LinearGradient>

      {!overview.data ? (
        overview.error ? (
          <ErrorState message={overview.error.message} onAction={overview.reload} />
        ) : (
          <LoadingState label="Loading your records…" />
        )
      ) : (
        <>
          <View className="gap-2.5">
            <View className="flex-row items-center gap-1.5">
              <Icon name="grid-slate" />
              <Text className={sectionTitle}>Record Modules</Text>
            </View>
            <View className="flex-row flex-wrap justify-between gap-y-3">
              {modules(overview.data).map((item) => (
                <Pressable
                  key={item.title}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}, ${item.count}`}
                  onPress={() => router.push(item.href)}
                  className={cn('w-[48.3%] gap-3 rounded-2xl border p-3.5 active:opacity-80', item.highlight ? 'border-[#a8cec6] bg-mint/20' : 'border-line/30 bg-white')}>
                  <View className="flex-row items-start justify-between">
                    <View className={cn('size-9 items-center justify-center rounded-xl', item.highlight ? 'bg-[#a8cec6]/80' : 'bg-sky-150')}>
                      <Icon name={item.icon} />
                    </View>
                    <View className={cn('rounded-full px-2 py-0.5', item.highlight ? 'bg-mint' : 'bg-sky-200')}>
                      <Text className="font-pj-sb text-[11px] leading-4 text-ink">{item.count}</Text>
                    </View>
                  </View>
                  <View className="gap-0.5">
                    <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{item.title}</Text>
                    <Text numberOfLines={1} className="font-pj-bd text-[11px] leading-4 text-slate">{item.line}</Text>
                    <Text className="text-[11px] leading-4 text-slate">{item.note}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="gap-2.5">
            <View className="flex-row items-center justify-between">
              <Text className={sectionTitle}>Recent Activity</Text>
              <Pressable accessibilityRole="link" hitSlop={10} onPress={() => router.push('/health/history')}>
                <Text className="font-pj-sb text-[11px] leading-4 text-black">View All →</Text>
              </Pressable>
            </View>
            {overview.data.recent.length === 0 ? (
              <Text className="rounded-2xl border border-line/30 bg-white p-3.5 text-[13px] leading-[18px] text-slate">
                Records your clinic releases appear here.
              </Text>
            ) : (
              overview.data.recent.map((entry) => (
                <Pressable
                  key={`${entry.kind}-${entry.id}`}
                  accessibilityRole="button"
                  onPress={() => router.push(historyHref(entry))}
                  className="gap-2 rounded-2xl border border-line/30 bg-white p-3.5">
                  <View className="flex-row items-start gap-2.5">
                    <View className="size-9 items-center justify-center rounded-xl bg-sky-150">
                      <Icon name={HISTORY[entry.kind].icon} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-pj-bd text-[11px] leading-4 text-slate">{HISTORY[entry.kind].label}</Text>
                      <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{entry.title}</Text>
                      <Text className="font-pj-md text-[13px] leading-[18px] text-slate">{entry.detail}</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between border-t border-line/15 pt-2">
                    <Text className="text-[11px] leading-4 text-slate">
                      {entry.clinicName} · {dateTime(entry.at)}
                    </Text>
                    <Icon name="chevron-right-slate" />
                  </View>
                </Pressable>
              ))
            )}
          </View>
        </>
      )}

      <View className="gap-3 rounded-2xl border border-[#a8cec6]/70 bg-white p-4">
        <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">Who can see these records</Text>
        <Text className="text-[12px] leading-[18px] text-slate">
          Each clinic sees only the records it holds for you. You see the records of the clinics connected to your account, once they are released.
        </Text>
        <View className="flex-row gap-2">
          <Button label="Connected Clinics" variant="soft" size="md" className="flex-1 bg-sky-150" onPress={() => router.push('/security')} />
          <Button
            label="Export Records"
            iconLeft="download"
            iconColor="#ffffff"
            size="md"
            className="flex-1"
            onPress={() => toast('Exporting your records is not available yet.')}
          />
        </View>
      </View>
    </Screen>
  );
}
