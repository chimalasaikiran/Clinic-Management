import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { AccountHeader } from '@/features/account/AccountHeader';
import { cn } from '@/lib/cn';
import { useSignedIn } from '@/state/SessionState';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Where this person works, and which branches their role lets them see. */
export default function Branches() {
  const signedIn = useSignedIn();
  const staff = signedIn?.me.staff;
  const practitioner = signedIn?.me.practitioner;
  const scope = signedIn?.membership?.branchScope;
  const branches = staff?.branches ?? [];

  return (
    <Screen className="bg-sky-50" header={<AccountHeader title="Clinic & Branch Access" subtitle={signedIn?.membership?.organisation.name ?? ''} back="br-hdr-back" profile="av-hdr-profile" />} contentClassName="gap-4 px-4 pt-2 pb-8">
      {branches.length === 0 ? <EmptyState title="No branch assigned" message="Your staff record has no branch yet. Ask your clinic administrator." /> : null}
      {branches.map((branch) => {
        const days = [...new Set((practitioner?.availability ?? []).filter((window) => window.branch.id === branch.id).map((window) => WEEKDAYS[window.weekday]))];
        return (
          <View key={branch.id} className={cn('gap-2 rounded-[20px] border bg-white p-4', branch.primary ? 'border-teal/40' : 'border-sky-250/60')}>
            <View className="flex-row items-center justify-between gap-2">
              <Text className="flex-1 font-pj-bd text-[15px] leading-5 text-ink">{branch.name}</Text>
              <View className={cn('rounded-full px-2.5 py-0.5', branch.primary ? 'bg-mint' : 'bg-sky-150')}>
                <Text className="font-pj-bd text-[10px] leading-[15px] text-deep">{branch.primary ? 'PRIMARY' : 'SECONDARY'}</Text>
              </View>
            </View>
            <Text className="text-[12px] leading-[17px] text-slate">{days.length ? `Consulting ${days.join(', ')}` : practitioner ? 'No consulting hours here' : 'Assigned branch'}</Text>
          </View>
        );
      })}
      <View className="gap-1 rounded-2xl bg-sky-100 p-4">
        <Text className="font-pj-bd text-[11px] leading-4 text-slate">WHAT YOUR ROLE CAN SEE</Text>
        <Text className="text-[12px] leading-[18px] text-ink">
          {scope === 'all' ? 'Every branch of the clinic.' : scope && scope.length ? `${scope.length} ${scope.length === 1 ? 'branch' : 'branches'}, as listed above.` : 'No branches.'}
        </Text>
        <Text className="text-[12px] leading-[18px] text-slate">Roles: {signedIn?.membership?.roles.map((role) => role.name).join(', ') || 'none'}. Branches and roles are changed in the admin panel.</Text>
      </View>
    </Screen>
  );
}
