import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { Toggle } from '@/components/ui/Toggle';
import { Dock, DockButton, DocHeader, Pill, SealedDock, SoftCard, T } from '@/features/consultation/design';
import { PatientBanner } from '@/features/consultation/PatientBanner';
import { useActiveEncounter } from '@/features/doctor/clinical';
import { addDays, dayLabel, localToday } from '@/features/reception/desk';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession, useSignedIn } from '@/state/SessionState';
import type { IconName } from '@/theme/icons';

const CATEGORIES = ['Chronic disease management', 'Post-procedure recovery', 'Preventive care', 'Rehabilitation', 'Lifestyle modification'];
const CADENCES = ['Daily', 'Weekly', 'Monthly', 'Each visit'];
const INTERVENTION_TYPES = ['Medication', 'Investigation', 'Lifestyle', 'Education', 'Referral'];
const REVIEW_WEEKS = [2, 4, 6, 8, 12];
const TARGET_WEEKS = [8, 12, 24, 52];
const STATUS_LABEL = { on_track: 'On Track', at_risk: 'At Risk', achieved: 'Achieved', closed: 'Closed' } as const;

function SectionHead({ icon, title, right }: { icon: IconName; title: string; right?: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <View className="flex-1 flex-row items-center gap-2">
        <Icon name={icon} />
        <T v="heading" className="flex-1">{title}</T>
      </View>
      {right}
    </View>
  );
}

function Input({ label, value, onChange, placeholder, multiline }: { label: string; value: string; onChange: (text: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      className={cn('rounded-lg bg-sky-100 px-3 py-2 font-pj text-[14px] leading-5 text-ink', multiline && 'min-h-[84px]')}
    />
  );
}

function Chips<T extends string | number>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (value: T) => void; label: (value: T) => string }) {
  return (
    <View className="flex-row flex-wrap gap-1.5">
      {options.map((option) => (
        <Pressable key={String(option)} accessibilityRole="radio" accessibilityState={{ checked: option === value }} onPress={() => onChange(option)} className={cn('rounded-lg px-2.5 py-1.5', option === value ? 'bg-black' : 'bg-sky-100')}>
          <T v="strong" className={option === value ? 'text-white' : 'text-slate'}>{label(option)}</T>
        </Pressable>
      ))}
    </View>
  );
}

