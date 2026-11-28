import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { AccountHeader } from '@/features/account/AccountHeader';
import { dayLabel } from '@/features/reception/desk';
import { useSignedIn } from '@/state/SessionState';

const ENGAGEMENT = { full_time: 'Full time', visiting: 'Visiting', honorary: 'Honorary' } as const;
const card = 'gap-2 rounded-[20px] border border-sky-250/60 bg-white p-4';

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3 border-b border-sky-150 py-2">
      <Text className="text-[12px] leading-[17px] text-slate">{label}</Text>
      <Text className="flex-1 text-right font-pj-sb text-[12px] leading-[17px] text-ink">{value}</Text>
    </View>
  );
}

/** The registration and qualifications on this doctor's staff record. */
export default function Credentials() {
  const signedIn = useSignedIn();
  const staff = signedIn?.me.staff;
  const practitioner = signedIn?.me.practitioner;

  return (
    <Screen className="bg-sky-50" header={<AccountHeader title="Professional Credentials" subtitle="Qualifications & registration" back="cr-hdr-back" profile="cr-hdr-profile" />} contentClassName="gap-4 px-4 pt-2 pb-8">
      {!staff ? (
        <EmptyState title="No staff record" message="Your account is not linked to a staff record. Ask your clinic administrator." />
      ) : (
        <>
          <View className={card}>
            <Text className="font-pj-bd text-[11px] leading-4 text-slate">REGISTRATION</Text>
            <Line label="Medical council" value={staff.council ?? 'Not recorded'} />
            <Line label="Registration number" value={staff.councilNumber ?? 'Not recorded'} />
            <Line label="Staff code" value={staff.staffCode} />
            <Line label="Status" value={staff.status === 'active' ? 'Active' : staff.status} />
          </View>
          <View className={card}>
            <Text className="font-pj-bd text-[11px] leading-4 text-slate">QUALIFICATIONS</Text>
            {staff.qualifications.length === 0 ? <Text className="text-[12px] leading-[17px] text-slate">None recorded.</Text> : null}
            <View className="flex-row flex-wrap gap-1.5">
              {staff.qualifications.map((item) => (
                <View key={item} className="rounded-lg bg-sky-100 px-2.5 py-1">
                  <Text className="font-pj-sb text-[12px] leading-4 text-ink">{item}</Text>
                </View>
              ))}
            </View>
          </View>
          <View className={card}>
            <Text className="font-pj-bd text-[11px] leading-4 text-slate">PRACTICE</Text>
            <Line label="Designation" value={staff.designation} />
            <Line label="Department" value={practitioner?.department ?? staff.department} />
            {practitioner ? <Line label="Specialty" value={practitioner.specialty} /> : null}
            {practitioner?.credentials ? <Line label="Shown to patients as" value={`${practitioner.displayName}, ${practitioner.credentials}`} /> : null}
            <Line label="Engagement" value={ENGAGEMENT[staff.engagement]} />
            <Line label="On record since" value={dayLabel(staff.createdAt.slice(0, 10), true)} />
          </View>
          <View className="rounded-2xl bg-sky-100 p-4">
            <Text className="text-[12px] leading-[18px] text-slate">These details come from your staff record. Your clinic administrator updates them in the admin panel.</Text>
          </View>
        </>
      )}
    </Screen>
  );
}
