import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Card, Kicker, Panel, Tag } from '@/components/ui/Kit';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { WorkflowScreen } from '@/features/consultation/WorkflowScreen';
import { saveEncounter, useActiveEncounter, type Encounter } from '@/features/doctor/clinical';
import { dayLabel } from '@/features/reception/desk';
import { ApiError, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSession } from '@/state/SessionState';

function SectionHead({ number, title, tag }: { number: number; title: string; tag?: string }) {
  return (
    <View className="flex-row items-center gap-2 border-b border-edge/60 pb-2.5">
      <View className="size-6 items-center justify-center rounded-md bg-teal-100">
        <Text className="font-pj-bd text-[12px] text-teal">{number}</Text>
      </View>
      <Text accessibilityRole="header" className="flex-1 font-pj-bd text-[14px] leading-5 text-heading">
        {title}
      </Text>
      {tag ? <Tag label={tag} tone="teal" /> : null}
    </View>
  );
}

export default function ConsultationNotes() {
  const { encounter } = useActiveEncounter();
  // The form starts from the saved note; it mounts again if another encounter is opened.
  return encounter.data ? <NotesForm key={encounter.data.id} saved={encounter.data} /> : <WorkflowScreen title="Consultation Notes" subtitle="" status="" primary={{ label: '', onPress: () => undefined }}>{null}</WorkflowScreen>;
}

