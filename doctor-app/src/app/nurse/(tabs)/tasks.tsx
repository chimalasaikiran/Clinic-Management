import { useState } from 'react';
import { View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/layout/Screen';
import { ActionButton, Chip, Glyph, IconTile } from '@/components/staff/ui';
import { FilterChips } from '@/components/ui/FilterChips';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { ageSex, minutesSince, useNow } from '@/features/reception/desk';
import type { Order } from '@/features/doctor/clinical';
import { recordVitalsFor } from '@/features/nurse/PatientCard';
import { ConfirmSheet, ForestCard, NurseHeader, SectionTitle } from '@/features/nurse/ui';
import { useWard } from '@/features/nurse/ward';
import { errorMessage } from '@/lib/api';
import { useResource } from '@/hooks/useResource';
import { useSession } from '@/state/SessionState';
import colors from '@/theme/colors';

type Category = 'all' | 'vitals' | 'specimens';

/** Work that is waiting on nursing, worked out from the records: vitals not yet taken and specimens not collected. */
export default function NurseTasks() {
  const toast = useToast();
  const now = useNow();
  const { call, can } = useSession();
  const { day, present, needsVitals, specimens } = useWard();
  const [category, setCategory] = useState<Category>('all');
  const [collecting, setCollecting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const detail = useResource<Order>(collecting ? `/v1/orders/${collecting}` : null);

  const data = day.data;
  const taken = present.filter((row) => !!row.vitals).length;
  const showVitals = category === 'all' || category === 'vitals';
  const showSpecimens = category === 'all' || category === 'specimens';
  const total = needsVitals.length + specimens.total;

  const collect = async () => {
    if (!collecting) return;
    setSaving(true);
    try {
      await call(`/v1/orders/${collecting}/collect`, { method: 'POST', body: { note: note.trim() } });
      toast('Specimen marked as collected.');
      setCollecting(null);
      setNote('');
      day.reload();
    } catch (error) {
      toast(errorMessage(error));
      day.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen inTabs className="bg-sky-50" header={<NurseHeader title="Nursing Tasks" subtitle="Vitals and specimens waiting today" />} contentClassName="gap-3.5 px-4 pt-3 pb-6">
      <ForestCard>
        <View className="flex-row gap-2">
          {[
            ['OPEN', total, 'text-white'],
            ['VITALS DUE', needsVitals.length, 'text-[#fcd34d]'],
            ['SPECIMENS', specimens.total, 'text-[#fda4af]'],
            ['VITALS DONE', taken, 'text-[#6ee7b7]'],
          ].map(([label, value, color]) => (
            <View key={label as string} className="flex-1 items-center rounded-xl bg-white/5 py-2">
              <Text className={`font-pj-bd text-[20px] leading-7 ${color}`}>{value}</Text>
              <Text className="font-pj-bd text-[9px] leading-[13px] text-white/70">{label}</Text>
            </View>
          ))}
        </View>
      </ForestCard>
      <FilterChips
        options={[
          { value: 'all' as const, label: `All  ${total}` },
          { value: 'vitals' as const, label: `Vitals  ${needsVitals.length}` },
          { value: 'specimens' as const, label: `Specimens  ${specimens.total}` },
        ]}
        value={category}
        onChange={setCategory}
      />
      {day.error && !data ? <ErrorState message={day.error.message} onAction={day.reload} /> : null}
      {!data && !day.error ? <LoadingState label="Loading tasks…" /> : null}
      {data && total === 0 ? <EmptyState title="All clear" message="No vitals or specimens are waiting." /> : null}

      {data && showVitals && needsVitals.length ? (
        <>
          <SectionTitle title="Record Vitals" icon="monitor-heart" />
          {needsVitals.map((row) => (
            <View key={row.id} className="gap-2 rounded-2xl border border-sky-150/50 bg-white p-3.5" style={{ borderLeftWidth: 5, borderLeftColor: '#f59e0b' }}>
              <View className="flex-row items-center justify-between gap-2">
                <Text className="flex-1 font-pj-bd text-[14px] leading-5 text-ink">
                  {row.patient.fullName} <Text className="text-[11px] text-slate">{ageSex(row.patient, data.today)}</Text>
                </Text>
                {row.arrivedAt ? <Chip label={`${minutesSince(row.arrivedAt, now)}m waiting`} tone="amber" /> : null}
              </View>
              <Text className="text-[12px] leading-[17px] text-slate">
                {row.token ? `Token ${row.token} · ` : ''}
                {row.patient.mrn} · for {row.practitioner.displayName}
              </Text>
              <ActionButton large tone="dark" label="Record Vitals" icon="show-chart" onPress={() => recordVitalsFor(row)} />
            </View>
          ))}
        </>
      ) : null}

      {data && showSpecimens && specimens.items.length ? (
        <>
          <SectionTitle title="Collect Specimens" icon="science" />
          {specimens.items.map((order) => (
            <View key={order.id} className="gap-2 rounded-2xl border border-sky-150/50 bg-white p-3.5" style={{ borderLeftWidth: 5, borderLeftColor: order.urgent ? '#ba1a1a' : '#14b8a6' }}>
              <View className="flex-row items-start gap-2">
                <IconTile icon="science" box={order.urgent ? 'bg-[#ffdad6]' : 'bg-sky-150'} />
                <View className="flex-1">
                  <Text className="font-pj-bd text-[14px] leading-5 text-ink">{order.title}</Text>
                  <Text className="text-[12px] leading-[17px] text-slate">
                    {order.patient.fullName} · {order.patient.mrn} · {ageSex(order.patient, data.today)}
                  </Text>
                </View>
                {order.urgent ? <Chip label="Urgent" tone="red" /> : null}
              </View>
              {can('clinical.vitals') ? <ActionButton large tone="white" label="Mark Collected" icon="check" onPress={() => setCollecting(order.id)} /> : null}
            </View>
          ))}
          {specimens.total > specimens.items.length ? (
            <Text className="text-center text-[12px] leading-4 text-slate">{specimens.total - specimens.items.length} more appear as these are collected.</Text>
          ) : null}
        </>
      ) : null}

      <View className="flex-row gap-2.5 rounded-2xl bg-sky-100 p-3">
        <Glyph name="info-outline" size={16} color={colors.slate} />
        <Text className="flex-1 text-[12px] leading-[17px] text-slate">
          Room preparation, patient transfers and other ward tasks are not tracked in ClinicOS yet.
        </Text>
      </View>

      <ConfirmSheet
        visible={!!collecting}
        onClose={() => {
          setCollecting(null);
          setNote('');
        }}
        title="Mark specimen collected?"
        message={
          detail.data
            ? `${detail.data.items.map((item) => item.name).join(', ')} — ${detail.data.indication}. Check the patient's name and ID against the tube label first.`
            : 'Check the patient’s name and ID against the tube label first.'
        }
        confirmLabel="Mark Collected"
        busy={saving}
        onConfirm={collect}>
        <TextField label="Collection note" optionalLabel value={note} onChangeText={setNote} maxLength={1000} placeholder="For example: fasting sample, left arm" />
      </ConfirmSheet>
    </Screen>
  );
}
