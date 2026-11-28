import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { dayLabel } from '@/features/reception/desk';
import { ADVANCE_STATUS, monthLabel, rupees, useMyPay } from '@/features/me/records';
import { Card, Figure, MeScreen, Notice, Pill, Progress, Txt } from '@/features/me/ui';

export default function Advances() {
  const pay = useMyPay();
  const advances = pay.data?.advances ?? [];
  const outstanding = advances.filter((item) => item.status !== 'settled' && item.status !== 'rejected').reduce((sum, item) => sum + item.outstanding, 0);

  return (
    <MeScreen title="My Advances">
      {pay.error && !pay.data ? <ErrorState message={pay.error.message} onAction={pay.reload} /> : null}
      {!pay.data && !pay.error ? <LoadingState label="Loading advances…" /> : null}
      {pay.data && advances.length === 0 ? <EmptyState title="No advances" message="You have no salary advances on record." /> : null}
      {advances.length ? (
        <View className="flex-row gap-2">
          <Figure label="Outstanding" value={rupees(outstanding)} />
          <Figure label="On record" value={String(advances.length)} />
        </View>
      ) : null}
      {advances.map((item) => (
        <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.reference}, ${ADVANCE_STATUS[item.status].label}`} onPress={() => router.push({ pathname: '/me/advance', params: { id: item.id } })}>
          <Card className="gap-2 border-[#e0e3e5]">
            <View className="flex-row items-center justify-between gap-2">
              <Txt className="flex-1 font-in-bd text-[14px]">{item.reference}</Txt>
              <Pill label={ADVANCE_STATUS[item.status].label} tone={ADVANCE_STATUS[item.status].tone} />
            </View>
            <Txt className="text-[#45464d]">
              {item.category} · requested {dayLabel(item.requested, true)}
            </Txt>
            <Txt className="font-in-md">
              {rupees(item.principal)} over {item.installments} {item.installments === 1 ? 'month' : 'months'} from {monthLabel(item.startMonth)}
            </Txt>
            {item.status !== 'rejected' ? (
              <>
                <Progress percent={item.principal ? (item.recovered / item.principal) * 100 : 0} color="#0d9488" />
                <Txt className="text-[11px] text-[#45464d]">{`${rupees(item.recovered)} recovered · ${rupees(item.outstanding)} to go`}</Txt>
              </>
            ) : null}
          </Card>
        </Pressable>
      ))}
      {pay.data ? <Notice text="To ask for a new advance, speak to your clinic administrator. Requests from the app are not available yet." /> : null}
    </MeScreen>
  );
}
