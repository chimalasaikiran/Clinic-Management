import { router, useLocalSearchParams } from 'expo-router';

import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { dayLabel, localToday } from '@/features/reception/desk';
import { LEAVE_KIND, LEAVE_STATE, leaveDays, leaveRange, leaveState, useMyLeaves } from '@/features/me/records';
import { Card, CardTitle, Line, MeScreen, Notice, Pill } from '@/features/me/ui';

export default function LeaveDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = useMyLeaves();
  const leave = list.data?.leaves.find((item) => item.id === id);

  if (!leave) {
    return (
      <MeScreen title="Leave Details">
        {list.error ? (
          <ErrorState message={list.error.message} onAction={list.reload} />
        ) : list.data ? (
          <EmptyState title="Leave not found" message="It may have been removed." actionLabel="Open Leave" onAction={() => router.dismissTo('/me/leave')} />
        ) : (
          <LoadingState label="Loading…" />
        )}
      </MeScreen>
    );
  }
  const state = leaveState(leave, localToday());

  return (
    <MeScreen title="Leave Details">
      <Card className="border-[#e0e3e5]">
        <CardTitle title={leave.title} icon="beach-access" right={<Pill label={LEAVE_STATE[state].label} tone={LEAVE_STATE[state].tone} />} />
        <Line label="Type" value={LEAVE_KIND[leave.kind]} />
        <Line label="Dates" value={leaveRange(leave)} />
        <Line label={leave.startTime ? 'Hours' : 'Days'} value={leave.startTime ? `${leave.startTime} – ${leave.endTime}` : String(leaveDays(leave))} />
        <Line label="Applies to" value={leave.branch?.name ?? 'All your branches'} />
        <Line label="Reason" value={leave.reason} />
        <Line label="Recorded by" value={`${leave.createdBy}, ${dayLabel(leave.createdAt.slice(0, 10), true)}`} />
        {leave.cancelledAt ? <Line label="Cancelled by" value={`${leave.cancelledBy ?? '—'}, ${dayLabel(leave.cancelledAt.slice(0, 10), true)}`} /> : null}
      </Card>
      <Notice text="While leave is scheduled, no new appointments can be booked with you in that time. To change or cancel it, ask your administrator." />
    </MeScreen>
  );
}
