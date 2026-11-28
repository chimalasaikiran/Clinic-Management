import { View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { AccountHeader } from '@/features/account/AccountHeader';
import { clock } from '@/features/reception/desk';
import { useSignedIn } from '@/state/SessionState';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const card = 'gap-3 rounded-[20px] border border-sky-250/60 bg-white p-4';

/** The doctor's weekly consulting hours, as the booking system uses them. Changing them is an administrator's job. */
export default function Availability() {
  const practitioner = useSignedIn()?.me.practitioner;
  const windows = practitioner?.availability ?? [];
  const minutes = windows.reduce((sum, window) => {
    const [sh, sm] = window.start.split(':').map(Number) as [number, number];
    const [eh, em] = window.end.split(':').map(Number) as [number, number];
    return sum + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);
  const days = WEEKDAYS.map((name, weekday) => ({ name, windows: windows.filter((window) => window.weekday === weekday) }));
  const branches = [...new Map(windows.map((window) => [window.branch.id, window.branch.name])).values()];

  return (
    <Screen className="bg-sky-50" header={<AccountHeader title="Availability & Working Hours" subtitle="Your weekly consulting hours" back="br-hdr-back" profile="av-hdr-profile" />} contentClassName="gap-4 px-4 pt-2 pb-8">
      {!practitioner ? (
        <EmptyState title="No consulting profile" message="You do not have a practitioner profile, so no consulting hours are set." />
      ) : (
        <>
          <View className={card}>
            <Text className="font-pj-bd text-[11px] leading-4 text-slate">THIS WEEK</Text>
            <View className="flex-row gap-3">
              {[
                ['Hours / week', String(Math.round((minutes / 60) * 10) / 10)],
                ['Consulting days', String(days.filter((day) => day.windows.length).length)],
                ['Slot length', `${practitioner.slotMinutes} min`],
              ].map(([label, value]) => (
                <View key={label} className="flex-1 rounded-xl bg-sky-100 p-3">
                  <Text className="text-[11px] leading-4 text-slate">{label}</Text>
                  <Text className="font-pj-bd text-[18px] leading-6 text-ink">{value}</Text>
                </View>
              ))}
            </View>
            {branches.length ? <Text className="text-[12px] leading-[17px] text-slate">At {branches.join(', ')}</Text> : null}
          </View>

          <View className={card}>
            <Text className="font-pj-bd text-[11px] leading-4 text-slate">WEEKLY SCHEDULE</Text>
            {days.map((day) => (
              <View key={day.name} className="flex-row items-start justify-between gap-3 border-b border-sky-150 pb-2">
                <Text className="w-24 font-pj-sb text-[13px] leading-[18px] text-ink">{day.name}</Text>
                <View className="flex-1 items-end gap-0.5">
                  {day.windows.length === 0 ? <Text className="text-[12px] leading-[17px] text-slate">Not consulting</Text> : null}
                  {day.windows.map((window) => (
                    <Text key={`${window.start}-${window.branch.id}`} className="text-right text-[12px] leading-[17px] text-ink">
                      {clock(window.start)} – {window.end === '24:00' ? '12:00 AM' : clock(window.end)} · {window.branch.name}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>

          <View className="rounded-2xl bg-sky-100 p-4">
            <Text className="text-[12px] leading-[18px] text-slate">
              Patients can only be booked inside these hours. To change them or take leave, ask your clinic administrator; they are set in the admin panel under Staff & Scheduling.
            </Text>
          </View>
        </>
      )}
    </Screen>
  );
}
