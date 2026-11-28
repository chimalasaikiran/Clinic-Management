import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Glyph, RoundButton } from '@/components/staff/ui';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { clock, dayLabel, localToday, weekdayOf } from '@/features/reception/desk';
import { ATTENDANCE, monthLabel, shiftMonth, useMyAttendance, type AttendanceRecord, type AttendanceStatus } from '@/features/me/records';
import { Card, CardTitle, Line, MeScreen, Notice, Pill, Txt } from '@/features/me/ui';
import { cn } from '@/lib/cn';

const SUMMARY: AttendanceStatus[] = ['present', 'late', 'leave', 'absent'];
const recordTitle = (record: AttendanceRecord) => `${ATTENDANCE[record.status].label}${record.time ? ` · arrived ${clock(record.time)}` : ''}`;

export default function Attendance() {
  const today = localToday();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [filter, setFilter] = useState<AttendanceStatus | 'all'>('all');
  const [openDay, setOpenDay] = useState<string | null>(null);
  const attendance = useMyAttendance(month);

  const data = attendance.data;
  const records = data?.records ?? [];
  const byDay = new Map<string, AttendanceRecord[]>();
  for (const record of records) byDay.set(record.date, [...(byDay.get(record.date) ?? []), record]);
  const todays = month === today.slice(0, 7) ? (byDay.get(today) ?? []) : [];
  const shown = records.filter((record) => filter === 'all' || record.status === filter);
  const [year, index] = month.split('-').map(Number) as [number, number];
  const days = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, index - 1, 1)).getUTCDay() + 6) % 7;
  const dayRecords = openDay ? (byDay.get(openDay) ?? []) : [];

  return (
    <MeScreen title="Attendance">
      <Card className="border-[#e0e3e5]">
        <View className="flex-row items-start justify-between gap-2">
          <View className="flex-1">
            <View className="flex-row items-center gap-1.5">
              <Glyph name="schedule" size={13} color="#45464d" />
              <Txt className="font-in-sb text-[#45464d]">Today</Txt>
            </View>
            <Txt className="font-in-bd text-[18px] leading-6">{dayLabel(today, true)}</Txt>
          </View>
          {todays[0] ? <Pill label={ATTENDANCE[todays[0].status].label} tone={ATTENDANCE[todays[0].status].tone} dot /> : <Pill label="Not recorded" />}
        </View>
        {todays.map((record) => (
          <Txt key={record.id} className="text-[#45464d]">
            {recordTitle(record)} · {record.branch.name}
          </Txt>
        ))}
        <Notice text="Your administrator records attendance. Checking in and out from the app is not available yet." />
      </Card>

      <View className="flex-row items-center gap-2">
        <RoundButton icon="chevron-left" label="Previous month" onPress={() => setMonth(shiftMonth(month, -1))} className="rounded-lg bg-white" />
        <Text accessibilityRole="header" className="flex-1 text-center font-in-bd text-[16px] leading-6 text-[#191c1e]">
          {monthLabel(month)}
        </Text>
        {month < today.slice(0, 7) ? <RoundButton icon="chevron-right" label="Next month" onPress={() => setMonth(shiftMonth(month, 1))} className="rounded-lg bg-white" /> : <View className="size-9" />}
      </View>

      {attendance.error && !data ? <ErrorState message={attendance.error.message} onAction={attendance.reload} /> : null}
      {!data && !attendance.error ? <LoadingState label="Loading attendance…" /> : null}
      {data && !data.linked ? <EmptyState title="No staff record" message="Your account is not linked to a staff record, so no attendance is kept for you." /> : null}

      {data?.linked ? (
        <>
          <View className="flex-row gap-2">
            {SUMMARY.map((status) => (
              <View key={status} className="flex-1 items-center gap-0.5 rounded-lg border border-[#e0e3e5] bg-white py-2.5">
                <View className="flex-row items-center gap-1">
                  <View className="size-2 rounded-full" style={{ backgroundColor: ATTENDANCE[status].color }} />
                  <Txt className="font-in-sb text-[11px]">{ATTENDANCE[status].label}</Txt>
                </View>
                <Txt className="font-in-bd text-[24px] leading-8">{String(data.counts[status])}</Txt>
              </View>
            ))}
          </View>

          <Card className="gap-1 border-[#e0e3e5] p-3.5">
            <CardTitle title="Month View" icon="calendar-month" right="Tap a day" />
            <View className="flex-row border-b border-[#eceef0] py-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((letter, position) => (
                <Txt key={position} className="flex-1 text-center font-in-sb text-[11px] text-[#45464d]">{letter}</Txt>
              ))}
            </View>
            <View className="flex-row flex-wrap">
              {Array.from({ length: leading }, (_, position) => (
                <View key={`blank-${position}`} className="h-10 w-[14.28%]" />
              ))}
              {Array.from({ length: days }, (_, position) => {
                const day = position + 1;
                const date = `${month}-${String(day).padStart(2, '0')}`;
                const record = byDay.get(date)?.[0];
                return (
                  <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${dayLabel(date)}${record ? `, ${ATTENDANCE[record.status].label}` : ', not recorded'}`} onPress={() => setOpenDay(date)} className="h-10 w-[14.28%] p-0.5">
                    <View className={cn('flex-1 items-center justify-center rounded-lg', record?.status === 'absent' && 'bg-[#fff1f2]', date === today && 'border-2 border-[#006398] bg-[#cce5ff]/50')}>
                      <Txt className={cn('leading-[15px]', date > today && 'text-[#76777d]')}>{String(day)}</Txt>
                      <View className="size-1.5 rounded-full" style={{ backgroundColor: record ? ATTENDANCE[record.status].color : '#e0e3e5' }} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Card>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 grow-0" contentContainerClassName="gap-2 px-4">
            {[{ value: 'all' as const, label: `All (${records.length})` }, ...SUMMARY.map((status) => ({ value: status, label: `${ATTENDANCE[status].label} (${data.counts[status]})` }))].map((item) => (
              <Pressable key={item.value} accessibilityRole="button" accessibilityState={{ selected: filter === item.value }} onPress={() => setFilter(item.value)} className={cn('rounded-full border px-3 py-1.5', filter === item.value ? 'border-black bg-black' : 'border-[#c6c6cd] bg-white')}>
                <Text className={cn('font-in-sb text-[11px] leading-4', filter === item.value ? 'text-white' : 'text-[#45464d]')}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View className="gap-2">
            <CardTitle title="Records" className="px-0.5" />
            {shown.length === 0 ? <EmptyState title="No records" message={records.length ? 'Nothing matches this filter.' : `Nothing is recorded for ${monthLabel(month)}.`} /> : null}
            {shown.map((record) => (
              <Pressable key={record.id} accessibilityRole="button" onPress={() => setOpenDay(record.date)} className="flex-row items-center gap-3 rounded-xl border border-[#e0e3e5] bg-white p-3">
                <View className="w-10 items-center">
                  <Txt className="font-in-bd text-[18px] leading-6">{record.date.slice(8)}</Txt>
                  <Txt className="text-[11px] text-[#76777d]">{weekdayOf(record.date)}</Txt>
                </View>
                <View className="flex-1 gap-1">
                  <Pill label={ATTENDANCE[record.status].label} tone={ATTENDANCE[record.status].tone} />
                  <Txt className="text-[#45464d]">
                    {record.time ? `Arrived ${clock(record.time)} · ` : ''}
                    {record.branch.name}
                  </Txt>
                </View>
                <Glyph name="chevron-right" size={16} color="#76777d" />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Sheet visible={!!openDay} onClose={() => setOpenDay(null)} title={openDay ? dayLabel(openDay, true) : ''}>
        {dayRecords.length === 0 ? <Txt className="pb-3 text-[13px]">Nothing is recorded for this day.</Txt> : null}
        {dayRecords.map((record) => (
          <View key={record.id} className="gap-2 pb-3">
            <Line label="Status" value={ATTENDANCE[record.status].label} />
            {record.time ? <Line label="Arrived" value={clock(record.time)} /> : null}
            <Line label="Branch" value={record.branch.name} />
            <Line label="Recorded by" value={record.recordedBy} />
            {record.note ? <Line label="Note" value={record.note} /> : null}
            {record.corrections.map((entry) => (
              <Txt key={entry.id} className="text-[#45464d]">
                Corrected by {entry.by}: {ATTENDANCE[entry.fromStatus].label} → {ATTENDANCE[entry.toStatus].label}. {entry.reason}
              </Txt>
            ))}
          </View>
        ))}
        <Txt className="text-[#45464d]">If a record is wrong, ask your administrator to correct it.</Txt>
      </Sheet>
    </MeScreen>
  );
}
