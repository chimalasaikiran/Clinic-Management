import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Card, CardTitle, Choice, Grid, Panel, Tag } from '@/components/ui/Kit';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { RxItemCard } from '@/features/consultation/RxItemCard';
import { WorkflowScreen } from '@/features/consultation/WorkflowScreen';
import { useActiveEncounter } from '@/features/doctor/clinical';
import { errorMessage } from '@/lib/api';
import { useConsultation } from '@/state/ConsultationState';
import { useSession } from '@/state/SessionState';
import { useStaff } from '@/state/StaffState';

export default function ReviewPrescription() {
  const toast = useToast();
  const { call } = useSession();
  const { me } = useStaff();
  const { rx, clearRx } = useConsultation();
  const { encounter, chart, diagnoses, reload } = useActiveEncounter();
  const [attested, setAttested] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const primary = diagnoses.find((item) => item.status === 'active' && item.designation === 'Primary');
  // Starts from the primary diagnosis once the chart has loaded, until the doctor writes their own.
  const [typed, setIndication] = useState<string | null>(null);
  const indication = typed ?? primary?.name ?? rx[0]?.indication ?? '';
  const [signing, setSigning] = useState(false);

  const allergies = (chart.data?.allergies ?? []).filter((allergy) => allergy.active);
  const conflicts = rx.filter((item) => allergies.some((allergy) => allergy.drugClass && allergy.drugClass === item.drugClass));
  // The server's rule: an NSAID for a patient whose last blood pressure was 130/80 or more is a precaution to accept.
  const latest = chart.data?.vitals[0];
  const hypertensive = !!latest && (latest.systolic >= 130 || latest.diastolic >= 80);
  const nsaid = rx.some((item) => item.drugClass === 'nsaid');
  const needsAck = hypertensive && nsaid;
  const ready = rx.length > 0 && attested && conflicts.length === 0 && (!needsAck || acknowledged) && indication.trim().length > 0;

  const sign = async () => {
    if (!encounter.data || !ready) {
      toast(conflicts.length ? 'Remove the medicines that conflict with a recorded allergy.' : 'Complete the checks above to authorize.');
      return;
    }
    setSigning(true);
    try {
      await call(`/v1/patients/${encounter.data.patientId}/prescriptions`, {
        method: 'POST',
        body: { encounterId: encounter.data.id, indication: indication.trim(), precautionAcknowledged: acknowledged, items: rx },
      });
      clearRx();
      reload();
      toast('Prescription signed and issued.');
      router.push('/consultation/orders');
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setSigning(false);
    }
  };

  return (
    <WorkflowScreen
      title="Review Prescription"
      subtitle={encounter.data?.reference ?? ''}
      badge={{ label: 'Awaiting Approval', tone: 'sky' }}
      status="Draft — authorizing signs it in your name"
      secondary={{ label: 'Edit Items', onPress: () => (router.canGoBack() ? router.back() : router.replace('/consultation/prescription')) }}
      primary={{ label: 'Sign & Issue Rx', onPress: sign, loading: signing, disabled: !ready }}
      footnote="The server repeats the allergy and precaution checks before it signs.">
      <CardTitle title="Safety Checks" />
      {conflicts.length ? (
        <View className="rounded-xl bg-[#ffdad6] p-3">
          <Text className="font-pj-bd text-[11px] leading-4 text-[#93000a]">ALLERGY CONFLICT</Text>
          {conflicts.map((item) => (
            <Text key={item.medicineCode} className="text-[12px] leading-[18px] text-[#93000a]">
              {item.name} matches a recorded {item.drugClass} allergy. Remove it to continue.
            </Text>
          ))}
        </View>
      ) : (
        <View className="rounded-xl bg-[#ecfdf5] p-3">
          <Text className="font-pj-bd text-[11px] leading-4 text-[#047857]">ALLERGY SCREEN PASSED</Text>
          <Text className="text-[12px] leading-[18px] text-[#065f46]">
            {allergies.length ? `Checked against ${allergies.map((allergy) => allergy.substance).join(', ')}.` : 'No allergies are recorded for this patient.'}
          </Text>
        </View>
      )}
      <Grid>
        <Panel className="w-[48.5%] border-sky-150 bg-sky-100">
          <Text className="font-pj-bd text-[12px] leading-[18px] text-ink">Last Blood Pressure</Text>
          <Text className="text-[11px] leading-4 text-slate">{latest ? `${latest.systolic}/${latest.diastolic} mmHg` : 'Not recorded'}</Text>
        </Panel>
        <Panel className="w-[48.5%] border-sky-150 bg-sky-100">
          <Text className="font-pj-bd text-[12px] leading-[18px] text-ink">{rx.length} Items</Text>
          <Text className="text-[11px] leading-4 text-slate">From the clinic formulary</Text>
        </Panel>
      </Grid>
      {needsAck ? (
        <Card className="bg-[#fffbeb]">
          <Choice
            title="NSAID precaution acknowledged"
            body={`The last blood pressure was ${latest!.systolic}/${latest!.diastolic} mmHg. I accept the risk of prescribing an NSAID and will monitor it.`}
            checked={acknowledged}
            onPress={() => setAcknowledged(!acknowledged)}
          />
        </Card>
      ) : null}

      <Card>
        <CardTitle title="Indication" />
        <TextField accessibilityLabel="Indication for the prescription" value={indication} onChangeText={setIndication} maxLength={500} boxClassName="border-sky-150 bg-sky-100" />
      </Card>

      <CardTitle title="Items to Authorize" right={<Tag label={`${rx.length} Items`} tone="dark" />} />
      {rx.length === 0 ? <Text className="rounded-xl bg-white p-4 text-center text-[12px] leading-[18px] text-slate">No medicines have been added.</Text> : null}
      {rx.map((item, index) => (
        <RxItemCard key={item.medicineCode} index={index + 1} item={item} />
      ))}

      <Card>
        <CardTitle title="Prescribing Clinician Attestation" />
        <View className="rounded-xl bg-sky-100 p-3">
          <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{me.name}</Text>
          <Text className="text-[11px] leading-4 text-slate">
            {me.designation}
            {me.department ? ` · ${me.department}` : ''}
          </Text>
        </View>
        <Choice
          title="Clinician attestation"
          body={`I have reviewed all ${rx.length} medicines, doses, durations and instructions above, and authorize this prescription.`}
          checked={attested}
          onPress={() => setAttested(!attested)}
        />
      </Card>
    </WorkflowScreen>
  );
}
