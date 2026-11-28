import { router } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ActionButton, Box, Chip, useDial } from '@/components/staff/ui';
import { Text } from '@/components/ui/Text';
import { telOf, phone } from '@/features/reception/desk';
import { NurseHeader, SectionTitle } from '@/features/nurse/ui';
import { AllergyList, readingLine, takenLine, VisitCard, WithVisit, type Visit } from '@/features/nurse/visit';
import { flagsOf } from '@/features/nurse/ward';

function Preparation({ row, patient, today, chart, readings, previous }: Visit) {
  const dial = useDial();
  const latest = readings[0];
  const flags = flagsOf(latest);
  const alerts = chart.alerts.filter((item) => item.status === 'active');
  const problems = chart.diagnoses.filter((item) => item.status === 'active');
  const medicines = chart.prescriptions.filter((item) => item.status === 'active').flatMap((rx) => rx.items);
  const present = row.status === 'arrived' || row.status === 'in_progress';
  const history = chart.vitals.filter((item) => item !== latest).slice(0, 5);

  return (
    <Screen
      className="bg-sky-50"
      header={<NurseHeader title="Patient Preparation" subtitle={`${patient.fullName} · ${patient.mrn}`} />}
      contentClassName="gap-3.5 px-4 pt-2 pb-4"
      footer={
        present ? (
          <View className="flex-row gap-2">
            <ActionButton large label={latest ? 'Record Again' : 'Record Vitals'} icon="show-chart" onPress={() => router.push({ pathname: '/nurse/vitals', params: { id: row.id } })} className="flex-1" />
            <ActionButton large tone="dark" label="Ready for Doctor?" iconRight="arrow-forward" onPress={() => router.push({ pathname: '/nurse/handoff', params: { id: row.id } })} className="flex-1" />
          </View>
        ) : undefined
      }>
      <VisitCard row={row} patient={patient} today={today} />
      {!present ? (
        <Text className="rounded-xl bg-sky-100 p-3 text-[12px] leading-[18px] text-slate">
          {row.status === 'completed' ? 'This visit is closed.' : 'This patient has not been checked in yet. Reception checks patients in.'}
        </Text>
      ) : null}
      <AllergyList chart={chart} />

      <Box className="p-4">
        <SectionTitle title="Today's Vitals" icon="monitor-heart" tint={flags.length ? '#ba1a1a' : undefined} right={flags.length ? <Chip label="OUT OF RANGE" tone="red" className="self-center" /> : null} />
        {latest ? (
          <>
            <Text className="font-pj-bd text-[15px] leading-[22px] text-ink">{readingLine(latest)}</Text>
            <Text className="text-[12px] leading-[17px] text-slate">
              Weight {latest.weightKg} kg · Height {latest.heightCm} cm{latest.painScore !== null ? ` · Pain ${latest.painScore}/10` : ''}
              {latest.bloodSugar !== null ? ` · Sugar ${latest.bloodSugar} mg/dL` : ''}
            </Text>
            <Text className="text-[11px] leading-4 text-slate">{takenLine(latest)}</Text>
            {flags.length ? (
              <Text className="rounded-xl bg-[#fff0ef] p-3 text-[12px] leading-[18px] text-[#93000a]">
                {flags.join(', ')}. Tell {row.practitioner.displayName} directly.
              </Text>
            ) : null}
          </>
        ) : (
          <Text className="text-[12px] leading-[18px] text-slate">Not recorded yet.</Text>
        )}
      </Box>

      {alerts.length ? (
        <Box className="p-4">
          <SectionTitle title="Chart Alerts" icon="warning-amber" tint="#ba1a1a" />
          {alerts.map((alert) => (
            <View key={alert.id} className="gap-0.5 rounded-xl bg-[#fffbeb] p-3">
              <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">
                {alert.severity.toUpperCase()} · {alert.title}
              </Text>
              <Text className="text-[12px] leading-[17px] text-slate">{alert.detail}</Text>
            </View>
          ))}
        </Box>
      ) : null}

      <Box className="p-4">
        <SectionTitle title="Problems & Medicines" icon="medication" />
        <Text className="text-[12px] leading-[18px] text-ink">{problems.length ? problems.map((item) => `${item.name} (${item.icd})`).join(' · ') : 'No active problems recorded.'}</Text>
        <Text className="text-[12px] leading-[18px] text-slate">
          {medicines.length ? `Taking: ${medicines.map((item) => `${item.name} ${item.strength}, ${item.frequency}`).join(' · ')}` : 'No active prescriptions at this clinic.'}
        </Text>
      </Box>

      <Box className="p-4">
        <SectionTitle title="Earlier Readings" icon="history" />
        {previous || history.length ? (
          history.map((item) => (
            <View key={item.id} className="gap-0.5 border-l-2 border-sky-250 pl-3">
              <Text className="text-[12px] leading-[17px] text-ink">{readingLine(item)}</Text>
              <Text className="text-[11px] leading-4 text-slate">{takenLine(item)}</Text>
            </View>
          ))
        ) : (
          <Text className="text-[12px] leading-[18px] text-slate">No earlier readings at this clinic.</Text>
        )}
      </Box>

      <Box className="p-4">
        <SectionTitle title="Contact" icon="call" />
        <ActionButton label={`Call patient · ${phone(patient.mobile)}`} icon="call" tone="white" onPress={() => dial(telOf(patient.mobile))} />
        {patient.emergencyPhone ? (
          <ActionButton label={`Emergency contact · ${patient.emergencyName ?? ''} ${phone(patient.emergencyPhone)}`} icon="contact-emergency" tone="white" onPress={() => dial(telOf(patient.emergencyPhone!))} />
        ) : null}
      </Box>
    </Screen>
  );
}

export default function PatientPreparation() {
  return <WithVisit title="Patient Preparation" render={(visit) => <Preparation {...visit} />} />;
}
