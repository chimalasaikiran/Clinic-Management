import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { Dock, DockButton, DocHeader, Pill, SealedDock, SoftCard, T } from '@/features/consultation/design';
import { PatientBanner } from '@/features/consultation/PatientBanner';
import { REFERRAL_MODELS, REFERRAL_PRIORITIES, useActiveEncounter } from '@/features/doctor/clinical';
import { dayLabel, initialsOf, type Practitioner } from '@/features/reception/desk';
import { useResource } from '@/hooks/useResource';
import { errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession, useSignedIn } from '@/state/SessionState';

const STATUS_LABEL: Record<string, string> = {
  pending_acceptance: 'Awaiting Acceptance',
  accepted: 'Accepted',
  info_requested: 'Info Requested',
  declined: 'Declined',
  completed: 'Completed',
};
const TIER_NOTE: Record<(typeof REFERRAL_PRIORITIES)[number], string> = {
  'Routine (within 2 weeks)': 'The receiving side has two weeks to respond',
  'High / Expedited (48h)': 'Response expected within 48 hours',
  'Urgent / Emergency (same day)': 'Same-day response',
};

function Field({ label, value, onChange, editable, placeholder }: { label: string; value: string; onChange: (text: string) => void; editable: boolean; placeholder?: string }) {
  return (
    <View className="rounded-xl bg-sky-100 p-2">
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        editable={editable}
        placeholder={placeholder}
        multiline
        textAlignVertical="top"
        className="min-h-[56px] font-pj text-[14px] leading-5 text-ink"
      />
    </View>
  );
}