function NotesForm({ saved }: { saved: Encounter }) {
  const toast = useToast();
  const { call } = useSession();
  const { chart, sealed, reload } = useActiveEncounter();
  const [reason, setReason] = useState(saved.chiefComplaint);
  const [subjective, setSubjective] = useState(saved.soap.subjective);
  const [objective, setObjective] = useState(saved.soap.objective);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const problems = (chart.data?.diagnoses ?? []).filter((diagnosis) => diagnosis.status === 'active');
  const resolved = (chart.data?.diagnoses ?? []).filter((diagnosis) => diagnosis.status === 'resolved');
  const medicines = (chart.data?.prescriptions ?? []).filter((rx) => rx.status === 'active' || rx.status === 'partially_dispensed').flatMap((rx) => rx.items.map((item) => ({ ...item, rx })));
  // Quick picks: why the visit was booked, and the patient's active problems.
  const suggestions = [...new Set([saved.reason, ...problems.map((problem) => problem.name)].filter(Boolean))].slice(0, 4);
  const words = subjective.trim() ? subjective.trim().split(/\s+/).length : 0;
  const errors = {
    reason: reason.trim() ? '' : 'The chief complaint is required.',
    subjective: words >= 3 ? '' : 'Describe the present illness before continuing.',
  };
  const changed = reason !== saved.chiefComplaint || subjective !== saved.soap.subjective || objective !== saved.soap.objective;

  const save = async (then?: () => void) => {
    setSubmitted(true);
    if (errors.reason || errors.subjective) {
      toast('Complete the highlighted fields.');
      return;
    }
    if (!changed) {
      then?.();
      return;
    }
    setSaving(true);
    try {
      await saveEncounter(call, saved, { chiefComplaint: reason.trim(), subjective: subjective.trim(), objective: objective.trim() });
      reload();
      toast('Notes saved.');
      then?.();
    } catch (error) {
      toast(error instanceof ApiError && error.code === 'ENCOUNTER_CHANGED' ? 'Someone else saved this note first. Reopen it to see their changes.' : errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorkflowScreen
      title="Consultation Notes"
      subtitle="Subjective & Objective"
      badge={{ label: 'SOAP', tone: 'amber' }}
      status={`${saved.reference} · ${changed ? 'Unsaved changes' : `Saved · started ${saved.started.time}`}`}
      secondary={{ label: 'Save', onPress: () => save() }}
      primary={{ label: 'Save & Next (Vitals)', onPress: () => save(() => router.push('/consultation/vitals')), loading: saving, disabled: sealed }}
      footnote="Saved to the encounter on the server. Signing locks it.">
      <Card>
        <SectionHead number={1} title="Chief Complaint" tag="REQUIRED" />
        {suggestions.length ? (
          <>
            <Kicker>QUICK PICKS</Kicker>
            <View className="flex-row flex-wrap gap-1.5">
              {suggestions.map((item) => {
                const active = reason === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    disabled={sealed}
                    onPress={() => setReason(item)}
                    className={cn('rounded-lg border px-2.5 py-1.5', active ? 'border-teal bg-teal' : 'border-edge bg-[#f0f5f6]')}>
                    <Text className={cn('font-pj-sb text-[11px] leading-4', active ? 'text-white' : 'text-heading')}>{item}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
        <TextField
          label="PRIMARY REASON FOR VISIT"
          labelClassName="font-pj-bd text-[10px] leading-[15px] text-slate"
          boxClassName="border-edge bg-[#f8fafc]"
          value={reason}
          onChangeText={setReason}
          editable={!sealed}
          multiline
          maxLength={2000}
          inputClassName="min-h-[44px] text-[13px]"
          error={submitted ? errors.reason : ''}
        />
      </Card>

      <Card>
        <SectionHead number={2} title="History of Present Illness (Subjective)" />
        <TextField
          boxClassName="border-edge bg-[#f8fafc]"
          accessibilityLabel="History of present illness"
          placeholder="Onset, duration, severity, what makes it better or worse, what the patient reports"
          value={subjective}
          onChangeText={setSubjective}
          editable={!sealed}
          multiline
          maxLength={4000}
          inputClassName="min-h-[160px] text-[13px] leading-[19px]"
          error={submitted ? errors.subjective : ''}
        />
        <Text className="text-right text-[11px] leading-4 text-slate">{words} words</Text>
      </Card>

      <Card>
        <SectionHead number={3} title="Examination (Objective)" />
        <TextField
          boxClassName="border-edge bg-[#f8fafc]"
          accessibilityLabel="Examination findings"
          placeholder="General appearance, systems examined, findings"
          value={objective}
          onChangeText={setObjective}
          editable={!sealed}
          multiline
          maxLength={4000}
          inputClassName="min-h-[120px] text-[13px] leading-[19px]"
        />
      </Card>

      <Card>
        <SectionHead number={4} title="Problem List" tag={`${problems.length} active`} />
        {problems.length === 0 && resolved.length === 0 ? <Text className="text-[12px] leading-[18px] text-slate">No diagnoses recorded for this patient yet.</Text> : null}
        {problems.map((item) => (
          <Panel key={item.id} className="flex-row items-center gap-2 border-edge bg-[#f8fafc]">
            <View className="flex-1">
              <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">{item.name}</Text>
              <Text className="text-[11px] leading-4 text-slate">
                {item.icd} · {item.verification} · since {dayLabel(item.recorded.date, true)}
              </Text>
            </View>
            <Tag label="ACTIVE" tone="teal" />
          </Panel>
        ))}
        {resolved.map((item) => (
          <Panel key={item.id} className="flex-row items-center gap-2 border-edge bg-[#f8fafc]">
            <View className="flex-1">
              <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">{item.name}</Text>
              <Text className="text-[11px] leading-4 text-slate">{item.icd}</Text>
            </View>
            <Tag label="RESOLVED" tone="sky" />
          </Panel>
        ))}
      </Card>

      <Card>
        <SectionHead number={5} title="Current Medicines" tag={`${medicines.length} active`} />
        {medicines.length === 0 ? <Text className="text-[12px] leading-[18px] text-slate">No active prescriptions at this clinic.</Text> : null}
        {medicines.map((item) => (
          <Panel key={item.id} className="border-edge bg-[#f8fafc]">
            <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">
              {item.name} {item.strength}
            </Text>
            <Text className="text-[11px] leading-4 text-slate">
              {item.dose} · {item.route} · {item.frequency} · {item.food} · {item.durationDays} days
            </Text>
            <Text className="border-t border-edge/60 pt-1 text-[11px] leading-4 text-slate">
              {item.rx.reference} · {item.rx.prescriberName} · {dayLabel(item.rx.created.date, true)}
            </Text>
          </Panel>
        ))}
      </Card>
    </WorkflowScreen>
  );
}
