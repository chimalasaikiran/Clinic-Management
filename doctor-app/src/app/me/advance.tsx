import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { dayLabel } from '@/features/reception/desk';
import { AcknowledgeForm } from '@/features/me/AcknowledgeForm';
import { ADVANCE_STATUS, instalmentOf, monthLabel, rupees, shiftMonth, useMyPay, type Advance } from '@/features/me/records';
import { Card, CardTitle, Figure, Line, MeScreen, Pill, Progress, Txt } from '@/features/me/ui';
import { cn } from '@/lib/cn';

type Step = { title: string; note: string; done: boolean };

function stepsOf(advance: Advance): Step[] {
  const steps: Step[] = [{ title: 'Requested', note: dayLabel(advance.requested, true), done: true }];
  if (advance.status === 'rejected') return [...steps, { title: 'Refused', note: advance.rejectionReason ?? '', done: true }];
  steps.push({ title: 'Approved', note: advance.approved ? dayLabel(advance.approved, true) : 'Waiting', done: !!advance.approved || !!advance.disbursed });
  steps.push({ title: 'Paid to you', note: advance.disbursed ? `${dayLabel(advance.disbursed, true)}${advance.method ? ` · ${advance.method}` : ''}` : 'Waiting', done: !!advance.disbursed });
  steps.push({ title: 'Receipt confirmed', note: advance.acknowledged ? dayLabel(advance.acknowledged, true) : 'Waiting', done: !!advance.acknowledged });
  steps.push({ title: 'Settled', note: advance.status === 'settled' ? 'Fully recovered' : `${rupees(advance.outstanding)} to go`, done: advance.status === 'settled' });
  return steps;
}

export default function AdvanceDetail() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const pay = useMyPay();
  const advance = pay.data?.advances.find((item) => item.id === id);

  if (!advance) {
    return (
      <MeScreen title="Advance">
        {pay.error ? (
          <ErrorState message={pay.error.message} onAction={pay.reload} />
        ) : pay.data ? (
          <EmptyState title="Advance not found" message="Open it from your list of advances." actionLabel="My Advances" onAction={() => router.dismissTo('/me/advances')} />
        ) : (
          <LoadingState label="Loading…" />
        )}
      </MeScreen>
    );
  }

  // Instalments already recovered, then the months still expected. A run that leaves someone out moves the later ones on.
  const upcoming = advance.status === 'active' || advance.status === 'awaiting_acknowledgement' ? Math.max(0, advance.installments - advance.recoveries.length) : 0;
  const last = advance.recoveries.at(-1)?.month;
  const next = last ? shiftMonth(last, 1) : advance.startMonth;

  return (
    <MeScreen title="Advance">
      <Card className="border-[#e0e3e5]">
        <View className="flex-row items-center justify-between gap-2">
          <Txt className="flex-1 font-in-bd text-[16px] leading-6">{advance.reference}</Txt>
          <Pill label={ADVANCE_STATUS[advance.status].label} tone={ADVANCE_STATUS[advance.status].tone} />
        </View>
        <Txt className="text-[#45464d]">{advance.category}</Txt>
        <View className="flex-row gap-2">
          <Figure label="Amount" value={rupees(advance.principal)} />
          <Figure label="Outstanding" value={rupees(advance.outstanding)} />
        </View>
        {advance.status !== 'rejected' ? <Progress percent={advance.principal ? (advance.recovered / advance.principal) * 100 : 0} color="#0d9488" /> : null}
        <Line label="Repayment" value={`${advance.installments} monthly, about ${rupees(instalmentOf(advance))} each`} />
        <Line label="First recovery" value={monthLabel(advance.startMonth)} />
      </Card>

      {advance.status === 'awaiting_acknowledgement' ? (
        <Card className="border-[#fde68a] bg-[#fffbeb]">
          <CardTitle title="Confirm Receipt" icon="payments" />
          <AcknowledgeForm advance={advance} onDone={pay.reload} />
        </Card>
      ) : null}

      <Card className="border-[#e0e3e5]">
        <CardTitle title="Progress" icon="history" />
        {stepsOf(advance).map((step) => (
          <View key={step.title} className="flex-row gap-3">
            <View className={cn('mt-1 size-2.5 rounded-full', step.done ? 'bg-[#0d9488]' : 'bg-[#c6c6cd]')} />
            <View className="flex-1">
              <Txt className="font-in-sb">{step.title}</Txt>
              <Txt className="text-[#45464d]">{step.note}</Txt>
            </View>
          </View>
        ))}
      </Card>

      {advance.recoveries.length || upcoming ? (
        <Card className="border-[#e0e3e5]">
          <CardTitle title="Recoveries" icon="account-balance-wallet" />
          {advance.recoveries.map((item) => (
            <Line key={item.number} label={`${item.number}. ${monthLabel(item.month)}`} value={`${rupees(item.amount)} · recovered`} valueClassName="text-[#047857]" />
          ))}
          {Array.from({ length: upcoming }, (_, index) => (
            <Line key={`due-${index}`} label={`${advance.recoveries.length + index + 1}. ${monthLabel(shiftMonth(next, index))}`} value="Expected" valueClassName="text-[#45464d]" />
          ))}
        </Card>
      ) : null}
    </MeScreen>
  );
}
