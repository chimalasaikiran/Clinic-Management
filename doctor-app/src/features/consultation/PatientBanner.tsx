import { View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useActiveEncounter } from '@/features/doctor/clinical';
import { ageSex, initialsOf, localToday } from '@/features/reception/desk';
import { cn } from '@/lib/cn';

const small = 'font-pj-md text-[12px] leading-[18px] text-[#cbd5e1]';

/** Who is being seen, with their recorded allergies and the main active problem kept in view. */
export function PatientBanner({ framed }: { framed?: boolean }) {
  const { encounter, patient, chart } = useActiveEncounter();
  const person = patient.data;
  const visit = encounter.data;
  if (!person || !visit) return null;

  const allergies = (chart.data?.allergies ?? []).filter((allergy) => allergy.active);
  const problem = (chart.data?.diagnoses ?? []).find((diagnosis) => diagnosis.status === 'active' && diagnosis.designation === 'Primary');
  const facts = [ageSex(person, localToday()), person.bloodGroup].filter(Boolean).join(' · ');
  const label = [
    `${person.fullName}, ${facts}`,
    allergies.length ? `Allergies: ${allergies.map((allergy) => `${allergy.substance}, ${allergy.severity}`).join('; ')}` : 'No allergies recorded',
    problem ? `Active problem: ${problem.name}` : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View accessible accessibilityLabel={label} className={cn(framed && 'rounded-2xl border border-[#1e3c49]/80 bg-[#0f232b] pt-[22px]')}>
      <View className="gap-3 overflow-hidden rounded-2xl bg-heading p-4 shadow-md">
        <View className="absolute -right-10 -top-10 size-40 rounded-full bg-teal/25" />
        <View className="flex-row gap-3">
          <View className="h-12 w-[42px] items-center justify-center rounded-xl border border-[#2dd4bf]/30 bg-teal">
            <Text className="font-pj-bd text-[18px] leading-[27px] text-white">{initialsOf(person.fullName)}</Text>
          </View>
          <View className="flex-1 gap-0.5">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text className="font-pj-bd text-[17px] leading-[26px] tracking-[-0.4px] text-white">{person.fullName}</Text>
              <View className="rounded-md bg-white/10 px-2 py-0.5">
                <Text className="font-pj-sb text-[11px] leading-[17px] text-[#99f6e4]">{facts}</Text>
              </View>
            </View>
            <Text className={cn(small, 'shrink')}>
              {person.mrn}
              {person.abhaNumber ? ` • ABHA: ${person.abhaNumber}` : ''}
            </Text>
          </View>
        </View>
        <View className="flex-row items-center justify-between gap-2 border-t border-white/10 pt-2.5">
          <View className="flex-1 flex-row items-center gap-1.5">
            <Icon name="ban-doctor" />
            <Text className={cn(small, 'shrink')}>{visit.practitioner?.displayName ?? visit.startedBy}</Text>
          </View>
          <View className="max-w-[50%] rounded bg-white/5 px-2 py-0.5">
            <Text numberOfLines={1} className="text-[11px] leading-[17px] text-[#99f6e4]">
              {visit.reference} · {visit.type}
            </Text>
          </View>
        </View>
        <View className="gap-2">
          {allergies.length ? (
            allergies.map((allergy) => (
              <View key={allergy.id} className="flex-row items-center gap-2 rounded-xl border border-[#ef4444]/30 bg-[#450a0a]/60 px-2.5 py-1.5">
                <Icon name="ban-allergy" />
                <Text className="flex-1 text-[12px] leading-[18px] text-[#fecaca]">
                  <Text className="font-pj-bd text-[12px] text-[#fca5a5]">Allergy:</Text> {allergy.substance} ({allergy.reaction}, {allergy.severity})
                </Text>
              </View>
            ))
          ) : (
            <View className="flex-row items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5">
              <Icon name="ban-allergy" />
              <Text className="flex-1 text-[12px] leading-[18px] text-[#cbd5e1]">No allergies recorded</Text>
            </View>
          )}
          {problem ? (
            <View className="flex-row items-center gap-2 rounded-xl border border-[#f59e0b]/30 bg-[#451a03]/50 px-2.5 py-1.5">
              <Icon name="ban-pulse" />
              <Text className="flex-1 text-[12px] leading-[18px] text-[#fde68a]">
                <Text className="font-pj-bd text-[12px] text-[#fcd34d]">Active problem:</Text> {problem.name} ({problem.icd})
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
