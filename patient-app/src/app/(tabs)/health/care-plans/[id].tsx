import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { RecordDetailScreen } from '@/features/health/RecordDetailScreen';
import { ClinicContext, PatientStrip, recordCard, recordKicker, recordMeta, recordTitle, RecordNotice, Row } from '@/features/health/RecordKit';
import { clinicianLine, PLAN_STATUS, planActive, shortDate } from '@/lib/records';
import type { CarePlan } from '@/types';

const body = 'text-[13px] leading-[19px] text-[#566b74]';

export default function CarePlanDetails() {
  return (
    <RecordDetailScreen<CarePlan>
      title="Care Plan Details"
      path="/v1/patient/care-plans"
      listHref="/health/care-plans"
      subtitle={(plan) => `#${plan.reference} · ${plan.category}`}
      shareMessage={(plan) => `${plan.title} (#${plan.reference}), next review ${shortDate(plan.nextReview)}`}>
      {(plan) => (
        <>
          <PatientStrip name={plan.patientName} detail={`Patient number ${plan.mrn}`} />
          <ClinicContext clinicName={plan.clinicName} branchName={plan.branch.name} />

          <View className={recordCard}>
            <View className="flex-row flex-wrap items-center justify-between gap-2">
              <Text className={recordKicker}>#{plan.reference}</Text>
              <Pill label={PLAN_STATUS[plan.status].label} tone={PLAN_STATUS[plan.status].tone} />
            </View>
            <Text className="font-pj-bd text-[18px] leading-6 text-heading">{plan.title}</Text>
            <View className="rounded-xl bg-[#f4f7f6] p-3">
              <Text className="font-pj-bd text-[14px] leading-5 text-heading">{clinicianLine(plan.lead)}</Text>
              <Text className={recordMeta}>{plan.lead.specialty} · {plan.lead.department}</Text>
            </View>
            <Row label="Started:" value={shortDate(plan.startDate)} />
            <Row label="Next review:" value={shortDate(plan.nextReview)} />
            <Row label="Target date:" value={shortDate(plan.targetDate)} />
            <Row label="Last updated:" value={shortDate(plan.updated.date)} />
          </View>

          <View className={recordCard}>
            <Text className={recordTitle}>Purpose</Text>
            <Text className={body}>{plan.rationale}</Text>
            {plan.diagnoses.length ? (
              <View className="flex-row flex-wrap gap-1.5">
                {plan.diagnoses.map((diagnosis) => (
                  <Pill key={diagnosis.icd} label={`${diagnosis.name} (${diagnosis.icd})`} tone="sky" />
                ))}
              </View>
            ) : null}
          </View>

          {plan.goals.length ? (
            <View className={recordCard}>
              <Text className={recordTitle}>Goals</Text>
              {plan.goals.map((goal) => (
                <View key={goal.title} className="gap-1 rounded-xl border border-edge p-3">
                  <View className="flex-row flex-wrap items-center justify-between gap-2">
                    <Text className="font-pj-bd text-[14px] leading-5 text-heading">{goal.title}</Text>
                    <Pill label={goal.status} tone="sky" />
                  </View>
                  <Text className={body}>Target: {goal.target}</Text>
                  <Text className={body}>Checked: {goal.cadence}</Text>
                  {goal.protocol ? <Text className={body}>{goal.protocol}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}

          {plan.interventions.length ? (
            <View className={recordCard}>
              <Text className={recordTitle}>Care Steps</Text>
              {plan.interventions.map((step) => (
                <View key={step.title} className="flex-row items-start justify-between gap-2 border-b border-edge/60 pb-2">
                  <View className="flex-1">
                    <Text className="font-pj-sb text-[13px] leading-[18px] text-heading">{step.title}</Text>
                    <Text className={recordMeta}>{[step.type, step.due].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <Pill label={step.state} tone="plain" />
                </View>
              ))}
            </View>
          ) : null}

          {plan.education.length ? (
            <View className="gap-2 rounded-[20px] border border-[#fde68a] bg-[#fffbeb] p-4">
              <Text className={recordTitle}>What to watch for</Text>
              {plan.education.map((item) => (
                <Text key={item} className={body}>
                  • {item}
                </Text>
              ))}
            </View>
          ) : null}

          {planActive(plan.status) && plan.branch.bookable ? (
            <Button label="Book Follow-up Visit" iconLeft="calendar-add-white" onPress={() => router.push(`/clinic/${plan.branch.id}`)} />
          ) : null}
          <RecordNotice title="Written by your care team" body="You can read this plan here. Only your clinic can change its goals and steps." />
        </>
      )}
    </RecordDetailScreen>
  );
}
