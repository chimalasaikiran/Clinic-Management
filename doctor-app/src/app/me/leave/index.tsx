import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { FilterChips } from '@/components/ui/FilterChips';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { localToday } from '@/features/reception/desk';
import { LEAVE_KIND, LEAVE_STATE, leaveDays, leaveRange, leaveState, useMyLeaves, type LeaveState } from '@/features/me/records';
import { Card, CardTitle, Figure, MeScreen, Notice, Pill, Txt } from '@/features/me/ui';

type Filter = 'all' | LeaveState;

export default function LeaveList() {
  const today = localToday();
  const list = useMyLeaves();
  const [filter, setFilter] = useState<Filter>('all');
  const data = list.data;
  const leaves = data?.leaves ?? [];
  const count = (state: LeaveState) => leaves.filter((item) => leaveState(item, today) === state).length;
  const year = today.slice(0, 4);
  // Days taken or booked this year, for whole-day leave only.
  const daysThisYear = leaves.filter((item) => item.kind === 'leave' && item.status === 'scheduled' && !item.startTime && item.startDate.startsWith(year)).reduce((sum, item) => sum + leaveDays(item), 0);
  const shown = leaves.filter((item) => filter === 'all' || leaveState(item, today) === filter);

  return (
    <MeScreen title="Leave">
      {list.error && !data ? <ErrorState message={list.error.message} onAction={list.reload} /> : null}
      {!data && !list.error ? <LoadingState label="Loading your leave…" /> : null}
      {data && !data.linked ? <EmptyState title="No staff record" message="Your account is not linked to a staff record, so no leave is kept for you." /> : null}
      {data?.linked ? (
        <>
          <Card className="border-[#e0e3e5]">
            <CardTitle title={`Leave in ${year}`} icon="beach-access" />
            <View className="flex-row gap-2">
              <Figure label="Days taken or booked" value={String(daysThisYear)} />
              <Figure label="Upcoming" value={String(count('upcoming') + count('current'))} />
            </View>
            <Notice text="Your clinic administrator records leave. Requesting leave, approvals and leave balances are not available in ClinicOS yet." />
          </Card>
          <FilterChips
            options={[
              { value: 'all' as const, label: `All (${leaves.length})` },
              { value: 'upcoming' as const, label: `Upcoming (${count('upcoming')})` },
              { value: 'past' as const, label: `Taken (${count('past')})` },
              { value: 'cancelled' as const, label: `Cancelled (${count('cancelled')})` },
            ]}
            value={filter}
            onChange={setFilter}
          />
          {shown.length === 0 ? <EmptyState title="Nothing here" message={leaves.length ? 'No leave matches this filter.' : 'No leave is recorded for you.'} /> : null}
          {shown.map((item) => {
            const state = leaveState(item, today);
            return (
              <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.title}, ${LEAVE_STATE[state].label}`} onPress={() => router.push(`/me/leave/${item.id}`)}>
                <Card className="gap-1.5 border-[#e0e3e5]">
                  <View className="flex-row items-center justify-between gap-2">
                    <Txt className="flex-1 font-in-bd text-[14px]">{item.title}</Txt>
                    <Pill label={LEAVE_STATE[state].label} tone={LEAVE_STATE[state].tone} />
                  </View>
                  <Txt className="font-in-md">
                    {leaveRange(item)}
                    {item.startTime ? ` · ${item.startTime}–${item.endTime}` : ` · ${leaveDays(item)} ${leaveDays(item) === 1 ? 'day' : 'days'}`}
                  </Txt>
                  <Txt className="text-[#45464d]">
                    {LEAVE_KIND[item.kind]} · {item.branch?.name ?? 'All your branches'}
                  </Txt>
                </Card>
              </Pressable>
            );
          })}
        </>
      ) : null}
    </MeScreen>
  );
}
