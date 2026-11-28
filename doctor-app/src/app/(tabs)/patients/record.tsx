import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Share, View } from 'react-native';

import { AppHeader, IconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Icon } from '@/components/ui/Icon';
import { Card, CardTitle, Grid, Kicker, Panel, Tag, Tile } from '@/components/ui/Kit';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useChart, useClinicalDay, usePatient } from '@/features/doctor/clinical';
import { ageSex, clock, dayLabel, initialsOf, localToday, minutesSince, phone, STATUS, telOf, useNow } from '@/features/reception/desk';
import { useDial } from '@/features/reception/ui';
import { useStartConsultation } from '@/features/today/FlowCard';
import type { IconName } from '@/theme/icons';

const FLAG_TONE = { normal: 'teal', abnormal: 'amber', critical: 'red' } as const;
const toC = (fahrenheit: number) => Math.round(((fahrenheit - 32) * 5) / 9 * 10) / 10;

export default function PatientRecord() {
  const dial = useDial();
  const { patientId } = useLocalSearchParams<{ patientId?: string }>();
  const patient = usePatient(patientId);
  const chart = useChart(patientId);
  const day = useClinicalDay();
  const { start, busy } = useStartConsultation();
  const now = useNow();

  if (!patientId) {
    return (
      <Screen inTabs className="bg-[#f4f7f9]" header={<AppHeader title="Patient Chart" />} contentClassName="px-4 pt-6">
        <EmptyState title="No patient chosen" message="Open a patient from Today or search for one." actionLabel="Search Patients" onAction={() => router.push('/patients/search')} />
      </Screen>
    );
  }
  if (!patient.data || !chart.data) {
    return (
      <Screen inTabs className="bg-[#f4f7f9]" header={<AppHeader title="Patient Chart" />} contentClassName="px-4 pt-6">
        {patient.error || chart.error ? <ErrorState message={(patient.error ?? chart.error)!.message} onAction={() => (patient.reload(), chart.reload())} /> : <LoadingState label="Loading the chart…" />}
      </Screen>
    );
  }

  const person = patient.data;
  const data = chart.data;
  const today = localToday();
  const visit = (day.data?.appointments ?? []).find((row) => row.patient.id === person.id && row.status !== 'cancelled' && row.status !== 'no_show' && row.status !== 'completed');
  const allergies = data.allergies.filter((item) => item.active);
  const alerts = data.alerts.filter((item) => item.status === 'active');
  const problems = data.diagnoses.filter((item) => item.status === 'active');
  const medicines = data.prescriptions.filter((item) => item.status === 'active').flatMap((rx) => rx.items.map((item) => ({ ...item, rx })));
  const latest = data.vitals[0];
  const results = data.orders.filter((order) => order.result).slice(0, 4);
  const signedVisits = data.encounters.filter((item) => item.status === 'signed');
  const plans = data.carePlans.filter((plan) => plan.status !== 'closed');

  const vault: { icon: IconName; title: string; body: string; note: string; onPress: () => void }[] = [
    { icon: 'module-consultations', title: 'Consultations', body: `${signedVisits.length} signed`, note: signedVisits[0] ? `Latest: ${dayLabel(signedVisits[0].started.date, true)}` : 'None yet', onPress: () => router.push({ pathname: '/patients/history', params: { patientId: person.id } }) },
    { icon: 'module-prescriptions', title: 'Prescriptions', body: `${data.prescriptions.length} issued`, note: `${data.prescriptions.filter((item) => item.status === 'active').length} active`, onPress: () => router.push({ pathname: '/patients/history', params: { patientId: person.id, tab: 'rx' } }) },
    { icon: 'module-lab', title: 'Investigations', body: `${data.orders.length} ordered`, note: `${data.orders.filter((order) => order.status === 'awaiting_review').length} awaiting review`, onPress: () => router.push({ pathname: '/patients/history', params: { patientId: person.id, tab: 'orders' } }) },
    { icon: 'module-careplans', title: 'Care Plans', body: `${plans.length} active`, note: plans[0] ? `Review ${dayLabel(plans[0].nextReview)}` : 'None', onPress: () => router.push({ pathname: '/patients/history', params: { patientId: person.id, tab: 'plans' } }) },
  ];

  return (
    <Screen
      inTabs
      className="bg-[#f4f7f9]"
      header={<AppHeader title="Patient Chart" subtitle={person.homeBranch.name} right={<IconButton icon="share" label="Share patient summary" onPress={() => Share.share({ message: `${person.fullName} · ${person.mrn}` })} />} />}
      contentClassName="gap-3 px-4 pt-3 pb-6">
      <Card className="rounded-3xl">
        <View className="flex-row gap-3">
          <LinearGradient colors={['#006a61', '#004d46']} style={{ width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
            <Text className="font-pj-xb text-[20px] leading-7 text-white">{initialsOf(person.fullName)}</Text>
          </LinearGradient>
          <View className="flex-1 gap-1">
            <View className="flex-row flex-wrap items-center gap-1.5">
              <Text className="font-pj-xb text-[19px] leading-6 text-heading">{person.fullName}</Text>
              <Tag label={ageSex(person, today)} />
              {person.bloodGroup ? <Tag label={person.bloodGroup} tone="red" /> : null}
            </View>
            <Text className="font-pj-md text-[12px] leading-[18px] text-slate">
              {person.mrn} · {person.homeBranch.name}
            </Text>
          </View>
        </View>
        {person.abhaNumber ? (
          <View className="self-start rounded-xl border border-[#ebf0f2] bg-[#f8fafb] px-2.5 py-1">
            <Text className="text-[11px] leading-4 text-heading">
              <Text className="font-pj-sb text-[11px] text-slate">ABHA:</Text> {person.abhaNumber}
            </Text>
          </View>
        ) : null}
        <View className="flex-row items-center justify-between gap-2 border-t border-[#ebf0f2] pt-3">
          <Text className="flex-1 text-[12px] leading-[18px] text-slate">
            {person.emergencyName ? (
              <>
                <Text className="font-pj-md text-[12px] text-heading">{person.emergencyName}</Text>
                {person.emergencyRelation ? ` · ${person.emergencyRelation}` : ''}
              </>
            ) : (
              <>Patient · {phone(person.mobile)}</>
            )}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Call" onPress={() => dial(telOf(person.emergencyPhone ?? person.mobile))} className="flex-row items-center gap-1 rounded-lg bg-teal-100 px-2.5 py-1">
            <Icon name="call-small" color="#006a61" />
            <Text className="font-pj-bd text-[11px] leading-4 text-teal">Call</Text>
          </Pressable>
        </View>
        {visit ? (
          <LinearGradient colors={['#182d35', '#102026']} style={{ borderRadius: 16, padding: 14, gap: 6 }}>
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <View className="flex-row items-center gap-2">
                {visit.token ? (
                  <View className="rounded-md border border-[#00a396]/40 bg-[#00a396]/20 px-2 py-0.5">
                    <Text className="font-pj-xb text-[11px] leading-4 text-[#00a396]">TOKEN {visit.token}</Text>
                  </View>
                ) : null}
                <Text className="font-pj-md text-[11px] leading-4 text-[#cbd5e1]">{visit.status === 'arrived' && visit.arrivedAt ? `Waiting ${minutesSince(visit.arrivedAt, now)} min` : STATUS[visit.status].label}</Text>
              </View>
              {visit.practitioner.room ? <Tag label={visit.practitioner.room} tone="glass" /> : null}
            </View>
            <Kicker className="pt-1 text-[#cfece8]">TODAY&apos;S VISIT · {clock(visit.time)}</Kicker>
            <Text className="font-pj-bd text-[16px] leading-6 text-white">{visit.reason}</Text>
            <Text className="text-[12px] leading-[18px] text-[#cbd5e1]">{visit.practitioner.displayName}</Text>
            {visit.status === 'arrived' || visit.status === 'in_progress' ? (
              <Pressable accessibilityRole="button" onPress={() => start(visit)} className="mt-2 items-center rounded-xl bg-white py-2.5 active:opacity-80">
                <Text className="font-pj-xb text-[14px] leading-5 text-heading">{busy === visit.id ? 'Opening…' : visit.status === 'in_progress' ? 'Resume Consultation' : 'Start Consultation'}</Text>
              </Pressable>
            ) : (
              <Text className="text-[11px] leading-4 text-[#cbd5e1]">Not checked in yet.</Text>
            )}
          </LinearGradient>
        ) : null}
      </Card>

      {allergies.map((allergy) => (
        <View key={allergy.id} className="flex-row gap-3 rounded-2xl border border-[#facdcd] bg-[#fdf2f2] p-3.5">
          <View className="size-8 items-center justify-center rounded-xl bg-[#d32f2f]">
            <Icon name="warning-red" color="#ffffff" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="font-pj-xb text-[11px] leading-4 text-[#d32f2f]">{allergy.severity.toUpperCase()} ALLERGY</Text>
            <Text className="font-pj-bd text-[13px] leading-[18px] text-heading">{allergy.substance}</Text>
            <Text className="text-[12px] leading-[18px] text-slate">{allergy.reaction}</Text>
          </View>
        </View>
      ))}
      {allergies.length === 0 ? <Text className="px-1 text-[12px] leading-[18px] text-slate">No allergies recorded.</Text> : null}

      {alerts.length ? (
        <Card>
          <CardTitle title="Active Alerts" right={<Tag label={String(alerts.length)} tone="red" />} />
          {alerts.map((alert) => (
            <Pressable key={alert.id} accessibilityRole="button" onPress={() => router.push(`/inbox-task/${alert.id}`)}>
              <Panel className="border-[#facdcd] bg-[#fdf2f2]">
                <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">{alert.title}</Text>
                <Text className="text-[11px] leading-4 text-slate">{alert.detail}</Text>
              </Panel>
            </Pressable>
          ))}
        </Card>
      ) : null}

      {latest ? (
        <Card>
          <CardTitle title="Latest Vitals" subtitle={`${dayLabel(latest.recorded.date, true)} ${clock(latest.recorded.time)} · ${latest.recordedBy}`} />
          <Grid>
            <Tile label="BP" value={`${latest.systolic}/${latest.diastolic}`} unit="mmHg" />
            <Tile label="Pulse" value={String(latest.pulse)} unit="bpm" />
            <Tile label="SpO2" value={`${latest.spo2}%`} />
            <Tile label="Temp" value={String(toC(latest.temperatureF))} unit="°C" />
          </Grid>
        </Card>
      ) : null}

      <Card>
        <CardTitle title="Active Problems" right={<Tag label={String(problems.length)} />} />
        {problems.length === 0 ? <Text className="text-[12px] leading-[18px] text-slate">None recorded.</Text> : null}
        {problems.map((item) => (
          <Panel key={item.id} className="border-[#ebf0f2] bg-[#f8fafb]">
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 font-pj-bd text-[12px] leading-[18px] text-heading">{item.name}</Text>
              <Tag label={item.icd} tone={item.designation === 'Primary' ? 'teal' : 'sky'} />
            </View>
            <Text className="text-[11px] leading-4 text-slate">{item.description}</Text>
          </Panel>
        ))}
      </Card>

      <Card>
        <CardTitle title="Current Medicines" right={<Tag label={String(medicines.length)} />} />
        {medicines.length === 0 ? <Text className="text-[12px] leading-[18px] text-slate">No active prescriptions.</Text> : null}
        {medicines.map((item) => (
          <Panel key={item.id} className="border-[#ebf0f2] bg-[#f8fafb]">
            <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">
              {item.name} {item.strength}
            </Text>
            <Text className="text-[11px] leading-4 text-slate">
              {item.dose} · {item.frequency} · {item.food}
            </Text>
            <Text className="text-[11px] leading-4 text-slate">
              {item.rx.reference} · {item.rx.prescriberName} · {dayLabel(item.rx.created.date, true)}
            </Text>
          </Panel>
        ))}
      </Card>

      {results.length ? (
        <Card>
          <CardTitle title="Recent Results" />
          {results.map((order) => (
            <Pressable key={order.id} accessibilityRole="button" onPress={() => router.push(`/results/${order.id}`)}>
              <Panel className="border-[#ebf0f2] bg-[#f8fafb]">
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="flex-1 font-pj-bd text-[12px] leading-[18px] text-heading">{order.title}</Text>
                  <Tag label={order.status === 'awaiting_review' ? 'TO REVIEW' : order.result!.flag.toUpperCase()} tone={FLAG_TONE[order.result!.flag]} />
                </View>
                <Text className="text-[11px] leading-4 text-slate">{order.result!.summary}</Text>
              </Panel>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Text className="px-1 font-pj-bd text-[12px] leading-[18px] text-heading">CLINICAL RECORD</Text>
      <View className="flex-row flex-wrap justify-between gap-y-2.5">
        {vault.map((item) => (
          <Pressable key={item.title} accessibilityRole="button" onPress={item.onPress} className="w-[48.5%] gap-1 rounded-2xl border border-[#ebf0f2] bg-white p-3">
            <View className="size-8 items-center justify-center rounded-xl bg-teal-100">
              <Icon name={item.icon} size={15} color="#006a61" />
            </View>
            <Text className="font-pj-bd text-[12px] leading-[18px] text-heading">{item.title}</Text>
            <Text className="text-[11px] leading-4 text-heading">{item.body}</Text>
            <Text className="text-[10px] leading-[15px] text-slate">{item.note}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
