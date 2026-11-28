import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/layout/Screen';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { DockButton, DocHeader, Pill, SealedDock, SoftCard, T, type } from '@/features/consultation/design';
import { PatientBanner } from '@/features/consultation/PatientBanner';
import { useActiveEncounter } from '@/features/doctor/clinical';
import { addDays, dayLabel, localToday } from '@/features/reception/desk';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useConsultation, type OrderDraft } from '@/state/ConsultationState';
import { useSession } from '@/state/SessionState';
import { useStaff } from '@/state/StaffState';

const DUPLICATE_DAYS = 14;
const detailText = 'text-[#4c4546]';
const isUrgent = (order: OrderDraft) => order.priority !== 'Routine (Outpatient OPD)';

function Stat({ label, value, unit, children }: { label: string; value: string; unit: string; children?: React.ReactNode }) {
  return (
    <SoftCard className="flex-1 justify-between gap-1.5 p-3">
      <T v="kicker">{label}</T>
      <View className="flex-row items-baseline gap-1">
        <Text className="font-pj-bd text-[26px] leading-[34px] tracking-[-0.5px] text-ink">{value}</Text>
        <T v="kicker" className="shrink">{unit}</T>
      </View>
      {children}
    </SoftCard>
  );
}

function OrderCard({ order }: { order: OrderDraft }) {
  const urgent = isUrgent(order);
  return (
    <SoftCard className="gap-3 rounded-2xl">
      <View className="flex-row gap-2">
        <View className="flex-1 gap-1">
          <View className="flex-row flex-wrap items-center gap-1.5">
            <Pill
              label={order.priority}
              icon={urgent ? 'rev-stat' : undefined}
              className={cn('self-center', urgent ? 'bg-[#ffdad6]' : 'bg-sky-200')}
              textClassName={cn('font-pj-sb', urgent ? 'text-[#93000a]' : 'text-ink')}
            />
            <T v="kicker">{order.code}</T>
          </View>
          <T v="heading" className="tracking-[-0.4px]">{order.name}</T>
          <T v="body">{`${order.destination}${order.loinc ? ` • LOINC ${order.loinc}` : ''}`}</T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Change ${order.name}`} onPress={() => (router.canGoBack() ? router.back() : router.replace('/consultation/orders'))}>
          <Icon name="rev-edit-tile" />
        </Pressable>
      </View>
    </SoftCard>
  );
}

function GroupTitle({ title, count, dot }: { title: string; count: string; dot: string }) {
  return (
    <View className="flex-row items-center justify-between gap-2 px-1">
      <View className="flex-1 flex-row items-center gap-2">
        <View className="size-2 rounded-full" style={{ backgroundColor: dot }} />
        <T v="subheading" className="flex-1">{title}</T>
      </View>
      <Pill label={count} className="self-center bg-sky-200" />
    </View>
  );
}

export default function ReviewOrders() {
  const toast = useToast();
  const { call } = useSession();
  const { me } = useStaff();
  const { orders, clearOrders } = useConsultation();
  const { encounter, chart, patient, diagnoses, sealed, reload } = useActiveEncounter();
  const primary = diagnoses.find((item) => item.status === 'active' && item.designation === 'Primary');
  // Starts from the primary diagnosis once the chart has loaded, until the doctor writes their own.
  const [typed, setIndication] = useState<string | null>(null);
  const indication = typed ?? (primary ? `${primary.name} (${primary.icd})` : '');
  const [attested, setAttested] = useState(false);
  const [sending, setSending] = useState(false);

  const lab = orders.filter((order) => order.category === 'Laboratory');
  const other = orders.filter((order) => order.category !== 'Laboratory');
  const urgent = orders.filter(isUrgent).length;
  const since = addDays(localToday(), -DUPLICATE_DAYS);
  const repeats = orders
    .map((order) => ({ order, earlier: (chart.data?.orders ?? []).find((item) => item.status !== 'cancelled' && item.created.date >= since && item.items.some((entry) => entry.code === order.code)) }))
    .filter((entry) => entry.earlier);
  const ready = attested && orders.length > 0 && indication.trim().length > 0;

  const submit = async () => {
    if (!encounter.data || !ready) return;
    setSending(true);
    try {
      await call(`/v1/patients/${encounter.data.patientId}/orders`, { method: 'POST', body: { encounterId: encounter.data.id, indication: indication.trim(), items: orders } });
      const count = orders.length;
      clearOrders();
      reload();
      toast(`${count} ${count === 1 ? 'test' : 'tests'} ordered.`);
      router.push('/consultation/referral');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      className="bg-sky-50"
      bareFooter={sealed}
      footer={sealed ? <SealedDock /> : undefined}
      header={
        <DocHeader
          title="Review Investigation Orders"
          row={
            <View className="flex-row flex-wrap gap-2">
              <Pill label="Draft — Awaiting Confirmation" dot="#00201c" className="bg-mint px-2.5" textClassName="text-deep" />
              {encounter.data ? <Pill label={encounter.data.reference} className="bg-sky-300 px-2.5" textClassName="text-[#526871]" /> : null}
            </View>
          }
        />
      }
      contentClassName="gap-4 px-5 pb-6 pt-1">
      <PatientBanner framed />
      {orders.length === 0 ? (
        <EmptyState title="No tests picked" message="Pick tests on the orders screen first." actionLabel="Pick Tests" onAction={() => router.replace('/consultation/orders')} />
      ) : null}
      <View className="flex-row gap-2">
        <Stat label="LABORATORY" value={String(lab.length)} unit="Tests" />
        <Stat label="IMAGING & OTHER" value={String(other.length)} unit="Tests" />
        <Stat label="URGENT" value={String(urgent)} unit="Priority">
          <T v="kicker" className={urgent ? 'text-danger' : 'text-[#047857]'}>{urgent ? 'Urgent / STAT' : 'All routine'}</T>
        </Stat>
      </View>

      <View className={cn('gap-2.5 rounded-2xl p-4 shadow-sm', repeats.length ? 'bg-[#ffdad6]' : 'bg-mint')}>
        <View className="flex-row items-center gap-2">
          <Icon name="rev-gate" />
          <T v="subheading" className={cn('flex-1 font-pj-bd tracking-[-0.4px]', repeats.length ? 'text-[#93000a]' : 'text-deep')}>
            {repeats.length ? `REPEAT TESTS (${repeats.length})` : 'NO REPEATS IN THE LAST 14 DAYS'}
          </T>
        </View>
        {repeats.map(({ order, earlier }) => (
          <Text key={order.code} className={cn(type.body, 'text-[#93000a]')}>
            {order.name} was ordered on {dayLabel(earlier!.created.date)} ({earlier!.reference}
            {earlier!.result ? `, result: ${earlier!.result.summary}` : ''}). Sending it again is your decision.
          </Text>
        ))}
      </View>

      <SoftCard className="gap-2 rounded-2xl">
        <T v="subheading">Clinical Indication</T>
        <TextField accessibilityLabel="Clinical indication" placeholder="Why these tests are needed" value={indication} onChangeText={setIndication} multiline maxLength={2000} boxClassName="border-sky-150 bg-sky-100" />
      </SoftCard>

      {lab.length > 0 ? (
        <View className="gap-2 pt-2">
          <GroupTitle title="Laboratory" count={`${lab.length} ${lab.length === 1 ? 'Test' : 'Tests'}`} dot="#000000" />
          {lab.map((order) => (
            <OrderCard key={order.code} order={order} />
          ))}
        </View>
      ) : null}
      {other.length > 0 ? (
        <View className="gap-2 pt-2">
          <GroupTitle title="Imaging & Special Diagnostics" count={`${other.length} ${other.length === 1 ? 'Test' : 'Tests'}`} dot="#4d626a" />
          {other.map((order) => (
            <OrderCard key={order.code} order={order} />
          ))}
        </View>
      ) : null}

      <SoftCard className="gap-3 rounded-2xl">
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Clinician confirmation"
          accessibilityState={{ checked: attested, disabled: sealed }}
          disabled={sealed}
          onPress={() => setAttested(!attested)}
          className="flex-row gap-3">
          {attested ? <Icon name="rev-attest" /> : <View className="mt-0.5 size-6 rounded-lg border-2 border-line" />}
          <View className="flex-1 gap-1">
            <T v="label" className="leading-[19px]">
              {`I, ${me.name}, have reviewed these ${orders.length} investigations and their indication for ${patient.data?.fullName ?? 'this patient'}.`}
            </T>
            <T v="body">{"Sending them adds them to the patient's chart and the lab's worklist."}</T>
          </View>
        </Pressable>
      </SoftCard>

      {sealed ? null : (
        <View className="flex-row gap-3 pt-2">
          <DockButton label="Edit" tone="soft" iconLeft="arrow-left-ink" onPress={() => (router.canGoBack() ? router.back() : router.replace('/consultation/orders'))} className="min-h-[52px] rounded-2xl" />
          <DockButton label="Confirm & Send Orders" iconLeft="shield-white-lg" iconRight="arrow-white-sm" loading={sending} disabled={!ready} onPress={submit} className="min-h-[52px] flex-1 rounded-2xl" />
        </View>
      )}
      <T v="kicker" className={cn('text-center', detailText)}>The server records who ordered and when. Results come back to your inbox for review.</T>
    </Screen>
  );
}
