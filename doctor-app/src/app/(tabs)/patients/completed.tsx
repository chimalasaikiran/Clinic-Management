import { router } from 'expo-router';
import { Pressable, Share, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { DockButton, DocHeader, Pill, SoftCard, T, type } from '@/features/consultation/design';
import { followUpLine, useActiveEncounter, useClinicalDay } from '@/features/doctor/clinical';
import { ageSex, clock, dayLabel, initialsOf, localToday, minutesSince, useNow } from '@/features/reception/desk';
import { cn } from '@/lib/cn';
import { useStaff } from '@/state/StaffState';
import type { IconName } from '@/theme/icons';

const dim = 'text-[#cfc4c5]';
const toC = (fahrenheit: number) => Math.round(((fahrenheit - 32) * 5) / 9 * 10) / 10;

function Label({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Icon name={icon} />
      <T v="kicker" className="shrink">{text}</T>
    </View>
  );
}

export default function ConsultationCompleted() {
  const toast = useToast();
  const { me } = useStaff();
  const { encounter, patient, vitals, diagnoses, prescriptions, orders, referrals, followUp, chart, sealed } = useActiveEncounter();
  const day = useClinicalDay();
  const now = useNow();

  if (!encounter.data || !patient.data || !sealed) {
    return (
      <Screen inTabs header={<AppHeader title="Consultation Completed" />} className="bg-sky-50" contentClassName="px-4 pt-6">
        {encounter.loading ? (
          <LoadingState label="Loading the summary…" />
        ) : (
          <EmptyState title="No signed consultation" message="A summary appears here once you sign an encounter." actionLabel="Open Today" onAction={() => router.navigate('/today')} />
        )}
      </Screen>
    );
  }

  const visit = encounter.data;
  const person = patient.data;
  const latest = vitals[0];
  const note = (chart.data?.notes ?? []).find((item) => item.encounterId === visit.id);
  const plans = (chart.data?.carePlans ?? []).filter((plan) => plan.created.date >= visit.started.date);
  const planned = followUpLine(visit.soap.plan);
  const myId = day.data?.me.practitionerId;
  const next = (day.data?.appointments ?? [])
    .filter((row) => row.status === 'arrived' && (!myId || row.practitioner.id === myId))
    .sort((a, b) => (a.arrivedAt ?? '').localeCompare(b.arrivedAt ?? ''))[0];

  const shareSummary = () => {
    const lines = [
      `Encounter ${visit.reference} · ${person.fullName} (${person.mrn})`,
      `Doctor: ${visit.practitioner?.displayName ?? me.name}`,
      `Diagnoses: ${diagnoses.map((item) => `${item.name} (${item.icd})`).join(', ') || 'None'}`,
      `Medicines: ${prescriptions.flatMap((rx) => rx.items.map((item) => `${item.name} ${item.strength}`)).join(', ') || 'None'}`,
      `Investigations: ${orders.map((order) => order.title).join(', ') || 'None'}`,
    ];
    Share.share({ message: lines.join('\n') }).catch(() => toast('This device cannot share the summary.'));
  };

  return (
    <Screen inTabs className="bg-sky-50" header={<DocHeader title="Encounter Signed" chevron below={<Pill label="SIGNED" className="bg-mint" textClassName="text-deep" />} />} contentClassName="gap-3.5 px-5 pb-6 pt-1">
      <View className="flex-row gap-2 overflow-hidden rounded-xl bg-sky-100 p-4">
        <View className="absolute -right-6 -top-6 size-28 rounded-full bg-sky-300/40" />
        <Icon name="cd-done" />
        <View className="flex-1 gap-1">
          <Text accessibilityRole="header" className="font-pj-sb text-[22px] leading-7 text-ink">
            Consultation Completed
          </Text>
          <T v="para" className="text-slate">The encounter is signed and locked, its note is on the chart and the visit is marked complete.</T>
          {visit.signed ? (
            <View className="flex-row items-center gap-2 pt-2">
              <View className="size-2 rounded-full bg-slate" />
              <T v="kicker" className="flex-1">{`Signed ${dayLabel(visit.signed.date, true)}, ${clock(visit.signed.time)}${visit.signed.by ? ` by ${visit.signed.by}` : ''}`}</T>
            </View>
          ) : null}
        </View>
      </View>

      <View className="gap-3 rounded-xl bg-[#1b1b1b] p-4">
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-row items-center gap-1.5">
            <Icon name="cd-locked" />
            <T v="kicker" className="text-mint">LOCKED · ADDENDA ONLY</T>
          </View>
          <T v="kicker" className={dim}>{visit.reference}</T>
        </View>
        <View className="flex-row gap-2">
          <View className="size-12 items-center justify-center rounded-full bg-slate">
            <T v="heading" className="text-white">{initialsOf(person.fullName)}</T>
          </View>
          <View className="flex-1 gap-0.5">
            <View className="flex-row flex-wrap items-center gap-2">
              <T v="heading" className="text-white">{person.fullName}</T>
              <Pill label={[ageSex(person, localToday()), person.bloodGroup].filter(Boolean).join(' • ')} className="self-center bg-slate" textClassName="text-white" />
            </View>
            <T v="body" className={dim}>{`${person.mrn} • ${visit.branch.name}`}</T>
          </View>
        </View>
        <View className="gap-1.5 rounded-lg bg-black/30 px-2.5 py-3.5">
          <View className="flex-row items-center justify-between gap-2">
            <T v="body" className={dim}>Doctor</T>
            <T v="label" className="flex-1 text-right text-white">{visit.practitioner?.displayName ?? me.name}</T>
          </View>
          <View className="flex-row items-center justify-between gap-2">
            <T v="body" className={dim}>Visit</T>
            <T v="body" className="flex-1 text-right text-white">{visit.type}</T>
          </View>
        </View>
      </View>

      <SoftCard className="gap-3">
        <View className="gap-1">
          <Label icon="cd-complaint" text="CHIEF COMPLAINT" />
          <T v="para">{visit.chiefComplaint}</T>
        </View>
        <View className="gap-1 rounded-lg bg-sky-100 px-2.5 py-2">
          <Label icon="cd-dx" text="DIAGNOSES (ICD-10)" />
          {diagnoses.map((item) => (
            <View key={item.id} className="flex-row items-center justify-between gap-2">
              <T v={item.designation === 'Primary' ? 'label' : 'para'} className={cn('flex-1', item.designation !== 'Primary' && 'text-slate')}>{item.name}</T>
              <View className="rounded bg-sky-150 px-1.5 py-0.5">
                <T v="kicker" className="text-ink">{item.icd}</T>
              </View>
            </View>
          ))}
        </View>
      </SoftCard>

      {latest ? (
        <SoftCard className="gap-2">
          <Label icon="cd-vitals" text="ENCOUNTER VITALS" />
          <View className="flex-row gap-2">
            {[
              ['BP (mmHg)', `${latest.systolic}/${latest.diastolic}`, ''],
              ['Pulse', String(latest.pulse), 'bpm'],
              ['SpO2', `${latest.spo2}%`, ''],
              ['Temp', String(toC(latest.temperatureF)), '°C'],
            ].map(([label, value, unit]) => (
              <View key={label} className="flex-1 gap-0.5 rounded-lg bg-sky-100 p-2">
                <T v="kicker">{label}</T>
                <Text className={type.item}>
                  {value}
                  {unit ? <Text className={type.body}> {unit}</Text> : null}
                </Text>
              </View>
            ))}
          </View>
        </SoftCard>
      ) : null}

      <SoftCard className="gap-2">
        <View className="flex-row items-center justify-between gap-2">
          <Label icon="cd-rx" text="PRESCRIPTIONS" />
          <T v="kicker">{prescriptions.map((rx) => rx.reference).join(', ') || 'None'}</T>
        </View>
        {prescriptions.length === 0 ? <T v="body">No prescription this visit.</T> : null}
        {prescriptions.flatMap((rx) =>
          rx.items.map((item) => (
            <View key={item.id} className="flex-row items-center justify-between gap-2 rounded bg-sky-100 p-2">
              <View className="flex-1">
                <T v="label">{`${item.name} ${item.strength}`}</T>
                <T v="body">{`${item.dose} • ${item.frequency} • ${item.durationDays} days`}</T>
              </View>
              <View className="rounded bg-mint px-2 py-0.5">
                <T v="kicker" className="text-deep">Signed</T>
              </View>
            </View>
          )),
        )}
      </SoftCard>

      <View className="flex-row gap-2">
        <SoftCard className="flex-1 gap-1">
          <Label icon="cd-diagnostics" text={`DIAGNOSTICS (${orders.length})`} />
          <T v="label" lines={3}>{orders.map((order) => order.title).join(', ') || 'None ordered'}</T>
        </SoftCard>
        <SoftCard className="flex-1 gap-1">
          <Label icon="cd-referral" text={`REFERRALS (${referrals.length})`} />
          <T v="label" lines={3}>{referrals.map((item) => `${item.targetPractitioner?.displayName ?? item.facility} (${item.specialty})`).join(', ') || 'None'}</T>
        </SoftCard>
      </View>

      <SoftCard className="gap-2.5">
        {plans.length ? (
          <View className="gap-1">
            <Label icon="cd-care" text="CARE PLAN" />
            <T v="para">{plans.map((plan) => `${plan.title}: ${plan.goals.map((goal) => goal.target).join(', ')}`).join(' • ')}</T>
          </View>
        ) : null}
        <View className="flex-row items-center gap-2 rounded-lg bg-sky-300/50 p-2.5">
          <Icon name="cd-next" />
          <View className="flex-1">
            <T v="label">Follow-up</T>
            <T v="body">{followUp ? `${dayLabel(followUp.date, true)} • ${clock(followUp.time)} (${followUp.reference})` : planned === 'none' ? 'Not needed' : planned ?? 'Not recorded'}</T>
          </View>
        </View>
      </SoftCard>

      <View className="flex-row flex-wrap justify-between gap-y-2">
        {note ? (
          <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/patients/encounter', params: { encounterId: visit.id } })} className="h-12 w-[48.7%] flex-row items-center justify-between gap-1 rounded-xl bg-sky-100 px-3">
            <View className="flex-1 flex-row items-center gap-2">
              <Icon name="cd-doc" />
              <T v="strong" lines={1} className="flex-1">Clinical Note</T>
            </View>
            <Icon name="cd-chevron" />
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Share Summary" onPress={shareSummary} className="h-12 w-[48.7%] flex-row items-center justify-between gap-1 rounded-xl bg-sky-100 px-3">
          <View className="flex-1 flex-row items-center gap-2">
            <Icon name="cd-print" />
            <T v="strong" lines={1} className="flex-1">Share Summary</T>
          </View>
          <Icon name="cd-share" />
        </Pressable>
      </View>

      <View className="gap-2 pt-2">
        {next ? (
          <View className="rounded-xl bg-sky-100 p-4">
            <View className="flex-row items-center justify-between gap-2">
              <T v="kicker">UP NEXT IN YOUR QUEUE</T>
              {next.token ? <Pill label={`Token ${next.token}`} className="bg-slate" textClassName="text-white" /> : null}
            </View>
            <View className="flex-row items-center justify-between gap-2 pt-2">
              <View className="flex-1 flex-row items-center gap-2">
                <View className="h-10 w-9 items-center justify-center rounded-full bg-sky-300">
                  <T v="subheading" className="font-pj-bd">{initialsOf(next.patient.fullName)}</T>
                </View>
                <View className="flex-1">
                  <T v="item">{next.patient.fullName}</T>
                  <T v="body">{`${ageSex(next.patient, localToday())} • ${next.reason}`}</T>
                </View>
              </View>
              {next.arrivedAt ? <T v="kicker">{`Waiting ${minutesSince(next.arrivedAt, now)} min`}</T> : null}
            </View>
          </View>
        ) : null}
        <DockButton label={next ? `Next Patient${next.token ? ` (${next.token})` : ''}` : "Back to Today's Patients"} iconRight="arrow-white-md" onPress={() => router.navigate('/today')} className="min-h-[52px]" />
      </View>
    </Screen>
  );
}
