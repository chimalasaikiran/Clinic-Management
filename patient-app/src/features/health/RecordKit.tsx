import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/cn';

/** Shared building blocks of the health record screens. */

export const recordCard = 'gap-3 rounded-[20px] border border-edge bg-white p-4';
export const recordTitle = 'font-pj-bd text-[16px] leading-6 text-heading';
export const recordMeta = 'text-[13px] leading-[18px] text-[#566b74]';
export const recordKicker = 'font-pj-bd text-[11px] leading-4 tracking-[0.3px] text-[#566b74]';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

/** Whose record this is: the name and patient number the clinic holds. */
export function PatientStrip({ name, detail, badge }: { name: string; detail: string; badge?: string }) {
  return (
    <View className="flex-row items-center gap-2.5 rounded-[18px] border border-edge bg-white p-3">
      <View className="size-10 items-center justify-center rounded-full border border-teal-200 bg-teal-100">
        <Text className="font-pj-bd text-[14px] leading-5 text-teal">{initials(name)}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-pj-sb text-[14px] leading-5 text-heading">{name}</Text>
        <Text className={recordMeta}>{detail}</Text>
      </View>
      {badge ? <Pill label={badge} /> : null}
    </View>
  );
}

/** The clinic a record comes from. */
export function ClinicContext({ clinicName, branchName, note }: { clinicName: string; branchName?: string; note?: string }) {
  return (
    <View className="gap-3 rounded-[18px] border border-teal-200 bg-white p-3.5">
      <View className="flex-row items-center gap-2.5">
        <View className="size-9 items-center justify-center rounded-xl bg-teal-100">
          <Icon name="clinic-context" color="#006a61" />
        </View>
        <View className="flex-1">
          <Text className="font-pj-bd text-[11px] leading-4 text-teal">ISSUED BY</Text>
          <Text className={recordTitle}>{clinicName}</Text>
          {branchName ? <Text className={recordMeta}>{branchName}</Text> : null}
        </View>
      </View>
      {note ? (
        <View className="flex-row gap-2 border-t border-edge/60 pt-2.5">
          <Icon name="lock-teal-sm" />
          <Text className="flex-1 text-[12px] leading-[18px] text-[#566b74]">{note}</Text>
        </View>
      ) : null}
    </View>
  );
}

type Stat = { label: string; value: string; caption: string; highlight?: boolean };

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <View className="flex-row gap-2">
      {stats.map((stat) => (
        <View
          key={stat.label}
          accessible
          accessibilityLabel={`${stat.label}: ${stat.value}, ${stat.caption}`}
          className="flex-1 gap-0.5 rounded-[18px] border border-edge bg-white p-2.5">
          <Text className="text-[11px] leading-4 text-[#566b74]">{stat.label}</Text>
          <Text className={cn('font-pj-bd text-[18px] leading-6', stat.highlight ? 'text-teal' : 'text-heading')}>{stat.value}</Text>
          <Text className="font-pj-md text-[11px] leading-4 text-[#566b74]">{stat.caption}</Text>
        </View>
      ))}
    </View>
  );
}

/** The note explaining who may change these records. */
export function RecordNotice({ title, body }: { title: string; body: string }) {
  return (
    <View className="gap-2 rounded-[18px] border border-edge bg-white p-4">
      <View className="flex-row gap-2.5">
        <Icon name="verified-user" color="#006a61" />
        <View className="flex-1 gap-1">
          <Text className="font-pj-bd text-[13px] leading-[18px] text-heading">{title}</Text>
          <Text className={recordMeta}>{body}</Text>
        </View>
      </View>
    </View>
  );
}

/** A labelled value, used in two-column detail grids. */
export function Field({ label, value, note, className }: { label: string; value: string; note?: string; className?: string }) {
  return (
    <View className={cn('flex-1 gap-0.5', className)}>
      <Text className="font-pj-sb text-[10px] leading-[15px] tracking-[0.4px] text-[#566b74]">{label}</Text>
      <Text className="font-pj-sb text-[13px] leading-[18px] text-heading">{value}</Text>
      {note ? <Text className="text-[11px] leading-4 text-[#566b74]">{note}</Text> : null}
    </View>
  );
}

/** A label on the left and its value on the right. */
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-3">
      <Text className={recordMeta}>{label}</Text>
      <Text className="flex-1 text-right font-pj-sb text-[13px] leading-[18px] text-heading">{value}</Text>
    </View>
  );
}

/** A full-width "open this record" row at the bottom of a card. */
export function CardLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      className="flex-row items-center justify-between gap-2 rounded-xl bg-[#f4f7f6] px-3 py-2.5 active:opacity-70">
      <Text className="flex-1 font-pj-sb text-[13px] leading-[18px] text-heading">{label}</Text>
      <Icon name="arrow-forward-ink" size={11} />
    </Pressable>
  );
}

export function IconTile({ children }: { children: ReactNode }) {
  return <View className="size-10 items-center justify-center rounded-xl bg-sky-150">{children}</View>;
}
