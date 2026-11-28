import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Glyph } from '@/components/staff/ui';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { dayLabel } from '@/features/reception/desk';
import { ADVANCE_STATUS, EMPLOYMENT, monthLabel, PAY_MODEL, rupees, useMyPay } from '@/features/me/records';
import { Card, CardTitle, Figure, Line, MeButton, MeLink, MeScreen, Notice, Pill, Txt } from '@/features/me/ui';
import { useStaff } from '@/state/StaffState';

export default function Salary() {
  const { me } = useStaff();
  const pay = useMyPay();
  // Amounts stay hidden until asked for, since phones are often seen by others at work.
  const [hidden, setHidden] = useState(true);
  const data = pay.data;
  const latest = data?.payslips[0];
  const money = (amount: number) => (hidden ? '₹ ••••••' : rupees(amount));
  const openAdvances = (data?.advances ?? []).filter((item) => item.status !== 'settled' && item.status !== 'rejected');
  const outstanding = openAdvances.reduce((sum, item) => sum + item.outstanding, 0);
  const toConfirm = (data?.advances ?? []).find((item) => item.status === 'awaiting_acknowledgement');

  return (
    <MeScreen title="Salary & Payslips">
      <Card className="gap-2.5 border-[#e0e3e5]">
        <View className="flex-row items-center gap-2.5">
          <View className="size-7 items-center justify-center rounded-full bg-[#131b2e]">
            <Txt className="font-in-bd text-[11px] text-white">{me.initials}</Txt>
          </View>
          <View className="flex-1">
            <Txt className="font-in-bd text-[14px]">
              {me.name} <Txt className="text-[11px] text-[#45464d]">({me.employeeId})</Txt>
            </Txt>
            <Txt className="text-[#45464d]">{`${me.designation} • ${me.branch}`}</Txt>
          </View>
        </View>
        <View className="flex-row items-center justify-between gap-2 border-t border-[#e6e8ea] pt-2.5">
          <Pill label="Your pay · Confidential" icon="lock-outline" />
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setHidden(!hidden)} className="flex-row items-center gap-1">
            <Glyph name={hidden ? 'visibility' : 'visibility-off'} size={15} color="#006398" />
            <Txt className="font-in-sb text-[#006398]">{hidden ? 'Show amounts' : 'Hide amounts'}</Txt>
          </Pressable>
        </View>
      </Card>

      {pay.error && !data ? <ErrorState message={pay.error.message} onAction={pay.reload} /> : null}
      {!data && !pay.error ? <LoadingState label="Loading your pay…" /> : null}

      {toConfirm ? (
        <Card className="border-[#fde68a] bg-[#fffbeb]">
          <CardTitle title="Confirm you received your advance" icon="payments" />
          <Txt>
            {toConfirm.reference} · {money(toConfirm.principal)}. Recovery from your pay starts once you confirm.
          </Txt>
          <MeButton label="Review & Confirm" onPress={() => router.push({ pathname: '/me/advance', params: { id: toConfirm.id } })} />
        </Card>
      ) : null}

      {data && !latest ? <EmptyState title="No payslips yet" message="Payslips appear here once a payroll run that includes you has been processed." /> : null}
      {latest ? (
        <Card className="border-[#e0e3e5]">
          <View className="flex-row items-center justify-between gap-2 border-b border-[#e6e8ea] pb-3">
            <View>
              <Txt className="text-[11px] text-[#76777d]">LATEST PAYSLIP</Txt>
              <Txt className="font-in-bd text-[18px] leading-6">{monthLabel(latest.month)}</Txt>
            </View>
            <Pill label={latest.paid ? 'Paid' : 'Processed'} tone={latest.paid ? 'green' : 'blue'} icon="check-circle" />
          </View>
          <View>
            <Txt className="font-in-md text-[#45464d]">Net Pay</Txt>
            <Txt className="font-in-bd text-[28px] leading-9 text-black">{money(latest.net)}</Txt>
          </View>
          <Line label="Gross Earnings" value={money(latest.gross)} />
          {latest.additions ? <Line label="Additions" value={money(latest.additions)} /> : null}
          <Line label="Deductions & Statutory" value={money(latest.deductions + latest.statutory.reduce((sum, line) => sum + line.amount, 0))} />
          {latest.advance ? <Line label="Advance Recovery" value={money(latest.advance)} /> : null}
          <MeButton label="View Payslip" icon="visibility" onPress={() => router.push({ pathname: '/me/payslip', params: { id: latest.id } })} />
          <Txt className="text-[11px] text-[#76777d]">
            {latest.paid ? `Paid on ${dayLabel(latest.paid.date, true)}${latest.paid.reference ? ` · Ref ${latest.paid.reference}` : ''}` : latest.payDate ? `Pay date ${dayLabel(latest.payDate, true)} · payment not yet recorded` : 'Payment not yet recorded'}
          </Txt>
        </Card>
      ) : null}

      {data && data.payslips.length > 1 ? (
        <Card className="border-[#e0e3e5]">
          <CardTitle title="Earlier Payslips" icon="history" />
          {data.payslips.slice(1).map((slip) => (
            <Pressable key={slip.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/me/payslip', params: { id: slip.id } })} className="flex-row items-center justify-between gap-2 border-t border-[#eceef0] pt-2">
              <View>
                <Txt className="font-in-sb">{monthLabel(slip.month)}</Txt>
                <Txt className="text-[11px] text-[#76777d]">{slip.reference}</Txt>
              </View>
              <Txt className="font-in-bd">{money(slip.net)}</Txt>
              <Glyph name="chevron-right" size={16} color="#76777d" />
            </Pressable>
          ))}
        </Card>
      ) : null}

      {data?.advances.length ? (
        <Card className="border-[#e0e3e5]">
          <CardTitle title="Salary Advances" icon="account-balance-wallet" right={<MeLink label="All advances" onPress={() => router.push('/me/advances')} />} />
          <View className="flex-row gap-2">
            <Figure label="Outstanding" value={money(outstanding)} />
            <Figure label="Open" value={String(openAdvances.length)} />
          </View>
          {openAdvances.slice(0, 2).map((item) => (
            <View key={item.id} className="flex-row items-center justify-between gap-2">
              <Txt className="flex-1">{item.reference}</Txt>
              <Pill label={ADVANCE_STATUS[item.status].label} tone={ADVANCE_STATUS[item.status].tone} />
            </View>
          ))}
        </Card>
      ) : null}

      {data?.profile ? (
        <Card className="border-[#e0e3e5]">
          <CardTitle title="Pay Setup" icon="badge" />
          <Line label="Employment" value={EMPLOYMENT[data.profile.employment] ?? data.profile.employment} />
          <Line label="Rate" value={`${money(data.profile.rate)} ${PAY_MODEL[data.profile.model]}`} />
          <Line label="Paid into" value={`${data.profile.bankName} ••••${data.profile.accountLast4}`} />
          <Line label="Bank details" value={data.profile.bankVerified ? 'Verified' : 'Awaiting verification'} />
        </Card>
      ) : null}
      {data ? <Notice text="Pay is set up and processed by your clinic in the admin panel. PDF payslips are not available yet." /> : null}
    </MeScreen>
  );
}
