import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle, Grid, Kicker, Options, Panel, Tag, Tile } from '@/components/ui/Kit';
import { SearchField } from '@/components/ui/SearchField';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { WorkflowScreen } from '@/features/consultation/WorkflowScreen';
import { CONDITIONS, saveEncounter, useActiveEncounter, type Diagnosis, type Encounter } from '@/features/doctor/clinical';
import { ApiError, errorMessage } from '@/lib/api';
import { useConsultation } from '@/state/ConsultationState';
import { useSession } from '@/state/SessionState';

type Condition = (typeof CONDITIONS)[number];
const VERIFICATIONS = ['Confirmed', 'Provisional', 'Differential'] as const;

export default function ClinicalAssessment() {
  const { encounter } = useActiveEncounter();
  return encounter.data ? <AssessmentForm key={encounter.data.id} saved={encounter.data} /> : <WorkflowScreen title="Clinical Assessment" subtitle="" status="" primary={{ label: '', onPress: () => undefined }}>{null}</WorkflowScreen>;
}

function AssessmentForm({ saved }: { saved: Encounter }) {
  const toast = useToast();
  const { call } = useSession();
  const { rx, orders } = useConsultation();
  const active = useActiveEncounter();
  const { sealed, diagnoses, vitals, chart, reload } = active;
  const [assessment, setAssessment] = useState(saved.soap.assessment);
  const [plan, setPlan] = useState(saved.soap.plan);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Condition | null>(null);
  const [verification, setVerification] = useState<(typeof VERIFICATIONS)[number]>('Confirmed');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const current = diagnoses.filter((item) => item.status === 'active');
  const hasPrimary = current.some((item) => item.designation === 'Primary');
  const needle = query.trim().toLowerCase();
  const found = needle ? CONDITIONS.filter((item) => `${item.name} ${item.icd} ${item.snomed}`.toLowerCase().includes(needle)) : CONDITIONS.slice(0, 4);
  const latest = vitals[0] ?? chart.data?.vitals[0];
  const changed = assessment !== saved.soap.assessment || plan !== saved.soap.plan;

  const addDiagnosis = async () => {
    if (!picked) return;
    if (description.trim().length < 1) {
      toast('Add the clinical description for this diagnosis.');
      return;
    }
    setBusy(true);
    try {
      await call(`/v1/patients/${saved.patientId}/diagnoses`, {
        method: 'POST',
        body: { encounterId: saved.id, icd: picked.icd, snomed: picked.snomed, name: picked.name, designation: hasPrimary ? 'Secondary' : 'Primary', verification, description: description.trim() },
      });
      setPicked(null);
      setDescription('');
      setQuery('');
      reload();
      toast(`${picked.name} added.`);
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (item: Diagnosis) => {
    try {
      await call(`/v1/diagnoses/${item.id}/resolve`, { method: 'POST', body: {} });
      reload();
      toast(`${item.name} marked resolved.`);
    } catch (error) {
      toast(errorMessage(error));
    }
  };

  const finish = async () => {
    if (!assessment.trim()) {
      toast('Write the assessment first.');
      return;
    }
    if (!hasPrimary) {
      toast('Add at least one diagnosis. The first one added is the primary.');
      return;
    }
    setBusy(true);
    try {
      if (changed) {
        await saveEncounter(call, saved, { assessment: assessment.trim(), plan: plan.trim() });
        reload();
      }
      router.push('/consultation/prescription');
    } catch (error) {
      toast(error instanceof ApiError && error.code === 'ENCOUNTER_CHANGED' ? 'Someone else saved this note first. Reopen it to see their changes.' : errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const downstream = [
    ['Medications', rx.length ? `${rx.length} in the draft prescription` : `${active.prescriptions.length} prescribed this visit`],
    ['Diagnostic Orders', orders.length ? `${orders.length} picked, not yet ordered` : `${active.orders.length} ordered this visit`],
    ['Referrals', `${active.referrals.length} this visit`],
    ['Follow-up', active.followUp ? `Booked ${active.followUp.date}` : 'Not booked'],
  ];

  return (
    <WorkflowScreen
      title="Clinical Assessment"
      subtitle={`${saved.reference} · Assessment & Plan`}
      badge={{ label: current.length ? `${current.length} Dx` : 'In Progress', tone: 'sky' }}
      status={changed ? 'Unsaved changes' : 'Saved to the encounter'}
      primary={{ label: 'Save & Continue', onPress: finish, loading: busy, disabled: sealed }}
      footnote="Diagnoses are added to the chart straight away. Signing the encounter locks them.">
      <Card>
        <CardTitle title="Clinical Briefing" />
        <Panel className="border-sky-150 bg-sky-100">
          <Kicker>CHIEF COMPLAINT</Kicker>
          <Text className="text-[12px] leading-[18px] text-ink">{saved.chiefComplaint || 'Not documented yet — add it in the notes step.'}</Text>
        </Panel>
        {latest ? (
          <Grid>
            <Tile label="Blood Pressure" value={`${latest.systolic}/${latest.diastolic}`} unit="mmHg" />
            <Tile label="Pulse" value={String(latest.pulse)} unit="bpm" />
            <Tile label="SpO2" value={`${latest.spo2}%`} />
            <Tile label="Weight" value={String(latest.weightKg)} unit="kg" />
          </Grid>
        ) : (
          <Text className="text-[12px] leading-[18px] text-slate">No vitals recorded yet.</Text>
        )}
        {saved.soap.subjective ? (
          <View className="border-t border-edge pt-2">
            <Kicker>HISTORY</Kicker>
            <Text numberOfLines={4} className="text-[12px] leading-[18px] text-slate">
              {saved.soap.subjective}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card>
        <CardTitle title="Assessment" right={<Tag label={`${assessment.trim() ? assessment.trim().split(/\s+/).length : 0} words`} />} />
        <TextField
          accessibilityLabel="Assessment"
          placeholder="Your clinical impression"
          boxClassName="border-sky-150 bg-sky-100"
          value={assessment}
          onChangeText={setAssessment}
          editable={!sealed}
          multiline
          maxLength={4000}
          inputClassName="min-h-[120px] text-[13px] leading-[19px]"
        />
        <Kicker>PLAN</Kicker>
        <TextField
          accessibilityLabel="Plan"
          placeholder="Treatment, investigations, advice, review"
          boxClassName="border-sky-150 bg-sky-100"
          value={plan}
          onChangeText={setPlan}
          editable={!sealed}
          multiline
          maxLength={4000}
          inputClassName="min-h-[90px] text-[13px] leading-[19px]"
        />
      </Card>

      <Card>
        <CardTitle title="Structured Diagnoses" right={<Tag label={`${current.length} this visit`} />} />
        {!sealed ? (
          <>
            <SearchField value={query} onChangeText={setQuery} placeholder="Search diagnosis name, ICD-10 or SNOMED CT..." />
            {needle && found.length === 0 ? <Text className="text-[12px] leading-[18px] text-slate">No matching diagnosis codes.</Text> : null}
            <View className="flex-row flex-wrap items-center gap-1.5">
              {found.map((item) => {
                const already = current.some((entry) => entry.icd === item.icd);
                return (
                  <Pressable key={item.icd} accessibilityRole="button" accessibilityLabel={`Add ${item.name}`} disabled={already} onPress={() => setPicked(item)} className={already ? 'opacity-40' : undefined}>
                    <Tag label={`+ ${item.name} (${item.icd})`} tone={picked?.icd === item.icd ? 'dark' : 'plain'} />
                  </Pressable>
                );
              })}
            </View>
            {picked ? (
              <Panel className="gap-2 rounded-2xl border-teal/30 bg-teal-50 p-3.5">
                <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">
                  {picked.name} · {picked.icd}
                </Text>
                <Text className="text-[11px] leading-4 text-slate">{hasPrimary ? 'Added as a secondary diagnosis' : 'Added as the primary diagnosis'}</Text>
                <Options options={VERIFICATIONS.map((value) => ({ value, label: value }))} value={verification} onChange={setVerification} />
                <TextField accessibilityLabel="Clinical description" placeholder="Basis for this diagnosis" value={description} onChangeText={setDescription} multiline maxLength={2000} boxClassName="border-sky-150 bg-white" />
                <View className="flex-row gap-2">
                  <Button label="Cancel" variant="soft" size="sm" onPress={() => setPicked(null)} />
                  <Button label="Add Diagnosis" size="sm" className="flex-1" loading={busy} onPress={addDiagnosis} />
                </View>
              </Panel>
            ) : null}
          </>
        ) : null}
        {current.length === 0 ? <Text className="text-[12px] leading-[18px] text-slate">No diagnosis recorded for this visit yet. Signing needs at least one.</Text> : null}
        {current.map((item) => (
          <Panel key={item.id} className="gap-1.5 rounded-2xl border-sky-150 bg-sky-100 p-3.5">
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row gap-1.5">
                <Tag label={item.designation.toUpperCase()} tone={item.designation === 'Primary' ? 'dark' : 'plain'} />
                <Tag label={item.verification.toUpperCase()} tone={item.verification === 'Differential' ? 'amber' : 'teal'} />
              </View>
              {!sealed ? (
                <Pressable accessibilityRole="button" accessibilityLabel={`Mark ${item.name} resolved`} hitSlop={10} onPress={() => resolve(item)}>
                  <Text className="font-pj-bd text-[11px] leading-4 text-slate">Resolve</Text>
                </Pressable>
              ) : null}
            </View>
            <Text className="font-pj-bd text-[14px] leading-5 text-ink">{item.name}</Text>
            <Text className="font-pj-md text-[11px] leading-4 text-slate">
              ICD-10: {item.icd}
              {item.snomed ? ` • SNOMED: ${item.snomed}` : ''}
            </Text>
            <Text className="text-[12px] leading-[18px] text-ink">{item.description}</Text>
            <Text className="text-[11px] leading-4 text-slate">Recorded by {item.recordedBy}</Text>
          </Panel>
        ))}
      </Card>

      <Card>
        <CardTitle title="Downstream Clinical Pathways" />
        <Grid>
          {downstream.map(([title, body]) => (
            <Panel key={title} className="w-[48.5%] border-sky-150 bg-sky-100">
              <Text className="font-pj-bd text-[12px] leading-[18px] text-ink">{title}</Text>
              <Text className="text-[11px] leading-4 text-slate">{body}</Text>
            </Panel>
          ))}
        </Grid>
      </Card>
    </WorkflowScreen>
  );
}
