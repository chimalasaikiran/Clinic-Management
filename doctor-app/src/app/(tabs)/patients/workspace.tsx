import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Card, Kicker, Tag } from '@/components/ui/Kit';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { encounterModules } from '@/data/modules';
import { useActiveEncounter, type Step } from '@/features/doctor/clinical';
import { ageSex, clock, dayLabel, initialsOf, localToday } from '@/features/reception/desk';
import { cn } from '@/lib/cn';
import { useConsultation } from '@/state/ConsultationState';
import type { IconName } from '@/theme/icons';

const icons: Record<Step, IconName> = {
  vitals: 'vitals',
  notes: 'triage-note',
  assessment: 'stethoscope',
  prescription: 'module-prescriptions',
  orders: 'module-lab',
  referral: 'module-careplans',
  carePlan: 'module-careplans',
  followUp: 'calendar-outline',
};
const SEVERITY_BOX = { critical: 'border-[#fecdd3] bg-[#fff1f2]/80', high: 'border-[#fecdd3] bg-[#fff1f2]/80', moderate: 'border-[#fde68a] bg-[#fffbeb]/80', low: 'border-edge bg-[#f8fafc]' } as const;

const minutesSince = (at: string) => Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60_000));

export default function ConsultationWorkspace() {
  const params = useLocalSearchParams<{ encounterId?: string }>();
  const { open } = useConsultation();
  useEffect(() => {
    if (params.encounterId) open(params.encounterId);
  }, [open, params.encounterId]);
  const active = useActiveEncounter();
  const { encounterId, encounter, chart, patient, done, sealed, vitals, diagnoses, prescriptions, orders } = active;

  if (!encounter.data || !patient.data) {
    return (
      <Screen inTabs className="bg-[#f8fafc]" header={<AppHeader title="Consultation Workspace" subtitle="No patient open" />} contentClassName="px-4 pt-6">
        {!encounterId ? (
          <EmptyState title="No consultation open" message="Start a consultation from Today's patient list, or resume one waiting to be signed." actionLabel="Open Today" onAction={() => router.navigate('/today')} />
        ) : encounter.error ? (
          <ErrorState message={encounter.error.message} onAction={encounter.reload} />
        ) : (
          <LoadingState label="Opening the consultation…" />
        )}
      </Screen>
    );
  }

  const visit = encounter.data;
  const person = patient.data;
  const recorded = encounterModules.filter((item) => done[item.step]).length;
  const percent = Math.round((recorded / encounterModules.length) * 100);
  const alerts = (chart.data?.alerts ?? []).filter((alert) => alert.status === 'active');
  const previous = (chart.data?.encounters ?? []).find((item) => item.id !== visit.id && item.status === 'signed');
  const activeRx = (chart.data?.prescriptions ?? []).filter((item) => item.status === 'active').length;
  const nextStep = encounterModules.find((item) => item.required && !done[item.step])?.route ?? '/consultation/review';
  const latest = vitals[0];

  const summary: Record<Step, string> = {
    vitals: latest ? `BP ${latest.systolic}/${latest.diastolic} · Pulse ${latest.pulse} · SpO2 ${latest.spo2}%` : 'Not recorded yet',
    notes: visit.soap.subjective ? visit.soap.subjective.slice(0, 90) : `Complaint: ${visit.chiefComplaint || 'not documented'}`,
    assessment: diagnoses.length ? diagnoses.map((item) => `${item.name} (${item.icd})`).join(' · ') : 'No diagnosis yet — required to sign',
    prescription: prescriptions.length ? `${prescriptions.length} signed · ${prescriptions.flatMap((rx) => rx.items.map((item) => item.name)).join(', ')}` : `${activeRx} active from earlier visits`,
    orders: orders.length ? orders.map((order) => order.title).join(' · ') : 'Nothing ordered this visit',
    referral: active.referrals.length ? active.referrals.map((item) => item.specialty).join(' · ') : 'None this visit',
    carePlan: done.carePlan ? 'Started this visit' : `${(chart.data?.carePlans ?? []).length} on file`,
    followUp: active.followUp ? `Booked ${dayLabel(active.followUp.date)}` : done.followUp ? 'Recorded in the plan' : 'Not recorded',
  };

  return (
    <Screen
      inTabs
      className="bg-[#f8fafc]"
      header={
        <AppHeader
          title="Consultation Workspace"
          subtitle={[visit.practitioner?.displayName, visit.branch.name].filter(Boolean).join(' · ')}
          badge={<Tag label={sealed ? 'Signed' : 'In Progress'} tone={sealed ? 'teal' : 'amber'} />}
        />
      }
      footer={
        <View className="gap-1.5">
          <View className="flex-row gap-2">
            <Button label="Chart" variant="soft" className="border-edge bg-[#f8fafc]" onPress={() => router.push({ pathname: '/patients/record', params: { patientId: person.id } })} />
            <Button
              label={sealed ? 'View Summary' : 'Continue Consultation'}
              className="flex-1"
              textClassName="font-pj-bd text-[13px]"
              onPress={() => router.push(sealed ? '/patients/completed' : nextStep)}
            />
          </View>
          <Text className="text-center text-[10px] leading-[15px] text-slate">Signing needs a chief complaint and at least one diagnosis.</Text>
        </View>
      }
      contentClassName="gap-3 px-4 pt-3 pb-6">
      <View className="gap-3 rounded-2xl bg-heading p-4">
        <View className="flex-row gap-3">
          <LinearGradient colors={['#006a61', '#182d35']} style={{ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Text className="font-pj-bd text-[15px] text-white">{initialsOf(person.fullName)}</Text>
          </LinearGradient>
          <View className="flex-1 gap-1">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="font-pj-bd text-[16px] leading-6 text-white">{person.fullName}</Text>
              <Tag label={[ageSex(person, localToday()), person.bloodGroup].filter(Boolean).join(' · ')} tone="glass" />
            </View>
            <Text className="text-[11px] leading-4 text-[#94a3b8]">
              {person.mrn}
              {person.abhaNumber ? <Text className="text-[11px] text-[#6ee7b7]"> · ABHA: {person.abhaNumber}</Text> : null}
            </Text>
          </View>
        </View>
        <View className="flex-row gap-3 border-t border-white/10 pt-3">
          {[
            ['ENCOUNTER', `${visit.reference} · ${visit.type}`],
            ['DOCTOR', visit.practitioner?.displayName ?? visit.startedBy],
          ].map(([label, value]) => (
            <View key={label} className="flex-1">
              <Kicker className="text-[#94a3b8]">{label}</Kicker>
              <Text className="font-pj-md text-[11px] leading-4 text-white">{value}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
          <Text className="text-[11px] leading-4 text-[#cbd5e1]">
            {sealed && visit.signed ? `Signed ${dayLabel(visit.signed.date)} ${clock(visit.signed.time)}` : `Started ${clock(visit.started.time)} (${minutesSince(visit.started.at)}m)`}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/patients/record', params: { patientId: person.id } })} className="rounded-lg bg-teal px-2.5 py-1">
            <Text className="font-pj-bd text-[11px] leading-4 text-white">Patient 360 ↗</Text>
          </Pressable>
        </View>
      </View>

      <Card className="border-edge">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">CLINICAL ALERTS & SAFETY FLAGS</Text>
          <View className="rounded-full border border-[#fecdd3] bg-[#fff1f2] px-2 py-0.5">
            <Text className="font-pj-bd text-[10px] leading-[15px] text-[#9f1239]">{alerts.length} Active</Text>
          </View>
        </View>
        {alerts.length === 0 ? <Text className="text-[11px] leading-4 text-slate">No active alerts on this chart.</Text> : null}
        {alerts.map((alert) => (
          <Pressable key={alert.id} accessibilityRole="button" onPress={() => router.push(`/inbox-task/${alert.id}`)} className={cn('gap-1 rounded-xl border p-3', SEVERITY_BOX[alert.severity])}>
            <View className="flex-row items-start justify-between gap-2">
              <Text className="flex-1 font-pj-bd text-[12px] leading-[18px] text-[#4c0519]">{alert.title}</Text>
              <Tag label={alert.severity.toUpperCase()} tone="plain" />
            </View>
            <Text className="text-[11px] leading-4 text-[#9f1239]">{alert.detail}</Text>
          </Pressable>
        ))}
      </Card>

      <Card>
        <View className="flex-row flex-wrap items-center justify-between gap-2 border-b border-edge/60 pb-2">
          <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">ENCOUNTER OVERVIEW</Text>
          <Tag label={`Started ${clock(visit.started.time)}`} tone="teal" />
        </View>
        <View>
          <Kicker>CHIEF COMPLAINT</Kicker>
          <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">{visit.chiefComplaint || 'Not documented yet'}</Text>
        </View>
        {visit.reason && visit.reason !== visit.chiefComplaint ? (
          <View className="border-l-2 border-teal bg-[#f8fafc] p-2.5">
            <Text className="text-[11px] italic leading-4 text-slate">Booked for: {visit.reason}</Text>
          </View>
        ) : null}
        <View className="flex-row gap-2">
          {[
            ['Vitals', latest ? `By ${latest.recordedBy}` : 'Not yet recorded'],
            ['Started by', visit.startedBy],
          ].map(([label, value]) => (
            <View key={label} className="flex-1 rounded-xl border border-edge/60 bg-[#f8fafc] p-2.5">
              <Text className="text-[10px] leading-[15px] text-slate">{label}</Text>
              <Text className="font-pj-bd text-[11px] leading-4 text-heading">{value}</Text>
            </View>
          ))}
        </View>
      </Card>

      <View className="flex-row items-center justify-between px-1">
        <View>
          <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">CONSULTATION WORKFLOW</Text>
          <Text className="text-[11px] leading-4 text-slate">
            {recorded} of {encounterModules.length} sections have entries
          </Text>
        </View>
        <View className="rounded-lg border border-teal/20 bg-teal-100 px-2 py-1">
          <Text className="font-pj-bd text-[11px] leading-4 text-teal">{percent}%</Text>
        </View>
      </View>
      {encounterModules.map((section) => {
        const isDone = done[section.step];
        const next = !sealed && section.route === nextStep;
        return (
          <Pressable
            key={section.step}
            accessibilityRole="button"
            accessibilityLabel={`${section.title}, ${isDone ? 'Recorded' : section.required ? 'Required' : 'Optional'}`}
            onPress={() => router.push(section.route)}
            className={cn('flex-row items-center gap-3 rounded-2xl border bg-white p-3.5', next ? 'border-teal bg-teal-50/40' : 'border-edge')}>
            <View className="size-9 items-center justify-center rounded-xl bg-teal-100">
              <Icon name={icons[section.step]} size={15} color="#006a61" />
            </View>
            <View className="flex-1 gap-1">
              <View className="flex-row flex-wrap items-center gap-1.5">
                <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">{section.title}</Text>
                <Tag label={isDone ? 'Recorded' : section.required ? 'Required' : 'Optional'} tone={isDone ? 'teal' : section.required ? 'amber' : 'plain'} />
              </View>
              <Text numberOfLines={2} className="font-pj-md text-[11px] leading-4 text-slate">
                {summary[section.step]}
              </Text>
            </View>
            {next ? (
              <View className="rounded-lg bg-teal px-2.5 py-1.5">
                <Text className="font-pj-bd text-[11px] leading-4 text-white">Next</Text>
              </View>
            ) : (
              <Icon name="chevron-right-slate" />
            )}
          </Pressable>
        );
      })}

      {previous ? (
        <View className="flex-row items-center gap-3 rounded-2xl border border-edge/80 bg-teal-100/40 p-3.5">
          <View className="flex-1">
            <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">Previous Encounter {previous.reference}</Text>
            <Text className="text-[11px] leading-4 text-slate">
              {previous.type} · {dayLabel(previous.started.date, true)} (Signed)
            </Text>
          </View>
          <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.push({ pathname: '/patients/encounter', params: { encounterId: previous.id } })}>
            <Text className="font-pj-sb text-[12px] leading-4 text-teal">Open</Text>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}
