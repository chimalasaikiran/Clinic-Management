import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { ServiceTile } from '@/features/home/ServiceTile';
import { useList, useResource } from '@/hooks/useResource';
import { fullDay } from '@/lib/dates';
import { clock, doctorLine, relativeDay, STATUS_TEXT } from '@/lib/visit';
import { useAccount } from '@/state/SessionState';
import type { Appointment, ClinicLink, Notice } from '@/types';

const sectionTitle = 'font-pj-bd text-[18px] leading-6 tracking-[-0.18px] text-ink';

const greeting = (hour = new Date().getHours()) => (hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening');

export default function Home() {
  const account = useAccount();
  const links = useResource<ClinicLink[]>('/v1/patient/links', ['app_access']);
  const upcoming = useList<Appointment>('/v1/patient/appointments?scope=upcoming&pageSize=1', ['appointments', 'app_access']);
  const notices = useList<Notice>('/v1/patient/notifications?pageSize=1', ['notifications', 'app_access']);
  const next = upcoming.data?.data[0];
  const count = upcoming.data?.meta.total ?? 0;
  const unread = notices.data?.meta.unread ?? 0;
  const firstName = account?.fullName.split(' ')[0] ?? '';
  const connected = links.data ?? [];

  return (
    <Screen
      inTabs
      contentClassName="gap-5 pt-4 pb-6"
      header={
        <View className="flex-row items-center justify-between border-b border-edge/40 px-5 py-2">
          <View className="flex-1 flex-row items-center gap-3">
            <View className="size-11 items-center justify-center rounded-full border-2 border-teal-200 bg-teal-100">
              <Text className="font-pj-bd text-[15px] leading-5 text-teal">{firstName.slice(0, 1).toUpperCase()}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-[11px] uppercase leading-4 tracking-[0.55px] text-slate">Patient Portal</Text>
              <Text numberOfLines={1} className="font-pj-bd text-[18px] leading-[22px] tracking-[-0.45px] text-ink">
                {greeting()}, {firstName}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            hitSlop={8}
            onPress={() => router.push('/health/notifications')}
            className="p-2">
            <Icon name="bell" />
            {unread ? <View className="absolute right-2 top-2 size-2 rounded-full bg-[#f59e0b]" /> : null}
          </Pressable>
        </View>
      }>
      <LinearGradient
        colors={['#e6f3f1', '#f1f8f6']}
        style={{ borderRadius: 16, borderWidth: 1, borderColor: '#b7ded5', padding: 16, gap: 12 }}>
        <View className="flex-row items-center gap-1.5 border-b border-teal-200/60 pb-3">
          <View className="size-5 items-center justify-center rounded-full bg-teal">
            <Icon name="home-check" />
          </View>
          <Text className="font-pj-bd text-[11px] uppercase leading-[14px] tracking-[0.55px] text-teal">Connected Clinics</Text>
        </View>
        {connected.length ? (
          connected.map((link) => (
            <View key={link.id} className="gap-1">
              <Text className={sectionTitle}>{link.clinicName}</Text>
              <View className="flex-row items-center gap-1">
                <Icon name="pin-teal" />
                <Text className="flex-1 text-[13px] leading-[18px] text-slate">
                  {link.homeBranch.name} · {link.patientName} ({link.mrn})
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text className="text-[13px] leading-[18px] text-slate">
            {links.data
              ? 'No clinic is connected yet. Book a visit, or enter a connection code from your clinic.'
              : links.error
                ? links.error.message
                : 'Checking your clinics…'}
          </Text>
        )}
        <View className="flex-row gap-2 rounded-xl border border-teal-200/50 bg-white/70 p-3">
          <Icon name="lock-teal" />
          <Text className="flex-1 text-[12px] leading-4 text-slate">Each clinic sees only its own record of you.</Text>
        </View>
      </LinearGradient>

      <View className="overflow-hidden rounded-3xl bg-black px-4 pb-4 pt-[18px]">
        <View className="absolute -right-10 -top-11">
          <Icon name="orbit-fill" />
        </View>
        <View className="absolute -right-6 -top-7">
          <Icon name="orbit-line" />
        </View>
        <View className="px-1">
          <Text className="font-pj-bd text-[11px] leading-4 text-[#dfd4fa]">Direct Clinical Booking</Text>
          <Text accessibilityRole="header" className="pt-2 font-pj-bd text-[30px] leading-[34px] tracking-[-0.8px] text-white">
            Book an{'\n'}Appointment
          </Text>
          <Text className="pt-3 text-[12px] leading-[17px] text-[#ded9ea]">
            Choose a clinic, a service and a time. You are given a free specialist.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/clinics')}
          className="mt-4 h-11 flex-row items-center gap-2 rounded-[13px] bg-teal px-4 active:opacity-80">
          <Icon name="calendar-add-white" />
          <Text className="flex-1 font-pj-sb text-[14px] leading-[21px] text-white">Reserve Clinic Slot</Text>
          <Icon name="arrow-right-small-white" />
        </Pressable>
      </View>

      <View>
        <View className="flex-row items-center justify-between">
          <Text className="font-pj-bd text-[20px] leading-7 text-[#292638]">Upcoming Visit</Text>
          {next?.queueToken ? (
            <Text className="font-pj-bd text-[11px] leading-4 text-[#676473]">Token {next.queueToken}</Text>
          ) : null}
        </View>
        {next ? (
          <View className="mt-3 rounded-[22px] bg-white px-4 pb-4 pt-4">
            <View className="flex-row items-start justify-between gap-2">
              <View>
                <Text className="font-pj-bd text-[31px] leading-[38px] tracking-[-1px] text-black">{clock(next.time)}</Text>
                <Text className="font-pj-sb text-[12px] leading-[17px] text-[#676473]">
                  {relativeDay(next.date)}, {fullDay(next.date)}
                </Text>
              </View>
              <View className="shrink rounded-full bg-[#eaf2ea] px-3 py-1">
                <Text className="font-pj-sb text-[11px] leading-4 text-[#26634d]">{STATUS_TEXT[next.status]}</Text>
              </View>
            </View>
            <View className="my-3.5 h-px bg-[#e4e0e8]" />
            <Text className="font-pj-sb text-[19px] leading-[26px] text-[#292638]">
              {next.serviceName ?? next.practitioner.department}
            </Text>
            <Text className="pt-1 text-[12px] leading-[17px] text-[#676473]">{doctorLine(next.practitioner)}</Text>
            <View className="flex-row justify-between gap-2 pt-2.5">
              <Text className="flex-1 font-pj-md text-[12px] leading-[17px] text-[#292638]">
                {next.clinicName} · {next.branch.name}
              </Text>
              {next.practitioner.room ? (
                <Text className="font-pj-sb text-[12px] leading-[17px] text-[#292638]">{next.practitioner.room}</Text>
              ) : null}
            </View>
            <View className="flex-row gap-1 pt-5">
              <Button
                label="View Details"
                iconRight="chevron-right-ink"
                variant="soft"
                size="md"
                className="min-h-[40px] flex-1 border-0 bg-[#ece7f8]"
                onPress={() => router.push(`/appointments/${next.id}`)}
              />
            </View>
          </View>
        ) : (
          <View className="mt-3 rounded-[22px] bg-white px-4 py-4">
            {upcoming.data ? (
              <Text className="text-[13px] leading-[18px] text-[#676473]">You have no upcoming visits.</Text>
            ) : upcoming.error ? (
              <ErrorState message={upcoming.error.message} onAction={upcoming.reload} />
            ) : (
              <LoadingState label="Loading your visits…" />
            )}
          </View>
        )}
      </View>

      <View className="gap-3">
        <Text className="font-pj-bd text-[20px] leading-7 text-[#292638]">Clinic Services</Text>
        <View className="flex-row gap-3">
          <ServiceTile
            icon="service-appointments"
            title="Appointments"
            caption={upcoming.data ? `${count} upcoming · Past visits` : 'Upcoming and past'}
            className="bg-[#ece7f8]"
            dot={count > 0}
            onPress={() => router.push('/appointments')}
          />
          <ServiceTile
            icon="service-records"
            title="Clinic Records"
            caption="Prescriptions & labs"
            className="bg-[#f0e9dd]"
            onPress={() => router.push('/health')}
          />
        </View>
        <View className="flex-row gap-3">
          <ServiceTile
            icon="service-clinics"
            title="Find Clinics"
            caption="Connect external care"
            className="bg-[#e8ecef]"
            onPress={() => router.push('/clinics')}
          />
          <ServiceTile
            icon="service-desk"
            title="Help"
            caption="Support and questions"
            className="bg-[#e8eedc]"
            onPress={() => router.push('/profile/help')}
          />
        </View>
      </View>
    </Screen>
  );
}
