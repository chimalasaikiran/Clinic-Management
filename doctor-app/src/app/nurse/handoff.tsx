import { router } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { ActionButton, Box, Glyph, IconTile } from '@/components/staff/ui';
import { Text } from '@/components/ui/Text';
import { NurseHeader, SectionTitle } from '@/features/nurse/ui';
import { AllergyList, readingLine, takenLine, VisitCard, WithVisit, type Visit } from '@/features/nurse/visit';
import { flagsOf } from '@/features/nurse/ward';
import colors from '@/theme/colors';

/**
 * What the doctor will see. ClinicOS has no separate handoff step: vitals reach the doctor's screen as soon as they
 * are saved, so this page checks the patient is ready rather than "sending" anything.
 */
function Handoff({ row, patient, today, chart, readings }: Visit) {
  const latest = readings[0];
  const flags = flagsOf(latest);
  const withDoctor = row.status === 'in_progress';
  const checks = [
    { label: 'Checked in at reception', done: row.status !== 'pending' && row.status !== 'confirmed' },
    { label: 'Vitals saved to the chart', done: !!latest },
    { label: 'Readings within usual limits', done: !!latest && flags.length === 0 },
  ];

  return (
    <Screen
      className="bg-sky-50"
      header={<NurseHeader title="Ready for the Doctor" subtitle={`${patient.fullName} · ${patient.mrn}`} />}
      contentClassName="gap-3.5 px-4 pt-2 pb-6"
      footer={<ActionButton large tone="dark" label="Back to Today" onPress={() => router.dismissTo('/nurse')} />}>
      <VisitCard row={row} patient={patient} today={today} />
      <Box className="p-4">
        {checks.map((item) => (
          <View key={item.label} className="flex-row items-center gap-3">
            <IconTile icon={item.done ? 'check' : 'warning-amber'} box={item.done ? 'bg-mint' : 'bg-[#fef3c7]'} className="rounded-full" />
            <Text className="flex-1 font-pj-sb text-[13px] leading-[18px] text-ink">{item.label}</Text>
          </View>
        ))}
        {withDoctor ? <Text className="text-[12px] leading-[17px] text-slate">{row.practitioner.displayName} has started the consultation.</Text> : null}
      </Box>
      {latest ? (
        <Box className="p-4">
          <SectionTitle title="Vitals the Doctor Sees" icon="monitor-heart" />
          <Text className="font-pj-bd text-[15px] leading-[22px] text-ink">{readingLine(latest)}</Text>
          <Text className="text-[11px] leading-4 text-slate">{takenLine(latest)}</Text>
        </Box>
      ) : (
        <ActionButton large tone="white" label="Record Vitals" icon="show-chart" onPress={() => router.push({ pathname: '/nurse/vitals', params: { id: row.id } })} />
      )}
      <AllergyList chart={chart} />
      {flags.length ? (
        <Text className="rounded-xl bg-[#fff0ef] p-3 text-[13px] leading-[19px] text-[#93000a]">
          Tell {row.practitioner.displayName} in person or by phone: {flags.join(', ')}.
        </Text>
      ) : null}
      <View className="flex-row gap-2.5 rounded-2xl bg-sky-100 p-3">
        <Glyph name="info-outline" size={16} color={colors.slate} />
        <Text className="flex-1 text-[12px] leading-[17px] text-slate">
          Saved vitals appear on {row.practitioner.displayName}&apos;s screen straight away. Nursing notes, room assignment and doctor acknowledgement are not recorded in ClinicOS yet.
        </Text>
      </View>
    </Screen>
  );
}

export default function ClinicalHandoff() {
  return <WithVisit title="Ready for the Doctor" render={(visit) => <Handoff {...visit} />} />;
}
