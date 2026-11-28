import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { dayLabel } from '@/features/reception/desk';
import { monthLabel, rupees, useMyPay } from '@/features/me/records';
import { Card, CardTitle, Line, MeButton, MeScreen, Pill, Txt } from '@/features/me/ui';
import { useStaff } from '@/state/StaffState';

function Section({ title, lines, total, totalLabel }: { title: string; lines: { key: string; label: string; amount: string }[]; total: string; totalLabel: string }) {
  return (
    <Card className="border-[#e0e3e5]">
      <CardTitle title={title} />
      {lines.map((line) => (
        <Line key={line.key} label={line.label} value={line.amount} />
      ))}
      <View className="border-t border-[#eceef0] pt-2">
        <Line label={totalLabel} value={total} valueClassName="font-in-bd text-[14px]" />
      </View>
    </Card>
  );
}

export default function PayslipDetail() {
  const toast = useToast();
  const { me } = useStaff();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const pay = useMyPay();
  const [hidden, setHidden] = useState(false);
  const slip = pay.data?.payslips.find((item) => item.id === id) ?? (id ? undefined : pay.data?.payslips[0]);

  if (!slip) {
    return (
      <MeScreen title="Payslip">
        {pay.error ? (
          <ErrorState message={pay.error.message} onAction={pay.reload} />
        ) : pay.data ? (
          <EmptyState title="Payslip not found" message="Only payslips from processed payroll runs are shown." actionLabel="Open Salary" onAction={() => router.dismissTo('/me/salary')} />
        ) : (
          <LoadingState label="Loading your payslip…" />
        )}
      </MeScreen>
    );
  }

  const money = (amount: number) => (hidden ? '₹ ••••••' : rupees(amount));
  const added = slip.adjustments.filter((item) => item.direction === 'addition');
  const taken = slip.adjustments.filter((item) => item.direction !== 'addition');
  const statutory = slip.statutory.reduce((sum, line) => sum + line.amount, 0);

  const share = () =>
    Share.share({ message: `Payslip ${slip.reference} · ${monthLabel(slip.month)} · ${me.name} (${me.employeeId}) · Net ${rupees(slip.net)}` }).catch(() => toast('This device cannot share.'));

  return (
    <MeScreen title="Payslip">
      <Card className="border-[#e0e3e5]">
        <View className="flex-row items-center justify-between gap-2">
          <View>
            <Txt className="text-[11px] text-[#76777d]">{slip.reference}</Txt>
            <Txt className="font-in-bd text-[18px] leading-6">{monthLabel(slip.month)}</Txt>
          </View>
          <Pill label={slip.paid ? 'Paid' : 'Processed'} tone={slip.paid ? 'green' : 'blue'} />
        </View>
        <Txt className="text-[#45464d]">
          {me.name} · {me.employeeId}
          {slip.branch ? ` · ${slip.branch}` : ''}
        </Txt>
        <View className="border-t border-[#eceef0] pt-2">
          <Txt className="font-in-md text-[#45464d]">Net Pay</Txt>
          <Txt className="font-in-bd text-[28px] leading-9 text-black">{money(slip.net)}</Txt>
        </View>
        <Txt className="text-[11px] text-[#76777d]">
          {slip.paid ? `Paid on ${dayLabel(slip.paid.date, true)}${slip.paid.reference ? ` · Ref ${slip.paid.reference}` : ''}` : 'Payment not yet recorded'}
        </Txt>
      </Card>

      <Section title="Earnings" lines={[{ key: 'gross', label: slip.quantityNote || 'Pay for the period', amount: money(slip.gross) }]} totalLabel="Gross Earnings" total={money(slip.gross)} />
      {slip.additions ? (
        <Section title="Additions" lines={added.map((item) => ({ key: item.id, label: item.label, amount: `+ ${money(item.amount)}` }))} totalLabel="Total Additions" total={`+ ${money(slip.additions)}`} />
      ) : null}
      {statutory ? (
        <Section title="Statutory Deductions" lines={slip.statutory.map((line) => ({ key: line.code, label: line.label, amount: `− ${money(line.amount)}` }))} totalLabel="Total Statutory" total={`− ${money(statutory)}`} />
      ) : null}
      {slip.deductions ? (
        <Section title="Other Deductions" lines={taken.map((item) => ({ key: item.id, label: item.label, amount: `− ${money(item.amount)}` }))} totalLabel="Total Other" total={`− ${money(slip.deductions)}`} />
      ) : null}

      <Card className="border-[#e0e3e5]">
        <Line label="Gross Earnings" value={money(slip.gross)} />
        <Line label="Additions (+)" value={money(slip.additions)} />
        <Line label="Statutory (−)" value={money(statutory)} />
        <Line label="Other Deductions (−)" value={money(slip.deductions)} />
        <Line label="Advance Recovery (−)" value={money(slip.advance)} />
        <View className="border-t border-[#c6c6cd] pt-2">
          <Line label="Net Pay" value={money(slip.net)} valueClassName="font-in-bd text-[18px]" />
        </View>
      </Card>
      <View className="flex-row gap-2">
        <MeButton label={hidden ? 'Show Amounts' : 'Hide Amounts'} icon={hidden ? 'visibility' : 'visibility-off'} tone="line" onPress={() => setHidden(!hidden)} className="flex-1" />
        <MeButton label="Share Summary" icon="share" onPress={share} className="flex-1" />
      </View>
    </MeScreen>
  );
}