export default function ReferralForm() {
  const toast = useToast();
  const { call } = useSession();
  const signedIn = useSignedIn();
  const { encounter, chart, diagnoses, vitals, referrals: thisVisit, sealed, reload } = useActiveEncounter();
  const directory = useResource<Practitioner[]>('/v1/practitioners?status=active');
  const [kind, setKind] = useState<'internal' | 'external'>('internal');
  const [target, setTarget] = useState<Practitioner | null>(null);
  const [facility, setFacility] = useState('');
  const [facilityNote, setFacilityNote] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [picking, setPicking] = useState(false);
  const [tier, setTier] = useState<(typeof REFERRAL_PRIORITIES)[number]>(REFERRAL_PRIORITIES[0]);
  const [model, setModel] = useState(REFERRAL_MODELS[0]!);
  const [indication, setIndication] = useState('');
  const [narrative, setNarrative] = useState('');
  const [question, setQuestion] = useState('');
  const [questions, setQuestions] = useState<string[]>([]);
  const [attached, setAttached] = useState<string[] | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [sending, setSending] = useState(false);

  if (!encounter.data) {
    return (
      <Screen className="bg-sky-50" header={<DocHeader title="Referral Form" />} contentClassName="px-4 pt-6">
        {encounter.loading ? <LoadingState label="Opening the consultation…" /> : <EmptyState title="No consultation open" message="Start or resume a consultation from Today's patient list." actionLabel="Open Today" onAction={() => router.replace('/today')} />}
      </Screen>
    );
  }
  const visit = encounter.data;
  const myPractitionerId = signedIn?.me.practitioner?.id;
  const colleagues = (directory.data ?? []).filter((item) => item.id !== myPractitionerId);
  const earlier = (chart.data?.referrals ?? []).filter((item) => !thisVisit.includes(item));
  const primary = diagnoses.find((item) => item.status === 'active' && item.designation === 'Primary');
  const latest = vitals[0];
  const results = (chart.data?.orders ?? []).filter((order) => order.result).slice(0, 3);
  const medicines = (chart.data?.prescriptions ?? []).filter((rx) => rx.status === 'active').flatMap((rx) => rx.items.map((item) => `${item.name} ${item.strength}`));
  // What can go with the referral, described from the chart itself.
  const records = [
    `Consultation summary (${visit.reference})`,
    ...(diagnoses.length ? [`Diagnoses: ${diagnoses.map((item) => `${item.name} (${item.icd})`).join(', ')}`] : []),
    ...(latest ? [`Vitals: BP ${latest.systolic}/${latest.diastolic}, pulse ${latest.pulse}, SpO2 ${latest.spo2}%`] : []),
    ...results.map((order) => `${order.title}: ${order.result!.summary}`),
    ...(medicines.length ? [`Current medicines: ${medicines.join(', ')}`] : []),
  ];
  const selected = attached ?? records;
  const destination = kind === 'internal' ? target?.displayName : facility.trim();
  const errors = [
    !destination ? 'Choose who the patient is referred to.' : '',
    !(specialty.trim() || target?.specialty) ? 'Give the specialty.' : '',
    !indication.trim() ? 'Enter the primary indication.' : '',
    narrative.trim().length < 10 ? 'Add a clinical narrative (at least 10 characters).' : '',
  ].filter(Boolean);

  const send = async () => {
    if (errors.length) {
      toast(errors[0]!);
      return;
    }
    setSending(true);
    try {
      await call(`/v1/patients/${visit.patientId}/referrals`, {
        method: 'POST',
        body: {
          direction: 'outgoing',
          encounterId: visit.id,
          priority: tier,
          model,
          specialty: (specialty.trim() || target?.specialty) ?? '',
          indication: indication.trim(),
          narrative: narrative.trim(),
          questions,
          attachedRecords: selected,
          ...(kind === 'internal' ? { targetPractitionerId: target!.id } : { facility: facility.trim(), facilityNote: facilityNote.trim() }),
        },
      });
      reload();
      toast(`Referral to ${destination} sent.`);
      router.push('/consultation/care-plan');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      className="bg-sky-50"
      bareFooter
      header={
        <DocHeader
          title="Referral Form"
          badge={<Pill label={thisVisit.length ? `${thisVisit.length} SENT` : 'DRAFT'} className="self-center bg-sky-300" textClassName="text-[#526871]" />}
          below={<T v="body">{`${visit.reference} • optional step`}</T>}
        />
      }
      footer={
        sealed ? (
          <SealedDock />
        ) : (
          <Dock>
            <View className="flex-row gap-2">
              <DockButton label="Skip" tone="soft" onPress={() => router.push('/consultation/care-plan')} className="min-h-[52px] bg-sky-150" />
              <DockButton label="Send Referral" iconRight="arrow-white-md" loading={sending} onPress={send} className="min-h-[52px] flex-1" />
            </View>
          </Dock>
        )
      }
      contentClassName="gap-5 px-5 pb-8 pt-1">
      <PatientBanner framed />

      <View className="gap-2 pt-1">
        <View className="flex-row items-center justify-between gap-2">
          <View className="flex-1 flex-row items-center gap-1">
            <Icon name="ref-folder" />
            <T v="heading" className="shrink">Existing Referrals</T>
            <Pill label={`${earlier.length + thisVisit.length} Recorded`} className="self-center" textClassName="text-ink" />
          </View>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: showHistory }} hitSlop={8} onPress={() => setShowHistory(!showHistory)} className="flex-row items-center gap-0.5">
            <T v="strong" className="text-slate">Details</T>
            <View className={cn(!showHistory && 'rotate-180')}>
              <Icon name="ref-chevron" />
            </View>
          </Pressable>
        </View>
        {showHistory
          ? [...thisVisit, ...earlier].map((item) => (
              <SoftCard key={item.id} className="gap-1">
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <T v="kicker">{item.specialty.toUpperCase()}</T>
                    <T v="item">{item.targetPractitioner?.displayName ?? item.facility}</T>
                    <T v="body">{`${item.reference} • ${item.priority}`}</T>
                  </View>
                  <Pill label={STATUS_LABEL[item.status] ?? item.status} className="bg-sky-300 px-2.5 py-1" textClassName="font-pj-sb text-[#526871]" />
                </View>
                <View className="mt-1 rounded-lg bg-sky-100 p-2">
                  <Text className="text-[13px] leading-5 text-[#4c4546]">
                    <Text className="font-pj-bd text-[13px] text-ink">Indication:</Text> {item.indication}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1 pt-1">
                  <Icon name="ref-calendar" />
                  <T v="body">{`Referred ${dayLabel(item.created.date, true)}${thisVisit.includes(item) ? ' (this visit)' : ''}`}</T>
                </View>
              </SoftCard>
            ))
          : null}
        {showHistory && earlier.length + thisVisit.length === 0 ? (
          <SoftCard>
            <T v="body" className="text-center">No referrals for this patient yet.</T>
          </SoftCard>
        ) : null}
      </View>

      {!sealed ? (
        <View className="gap-4">
          <View className="flex-row items-center gap-1">
            <View className="size-2.5 rounded-full bg-black" />
            <T v="heading">New Referral</T>
          </View>
          <View accessibilityRole="radiogroup" className="flex-row gap-1.5 rounded-xl bg-white p-1 shadow-sm">
            {([['internal', 'Clinic Doctor', 'ref-doctor'], ['external', 'External Provider', 'ref-external']] as const).map(([value, label, icon]) => {
              const active = kind === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ checked: active }}
                  onPress={() => setKind(value)}
                  className={cn('h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg', active ? 'bg-black shadow-sm' : 'bg-sky-100')}>
                  <Icon name={icon} color={active ? '#ffffff' : '#4d626a'} />
                  <T v="strong" className={active ? 'text-white' : 'text-slate'}>{label}</T>
                </Pressable>
              );
            })}
          </View>

          <SoftCard className="gap-3">
            {kind === 'internal' ? (
              <>
                {target ? (
                  <View className="flex-row items-center gap-4">
                    <View className="size-14 items-center justify-center rounded-xl bg-sky-150">
                      <T v="subheading">{initialsOf(target.displayName)}</T>
                    </View>
                    <View className="flex-1">
                      <T v="heading" className="shrink">{target.displayName}</T>
                      <T v="label" className="text-slate">{[target.specialty, target.credentials].filter(Boolean).join(' · ')}</T>
                      <T v="body">{[target.department, target.room].filter(Boolean).join(' • ')}</T>
                    </View>
                  </View>
                ) : (
                  <T v="body">No doctor chosen yet.</T>
                )}
                <Pressable accessibilityRole="button" onPress={() => setPicking(true)} className="h-11 flex-row items-center justify-center gap-1 rounded-lg bg-sky-150">
                  <Icon name="ref-search" />
                  <T v="strong">{target ? 'Switch Doctor' : 'Choose from the Clinic Directory'}</T>
                </Pressable>
              </>
            ) : (
              <>
                <T v="heading">Facility or Clinician</T>
                <Field label="Facility or clinician" value={facility} onChange={setFacility} editable placeholder="Hospital, clinic or specialist name" />
                <Field label="Contact details" value={facilityNote} onChange={setFacilityNote} editable placeholder="Address or phone (optional)" />
              </>
            )}
            <T v="heading">Specialty</T>
            <Field label="Specialty" value={specialty} onChange={setSpecialty} editable placeholder={target?.specialty ?? 'For example Cardiology'} />
          </SoftCard>

          <SoftCard className="gap-2">
            <T v="heading">Priority</T>
            <View accessibilityRole="radiogroup" className="gap-1">
              {REFERRAL_PRIORITIES.map((item) => {
                const active = tier === item;
                const urgent = item.startsWith('Urgent');
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="radio"
                    accessibilityLabel={item}
                    accessibilityState={{ checked: active }}
                    onPress={() => setTier(item)}
                    className={cn('gap-1 rounded-lg p-2', active ? 'bg-black shadow-sm' : 'bg-sky-100')}>
                    <View className="flex-row items-center justify-between gap-2">
                      <View className="flex-row items-center gap-1">
                        {urgent ? <Icon name="ref-stat" color={active ? '#ffffff' : undefined} /> : null}
                        <T v="strong" className={cn(active ? 'text-white' : urgent && 'text-danger')}>{item}</T>
                      </View>
                      {active ? <Icon name="ref-radio-on" /> : null}
                    </View>
                    <T v="body" className={cn(active && 'text-sky-100')}>{TIER_NOTE[item]}</T>
                  </Pressable>
                );
              })}
            </View>
            <T v="heading">Referral Model</T>
            <View className="flex-row flex-wrap gap-1.5">
              {REFERRAL_MODELS.map((item) => (
                <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: model === item }} onPress={() => setModel(item)} className={cn('rounded-lg px-2.5 py-1.5', model === item ? 'bg-black' : 'bg-sky-100')}>
                  <T v="strong" className={model === item ? 'text-white' : 'text-slate'}>{item}</T>
                </Pressable>
              ))}
            </View>
          </SoftCard>

          <SoftCard className="gap-3">
            <T v="heading">Primary Indication</T>
            <Field label="Primary indication" value={indication} onChange={setIndication} editable placeholder={primary ? `For example ${primary.name}` : 'Why the patient is being referred'} />
            <T v="heading">Clinical Narrative</T>
            <Field label="Clinical narrative" value={narrative} onChange={setNarrative} editable placeholder="History, findings and what you have tried" />
            <T v="heading">Questions for the Consultant</T>
            {questions.map((item, index) => (
              <View key={item} className="flex-row gap-1">
                <T v="strong" className="pt-0.5 text-black">{`${index + 1}.`}</T>
                <T v="para" className="flex-1">{item}</T>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove question ${index + 1}`} hitSlop={8} onPress={() => setQuestions(questions.filter((entry) => entry !== item))}>
                  <Icon name="ref-remove" />
                </Pressable>
              </View>
            ))}
            <View className="flex-row items-center gap-2">
              <View className="flex-1">
                <Field label="New question" value={question} onChange={setQuestion} editable placeholder="Add a question (optional)" />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add question"
                disabled={!question.trim()}
                onPress={() => {
                  setQuestions([...questions, question.trim()]);
                  setQuestion('');
                }}
                className={cn('rounded-lg bg-sky-150 px-3 py-2', !question.trim() && 'opacity-40')}>
                <T v="strong">Add</T>
              </Pressable>
            </View>
          </SoftCard>

          <SoftCard className="gap-2">
            <T v="heading">Records Sent With the Referral</T>
            <T v="body">Send only what the consultant needs.</T>
            {records.map((item) => {
              const checked = selected.includes(item);
              return (
                <Pressable
                  key={item}
                  accessibilityRole="checkbox"
                  accessibilityLabel={item}
                  accessibilityState={{ checked }}
                  onPress={() => setAttached(checked ? selected.filter((entry) => entry !== item) : [...selected, item])}
                  className="flex-row items-center gap-2 rounded-xl bg-sky-100 p-2">
                  {checked ? <Icon name="ref-checkbox" /> : <View className="size-6 rounded-md border-2 border-line bg-white" />}
                  <T v="label" className="flex-1">{item}</T>
                </Pressable>
              );
            })}
          </SoftCard>

          <View className="flex-row gap-2 rounded-xl bg-sky-100 p-4">
            <Icon name="ref-governance" />
            <Text className="flex-1 text-[13px] leading-[21px] text-slate">
              Sending a referral records it on the chart and starts its response clock. It does not book an appointment with the receiving side.
            </Text>
          </View>
        </View>
      ) : null}

      <Sheet visible={picking} onClose={() => setPicking(false)} title="Clinic directory">
        {directory.loading && !directory.data ? <LoadingState label="Loading doctors…" /> : null}
        {directory.data && colleagues.length === 0 ? <T v="body">No other active doctors at this clinic.</T> : null}
        {colleagues.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="menuitem"
            accessibilityState={{ selected: item.id === target?.id }}
            onPress={() => {
              setTarget(item);
              setPicking(false);
            }}
            className={cn('rounded-xl px-3 py-3', item.id === target?.id && 'bg-sky-100')}>
            <T v="label" className="font-pj-bd">{item.displayName}</T>
            <T v="body">{[item.specialty, item.department].filter(Boolean).join(' · ')}</T>
          </Pressable>
        ))}
      </Sheet>
    </Screen>
  );
}
