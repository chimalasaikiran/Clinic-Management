import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { months } from '@/data/patient';
import { cn } from '@/lib/cn';
import { addDays, monthGrid, parseDay } from '@/lib/dates';
import { clinicToday } from '@/lib/visit';

/** How far ahead the server accepts bookings. */
const BOOKING_WINDOW_DAYS = 180;

/** Whether a day can be picked. Which times are open on it comes from the clinic's schedule. */
const isBookable = (iso: string) => iso >= clinicToday() && iso <= addDays(clinicToday(), BOOKING_WINDOW_DAYS);

type Props = {
  selected: string;
  onSelect: (iso: string) => void;
  /** The date of an existing visit, marked when rescheduling. */
  current?: string;
};

export function Calendar({ selected, onSelect, current }: Props) {
  const start = parseDay(selected);
  const [view, setView] = useState({ year: start.getFullYear(), month: start.getMonth() });
  const firstMonth = clinicToday().slice(0, 7);
  const lastMonth = addDays(clinicToday(), BOOKING_WINDOW_DAYS).slice(0, 7);
  const viewKey = `${view.year}-${String(view.month + 1).padStart(2, '0')}`;

  const move = (step: number) => {
    const next = new Date(view.year, view.month + step, 1);
    setView({ year: next.getFullYear(), month: next.getMonth() });
  };

  const arrow = (step: -1 | 1, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={step < 0 ? 'Previous month' : 'Next month'}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => move(step)}
      className={cn('size-6 items-center justify-center', disabled && 'opacity-30')}>
      <View className={step < 0 ? 'rotate-180' : undefined}>
        <Icon name="chevron-right-slate" />
      </View>
    </Pressable>
  );

  return (
    <View className="gap-2 rounded-xl border border-line/40 bg-white p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Text className="font-pj-bd text-[15px] leading-5 text-ink">
            {months[view.month]} {view.year}
          </Text>
          <View className="rounded bg-sky-150 px-2 py-0.5">
            <Text className="text-[11px] leading-4 text-slate">IST (UTC+5:30)</Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          {arrow(-1, viewKey <= firstMonth)}
          {arrow(1, viewKey >= lastMonth)}
        </View>
      </View>
      <View className="flex-row pt-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <Text
            key={day}
            className={cn(
              'flex-1 text-center font-pj-bd text-[11px] leading-[14px]',
              'text-slate',
            )}>
            {day}
          </Text>
        ))}
      </View>
      {monthGrid(view.year, view.month).map((week, row) => (
        <View key={row} className="flex-row">
          {week.map((iso, column) => {
            if (!iso) return <View key={column} className="flex-1" />;
            const bookable = isBookable(iso);
            const active = iso === selected;
            return (
              <Pressable
                key={iso}
                accessibilityRole="button"
                accessibilityLabel={iso}
                accessibilityState={{ selected: active, disabled: !bookable }}
                disabled={!bookable}
                onPress={() => onSelect(iso)}
                className={cn(
                  'h-11 flex-1 items-center justify-center rounded-lg',
                  active && 'bg-black',
                  iso === current && !active && 'border border-teal bg-teal-50',
                )}>
                <Text
                  className={cn(
                    'font-pj-md text-[13px] leading-[18px]',
                    active ? 'font-pj-bd text-white' : bookable ? 'text-ink' : 'text-line',
                  )}>
                  {Number(iso.slice(8))}
                </Text>
                <View
                  className={cn(
                    'mt-0.5 size-1 rounded-full',
                    bookable && (active ? 'bg-mint' : 'bg-teal-200'),
                  )}
                />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