export default function CarePlan() {
  const toast = useToast();
  const { call } = useSession();
  const signedIn = useSignedIn();
  const { encounter, chart, diagnoses, vitals, sealed, reload } = useActiveEncounter();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]!);
  const [rationale, setRationale] = useState('');
  const [reviewWeeks, setReviewWeeks] = useState(4);
  const [targetWeeks, setTargetWeeks] = useState(12);
  const [linked, setLinked] = useState<string[] | null>(null);
  const [goals, setGoals] = useState<{ title: string; target: string; cadence: string; protocol: string }[]>([]);
  const [goal, setGoal] = useState({ title: '', target: '', cadence: 'Weekly', protocol: '' });
  const [interventions, setInterventions] = useState<{ type: string; title: string; due: string }[]>([]);
  const [intervention, setIntervention] = useState({ type: 'Medication', title: '', due: '' });
  const [education, setEducation] = useState<string[]>([]);
  const [lesson, setLesson] = useState('');
  const [whatsapp, setWhatsapp] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!encounter.data) {
    return (
      <Screen className="bg-sky-50" header={<DocHeader title="Care Plan" />} contentClassName="px-4 pt-6">
        {encounter.loading ? <LoadingState label="Opening the consultation…" /> : <EmptyState title="No consultation open" message="Start or resume a consultation from Today's patient list." actionLabel="Open Today" onAction={() => router.replace('/today')} />}
      </Screen>
    );
  }

  const lead = signedIn?.me.practitioner;
  const today = localToday();
  const plans = chart.data?.carePlans ?? [];
  const activeProblems = (chart.data?.diagnoses ?? []).filter((item) => item.status === 'active');
  const problems = [...new Map([...diagnoses, ...activeProblems].map((item) => [item.icd, item])).values()];
  const chosen = linked ?? problems.filter((item) => diagnoses.includes(item)).map((item) => item.icd);
  const latest = vitals[0] ?? chart.data?.vitals[0];
  const medicines = (chart.data?.prescriptions ?? []).filter((rx) => rx.status === 'active').flatMap((rx) => rx.items.map((item) => `${item.name} ${item.strength}`));
  const pendingOrders = (chart.data?.orders ?? []).filter((order) => order.status === 'ordered' || order.status === 'collected');
  const errors = [
    !lead ? 'Only a clinician with a practitioner profile can lead a care plan.' : '',
    !title.trim() ? 'Give the plan a title.' : '',
    rationale.trim().length < 20 ? 'Describe the rationale (at least 20 characters).' : '',
    chosen.length === 0 ? 'Link at least one diagnosis.' : '',
    goals.length === 0 ? 'Add at least one measurable goal.' : '',
    interventions.length === 0 ? 'Add at least one intervention.' : '',
  ].filter(Boolean);

  const save = async () => {
    if (errors.length) {
      toast(errors[0]!);
      return;
    }
    setSaving(true);
    try {
      await call(`/v1/patients/${encounter.data!.patientId}/care-plans`, {
        method: 'POST',
        body: {
          title: title.trim(),
          category,
          leadPractitionerId: lead!.id,
          rationale: rationale.trim(),
          startDate: today,
          nextReview: addDays(today, reviewWeeks * 7),
          targetDate: addDays(today, targetWeeks * 7),
          diagnoses: problems.filter((item) => chosen.includes(item.icd)).map((item) => ({ icd: item.icd, name: item.name })),
          goals,
          interventions,
          education,
          whatsapp,
        },
      });
      reload();
      toast('Care plan started.');
      router.push('/consultation/follow-up');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      className="bg-sky-50"
      bareFooter
      header={
        <DocHeader
          title="Care Plan"
          below={<Pill label={`${plans.length} on file • optional step`} dot="#4d626a" className="bg-sky-300" textClassName="text-[#526871]" />}
          actions={
            <Pressable accessibilityRole="button" accessibilityLabel="Consultation workspace" onPress={() => router.push('/patients/workspace')}>
              <Icon name="hdr-patient-card" />
            </Pressable>
          }
        />
      }
      footer={
        sealed ? (
          <SealedDock />
        ) : (
          <Dock>
            <View className="flex-row items-center justify-between gap-2 px-1">
              <T v="kicker" className="flex-1">{errors.length ? errors[0] : 'Ready to start the plan'}</T>
            </View>
            <View className="flex-row gap-2">
              <DockButton label="Skip" tone="soft" onPress={() => router.push('/consultation/follow-up')} className="min-h-[52px]" />
              <DockButton label="Start Plan & Continue" iconRight="arrow-white-sm" loading={saving} onPress={save} className="min-h-[52px] flex-1" />
            </View>
          </Dock>
        )
      }
      contentClassName="gap-7 px-5 pb-6 pt-1">
      <PatientBanner />

      {plans.length ? (
        <View className="gap-2">
          <SectionHead icon="cp-strategy" title="Plans on File" />
          {plans.map((plan) => (
            <SoftCard key={plan.id} className="gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <T v="subheading" className="flex-1">{plan.title}</T>
                <Pill label={STATUS_LABEL[plan.status]} className="self-center bg-sky-300" textClassName="text-[#526871]" />
              </View>
              <T v="body">{`${plan.reference} • ${plan.category} • next review ${dayLabel(plan.nextReview, true)}`}</T>
              <T v="body">{plan.goals.map((item) => `${item.title} (${item.target})`).join(' • ')}</T>
            </SoftCard>
          ))}
        </View>
      ) : null}

      <SoftCard className="gap-2">
        <View className="flex-row items-center gap-2">
          <Icon name="cp-synthesis" />
          <T v="heading" className="flex-1">From This Visit</T>
        </View>
        {latest ? (
          <View className="flex-row rounded-lg bg-sky-100 p-2">
            {[
              ['BP', `${latest.systolic}/${latest.diastolic}`, 'mmHg'],
              ['Pulse', String(latest.pulse), 'bpm'],
              ['SpO₂', `${latest.spo2}%`, ''],
              ['Weight', String(latest.weightKg), 'kg'],
            ].map(([label, value, unit]) => (
              <View key={label} className="flex-1 items-center">
                <T v="kicker">{label}</T>
                <T v="heading">{value}</T>
                <T v="kicker">{unit}</T>
              </View>
            ))}
          </View>
        ) : null}
        <T v="body">{medicines.length ? `Medicines: ${medicines.join(', ')}` : 'No active prescriptions.'}</T>
        <T v="body">{pendingOrders.length ? `Pending tests: ${pendingOrders.map((order) => order.title).join(', ')}` : 'No tests pending.'}</T>
      </SoftCard>

      {!sealed ? (
        <>
          <View className="gap-2">
            <SectionHead icon="cp-strategy" title="Plan & Rationale" />
            <SoftCard className="gap-2">
              <Input label="Plan title" value={title} onChange={setTitle} placeholder="For example Blood pressure control" />
              <Chips options={CATEGORIES} value={category} onChange={setCategory} label={(value) => value} />
              <Input label="Rationale" value={rationale} onChange={setRationale} multiline placeholder="Why this plan, and what it should achieve" />
              <T v="kicker">LINKED DIAGNOSES</T>
              {problems.length === 0 ? <T v="body">Add a diagnosis in the assessment step first.</T> : null}
              {problems.map((item) => {
                const checked = chosen.includes(item.icd);
                return (
                  <Pressable key={item.icd} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => setLinked(checked ? chosen.filter((code) => code !== item.icd) : [...chosen, item.icd])} className="flex-row items-center gap-2 rounded-lg bg-sky-100 p-2">
                    {checked ? <Icon name="ref-checkbox" /> : <View className="size-6 rounded-md border-2 border-line bg-white" />}
                    <T v="label" className="flex-1">{`${item.name} (${item.icd})`}</T>
                  </Pressable>
                );
              })}
              <T v="kicker">{`INTERIM REVIEW · ${dayLabel(addDays(today, reviewWeeks * 7), true)}`}</T>
              <Chips options={REVIEW_WEEKS} value={reviewWeeks} onChange={(value) => { setReviewWeeks(value); if (targetWeeks <= value) setTargetWeeks(TARGET_WEEKS.find((weeks) => weeks > value)!); }} label={(value) => `${value} weeks`} />
              <T v="kicker">{`TARGET COMPLETION · ${dayLabel(addDays(today, targetWeeks * 7), true)}`}</T>
              <Chips options={TARGET_WEEKS.filter((weeks) => weeks > reviewWeeks)} value={targetWeeks} onChange={setTargetWeeks} label={(value) => `${value} weeks`} />
            </SoftCard>
          </View>

          <View className="gap-2">
            <SectionHead icon="cp-ontrack" title="Measurable Goals" right={<T v="kicker">{`${goals.length} added`}</T>} />
            <SoftCard className="gap-2">
              {goals.map((item, index) => (
                <View key={`${item.title}-${index}`} className="flex-row items-start gap-2 rounded-lg bg-sky-100 p-2.5">
                  <View className="flex-1">
                    <T v="strong">{item.title}</T>
                    <T v="body">{`${item.target} • ${item.cadence}${item.protocol ? ` • ${item.protocol}` : ''}`}</T>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove goal ${item.title}`} hitSlop={8} onPress={() => setGoals(goals.filter((_, at) => at !== index))}>
                    <Icon name="ref-remove" />
                  </Pressable>
                </View>
              ))}
              <Input label="Goal" value={goal.title} onChange={(text) => setGoal({ ...goal, title: text })} placeholder="Goal, for example Blood pressure at target" />
              <Input label="Measurable target" value={goal.target} onChange={(text) => setGoal({ ...goal, target: text })} placeholder="Target, for example Below 130/80 mmHg" />
              <Input label="How it is measured" value={goal.protocol} onChange={(text) => setGoal({ ...goal, protocol: text })} placeholder="How it is measured (optional)" />
              <Chips options={CADENCES} value={goal.cadence} onChange={(value) => setGoal({ ...goal, cadence: value })} label={(value) => value} />
              <Pressable
                accessibilityRole="button"
                disabled={!goal.title.trim() || !goal.target.trim()}
                onPress={() => {
                  setGoals([...goals, { title: goal.title.trim(), target: goal.target.trim(), cadence: goal.cadence, protocol: goal.protocol.trim() }]);
                  setGoal({ title: '', target: '', cadence: goal.cadence, protocol: '' });
                }}
                className={cn('items-center rounded-lg bg-sky-150 py-2.5', (!goal.title.trim() || !goal.target.trim()) && 'opacity-40')}>
                <T v="strong">Add Goal</T>
              </Pressable>
            </SoftCard>
          </View>

          <View className="gap-2">
            <SectionHead icon="cp-home" title="Interventions" right={<T v="kicker">{`${interventions.length} added`}</T>} />
            <SoftCard className="gap-2">
              {interventions.map((item, index) => (
                <View key={`${item.title}-${index}`} className="flex-row items-start gap-2 rounded-lg bg-sky-100 p-2.5">
                  <View className="flex-1">
                    <T v="strong">{item.title}</T>
                    <T v="body">{`${item.type}${item.due ? ` • ${item.due}` : ''}`}</T>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove intervention ${item.title}`} hitSlop={8} onPress={() => setInterventions(interventions.filter((_, at) => at !== index))}>
                    <Icon name="ref-remove" />
                  </Pressable>
                </View>
              ))}
              <Chips options={INTERVENTION_TYPES} value={intervention.type} onChange={(value) => setIntervention({ ...intervention, type: value })} label={(value) => value} />
              <Input label="Intervention" value={intervention.title} onChange={(text) => setIntervention({ ...intervention, title: text })} placeholder="What will be done" />
              <Input label="When" value={intervention.due} onChange={(text) => setIntervention({ ...intervention, due: text })} placeholder="When (optional), for example Ongoing" />
              <Pressable
                accessibilityRole="button"
                disabled={!intervention.title.trim()}
                onPress={() => {
                  setInterventions([...interventions, { type: intervention.type, title: intervention.title.trim(), due: intervention.due.trim() }]);
                  setIntervention({ type: intervention.type, title: '', due: '' });
                }}
                className={cn('items-center rounded-lg bg-sky-150 py-2.5', !intervention.title.trim() && 'opacity-40')}>
                <T v="strong">Add Intervention</T>
              </Pressable>
            </SoftCard>
          </View>

          <View className="gap-2">
            <SectionHead icon="cp-redflag" title="Patient Education" right={<T v="kicker">{`${education.length} added`}</T>} />
            <SoftCard className="gap-2">
              {education.map((item, index) => (
                <View key={`${item}-${index}`} className="flex-row items-center gap-2">
                  <View className="size-1.5 rounded-full bg-slate" />
                  <T v="body" className="flex-1">{item}</T>
                  <Pressable accessibilityRole="button" accessibilityLabel="Remove advice" hitSlop={8} onPress={() => setEducation(education.filter((_, at) => at !== index))}>
                    <Icon name="ref-remove" />
                  </Pressable>
                </View>
              ))}
              <Input label="Advice" value={lesson} onChange={setLesson} placeholder="Advice for the patient, including warning signs" />
              <Pressable
                accessibilityRole="button"
                disabled={!lesson.trim()}
                onPress={() => {
                  setEducation([...education, lesson.trim()]);
                  setLesson('');
                }}
                className={cn('items-center rounded-lg bg-sky-150 py-2.5', !lesson.trim() && 'opacity-40')}>
                <T v="strong">Add Advice</T>
              </Pressable>
              <View className="flex-row items-center justify-between gap-2 pt-1">
                <T v="body" className="flex-1">Patient wants plan updates on WhatsApp (recorded on the plan; nothing is sent yet)</T>
                <Toggle label="Patient wants WhatsApp updates" value={whatsapp} onValueChange={setWhatsapp} />
              </View>
            </SoftCard>
          </View>
        </>
      ) : null}
      <Text className="text-center text-[11px] leading-4 text-slate">The plan is saved to the chart, and progress reviews are recorded against it.</Text>
    </Screen>
  );
}
