import { router } from 'expo-router';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { PatientStrip, recordCard, recordMeta, recordTitle, RecordNotice, StatRow } from '@/features/health/RecordKit';
import { counted, RecordListScreen } from '@/features/health/RecordScreen';
import { useList } from '@/hooks/useResource';
import { clinicianLine, PLAN_STATUS, planActive, shortDate } from '@/lib/records';
import { clinicToday, relativeDay } from '@/lib/visit';
import { useAccount } from '@/state/SessionState';
import type { CarePlan } from '@/types';

type Filter = 'all' | 'active' | 'finished';

const openPlan = (id: string) => router.push(`/health/care-plans/${id}`);

function PlanCard({ plan }: { plan: CarePlan }) {
  const active = planActive(plan.status);
  const status = PLAN_STATUS[plan.status];
  return (
    <View className={recordCard}>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Pill label={status.label} tone={status.tone} />
        <Text className="text-[11px] leading-4 text-[#566b74]">Since {shortDate(plan.startDate)}</Text>
      </View>
      <View>
        <Text className={recordTitle}>{plan.title}</Text>
        <Text className={recordMeta}>#{plan.reference} · {plan.category}</Text>
      </View>
      <View className="rounded-xl bg-[#f4f7f6] p-3">
        <Text className="font-pj-bd text-[13px] leading-[18px] text-heading">{clinicianLine(plan.lead)}</Text>
        <Text className={recordMeta}>{plan.lead.specialty} · {plan.clinicName}</Text>
      </View>
      {plan.goals.length ? (
        <View className="gap-1.5 rounded-xl border border-edge p-3">
          <Text className="font-pj-bd text-[11px] leading-4 text-teal">GOALS</Text>
          {plan.goals.map((goal) => (
            <Text key={goal.title} className="text-[12px] leading-[18px] text-heading">
              • {goal.title}: {goal.target} <Text className="text-[12px] text-[#566b74]">({goal.status})</Text>
            </Text>
          ))}
        </View>
      ) : null}
      <Button label={active ? 'View Care Plan Details' : 'View Plan (Read-Only)'} variant="soft" size="md" onPress={() => openPlan(plan.id)} />
    </View>
  );
}

function FollowUps({ plans }: { plans: CarePlan[] }) {
  const due = plans.filter((plan) => planActive(plan.status)).sort((a, b) => a.nextReview.localeCompare(b.nextReview));
  if (!due.length) return null;
  return (
    <>
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className={recordTitle}>Next Reviews</Text>
        <Pill label="Not booked automatically" tone="amber" />
      </View>
      {due.map((plan) => (
        <View key={plan.id} className={recordCard}>
          <Pill label={`${plan.nextReview < clinicToday() ? 'Overdue since' : 'Due'} ${shortDate(plan.nextReview)} · ${relativeDay(plan.nextReview)}`} tone="amber" />
          <Text className={recordTitle}>{plan.title}</Text>
          <Text className={recordMeta}>With {clinicianLine(plan.lead)} at {plan.clinicName}</Text>
          <View className="flex-row gap-2">
            {plan.branch.bookable ? (
              <Button label="Book Follow-up" size="md" className="flex-1" onPress={() => router.push(`/clinic/${plan.branch.id}`)} />
            ) : null}
            <Button label="Details" variant="soft" size="md" className={plan.branch.bookable ? undefined : 'flex-1'} onPress={() => openPlan(plan.id)} />
          </View>
        </View>
      ))}
      <Text className={recordTitle}>All Care Plans</Text>
    </>
  );
}

export default function CarePlans() {
  const account = useAccount();
  const records = useList<CarePlan>('/v1/patient/care-plans?pageSize=50', ['records', 'app_access']);
  return (
    <RecordListScreen<CarePlan, Filter>
      title="Care Plans & Follow-ups"
      subtitle="Plans your care team has set for you"
      records={records}
      summary={(plans) => (
        <>
          <PatientStrip name={account?.fullName ?? ''} detail="Written by your care team" />
          <StatRow
            stats={[
              { label: 'ACTIVE', value: String(plans.filter((plan) => planActive(plan.status)).length), caption: 'Care plans', highlight: true },
              { label: 'NEEDS ATTENTION', value: String(plans.filter((plan) => plan.status === 'at_risk').length), caption: 'Plans' },
              { label: 'FINISHED', value: String(plans.filter((plan) => !planActive(plan.status)).length), caption: 'Plans' },
            ]}
          />
          <FollowUps plans={plans} />
        </>
      )}
      searchPlaceholder="Search care plans..."
      filters={(plans) => [
        { value: 'all', label: counted(plans, 'All') },
        { value: 'active', label: counted(plans, 'Active', (plan) => planActive(plan.status)) },
        { value: 'finished', label: counted(plans, 'Finished', (plan) => !planActive(plan.status)) },
      ]}
      searchText={(plan) => `${plan.title} ${plan.reference} ${plan.category} ${plan.lead.displayName}`}
      matches={(plan, filter) => filter === 'all' || (filter === 'active') === planActive(plan.status)}
      renderItems={(plans) => plans.map((plan) => <PlanCard key={plan.id} plan={plan} />)}
      emptyMessage="Care plans your clinic sets up for you appear here."
      footer={
        <RecordNotice
          title="Care Plan Governance"
          body="Care plans are written by your care team. You can read them and book the suggested reviews, but targets can only be changed by the clinic."
        />
      }
    />
  );
}
