import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Share, View } from 'react-native';

import { AppHeader, IconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { useResource } from '@/hooks/useResource';
import { errorMessage } from '@/lib/api';
import { fullDay } from '@/lib/dates';
import { addressText, clock, directionsUrl, rupees } from '@/lib/visit';
import { useBooking } from '@/state/BookingState';
import { useSession } from '@/state/SessionState';
import type { ClinicDetail, ClinicService } from '@/types';

const sectionTitle = 'font-pj-sb text-[18px] leading-6 tracking-[-0.18px] text-ink';
const section = 'gap-2.5 border-t border-line/30 pt-5';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Monday first, as the week is usually read.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export default function ClinicDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const { call } = useSession();
  const { start } = useBooking();
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const resource = useResource<ClinicDetail>(`/v1/patient/clinics/${encodeURIComponent(id)}`, ['app_access']);
  const clinic = resource.data;

  if (!clinic) {
    const missing = resource.error?.code === 'NOT_FOUND' || resource.error?.code === 'VALIDATION_FAILED';
    return (
      <Screen header={<AppHeader title="Clinic Details" />}>
        {resource.error ? (
          <ErrorState
            title={missing ? 'Clinic not found' : 'Could not load this clinic'}
            message={missing ? 'This clinic is no longer listed.' : resource.error.message}
            actionLabel={missing ? 'Back to clinics' : 'Try again'}
            onAction={missing ? () => router.replace('/clinics') : resource.reload}
          />
        ) : (
          <LoadingState label="Loading clinic…" />
        )}
      </Screen>
    );
  }

  const bookable = clinic.services.length > 0;
  const openLink = (url: string) => Linking.openURL(url).catch(() => toast('This device cannot open that link.'));
  const book = (serviceId?: string) => {
    start(clinic.id, serviceId);
    router.push('/booking/service');
  };
  const toggleSaved = async () => {
    setSaving(true);
    try {
      await call(`/v1/patient/clinics/${clinic.id}/saved`, { method: clinic.saved ? 'DELETE' : 'PUT' });
      toast(clinic.saved ? 'Removed from saved clinics.' : 'Clinic saved.');
      resource.reload();
    } catch (error) {
      toast(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const serviceRow = (service: ClinicService) => (
    <Pressable
      key={service.id}
      accessibilityRole="button"
      accessibilityLabel={`${service.name}, ${rupees(service.fee)}`}
      onPress={() => book(service.id)}
      className="flex-row items-center gap-3.5 rounded-2xl border border-line/35 bg-white p-3.5 active:bg-sky-50">
      <View className="size-11 items-center justify-center rounded-2xl border border-line/30 bg-sky-50">
        <Icon name="dept-medicine" />
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-pj-bd text-[15px] leading-[23px] text-ink">{service.name}</Text>
        <Text numberOfLines={1} className="text-[12px] leading-[18px] text-slate">
          {service.description || service.department}
        </Text>
        <View className="flex-row flex-wrap items-center gap-2.5 pt-1.5">
          <View className="flex-row items-center gap-1">
            <Icon name="schedule-clock" />
            <Text className="font-pj-md text-[12px] leading-[18px] text-ink">{service.slotMinutes} min</Text>
          </View>
          <View className="rounded-md bg-sky-200 px-2 py-0.5">
            <Text className="font-pj-bd text-[12px] leading-[18px] text-ink">
              {rupees(service.fee)}
              {service.gstRate > 0 ? ` + ${service.gstRate}% GST` : ''}
            </Text>
          </View>
        </View>
      </View>
      <Icon name="chevron-right-slate" />
    </Pressable>
  );

  return (
    <Screen
      header={
        <AppHeader
          title="Clinic Details"
          right={
            <>
              <IconButton
                icon="bookmark"
                label={clinic.saved ? 'Remove saved clinic' : 'Save clinic'}
                color={clinic.saved ? '#006a61' : undefined}
                onPress={() => !saving && toggleSaved()}
              />
              <IconButton
                icon="share"
                label="Share clinic"
                onPress={() => Share.share({ message: `${clinic.clinicName}, ${clinic.name} · ${addressText(clinic)}` })}
              />
            </>
          }
        />
      }
      footer={
        <View className="gap-2">
          <Button label="Continue to Services & Booking" iconRight="arrow-forward-white" disabled={!bookable} onPress={() => book()} />
          {!bookable ? (
            <Text className="text-center text-[11px] leading-4 text-slate">
              Online booking is not open for this clinic. Call the reception desk to book.
            </Text>
          ) : null}
        </View>
      }
      contentClassName="gap-5">
      <View className="gap-2.5">
        <View className="gap-1">
          <Text className="font-pj-bd text-[16px] leading-6 tracking-[-0.4px] text-ink">{clinic.clinicName}</Text>
          <Text className="text-[14px] leading-5 text-slate">
            {[clinic.name, clinic.facilityType].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Icon name="pin-ink" />
          <Text className="flex-1 text-[14px] leading-5 text-slate">{addressText(clinic)}</Text>
        </View>
        {clinic.connected ? (
          <View className="flex-row gap-3 rounded-xl border border-[#a8cec6]/60 bg-sky-100 p-3.5">
            <View className="size-8 items-center justify-center rounded-lg border border-line/30 bg-white">
              <Icon name="link-teal" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="font-pj-sb text-[13px] leading-4 tracking-[0.26px] text-ink">Connected to your account</Text>
              <Text className="text-[13px] leading-[18px] text-slate">Bookings go on your record at this clinic.</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View className={section}>
        <View className="flex-row items-center justify-between gap-2">
          <Text className={sectionTitle}>Services & Departments</Text>
          {clinic.services.length > 4 ? (
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setShowAll(!showAll)}>
              <Text className="font-pj-sb text-[13px] leading-4 text-ink">{showAll ? 'Show less' : 'View all →'}</Text>
            </Pressable>
          ) : null}
        </View>
        {bookable ? (
          <>
            <View className="flex-row gap-2.5 rounded-xl border border-line/40 bg-sky-100 p-3">
              <Icon name="info-notice" />
              <Text className="flex-1 text-[13px] leading-[18px] text-slate">
                <Text className="font-pj-bd text-[13px] text-ink">No doctor selection needed:</Text> you choose a service and a
                time, and are given a free specialist for it.
              </Text>
            </View>
            {clinic.services.slice(0, showAll ? undefined : 4).map(serviceRow)}
          </>
        ) : (
          <Text className="text-[13px] leading-[18px] text-slate">This clinic has no services open for online booking yet.</Text>
        )}
      </View>

      {clinic.hours.length ? (
        <View className={section}>
          <Text className={sectionTitle}>Operating Hours</Text>
          <View className="gap-2.5 rounded-xl border border-line/40 bg-sky-50 p-3.5">
            {WEEK.map((weekday) => {
              const sessions = clinic.hours.filter((entry) => entry.weekday === weekday);
              return (
                <View key={weekday} className="flex-row justify-between gap-3">
                  <Text className="font-pj-md text-[14px] leading-5 text-ink">{DAYS[weekday]}</Text>
                  <Text className="shrink text-right font-pj-sb text-[13px] leading-5 text-slate">
                    {sessions.length ? sessions.map((entry) => `${clock(entry.start)} – ${clock(entry.end)}`).join(', ') : 'Closed'}
                  </Text>
                </View>
              );
            })}
          </View>
          {clinic.closures.map((closure) => (
            <Text key={closure.date} className="text-[12px] leading-[18px] text-[#93000a]">
              {fullDay(closure.date)}: {closure.kind === 'closed' ? 'Closed' : 'Changed hours'} · {closure.reason}
            </Text>
          ))}
        </View>
      ) : null}

      <View className={`${section} pb-6`}>
        <Text className={sectionTitle}>Location & Access</Text>
        <Text className="text-[14px] leading-5 text-slate">{addressText(clinic)}</Text>
        <View className="flex-row gap-2.5">
          <Button
            label="Get Directions"
            iconLeft="pin-ink"
            variant="soft"
            size="md"
            className="min-h-[48px] flex-1 bg-sky-50"
            onPress={() => openLink(directionsUrl(clinic, clinic.clinicName))}
          />
          {clinic.phone ? (
            <Button
              label="Reception Desk"
              iconLeft="call-small"
              variant="soft"
              size="md"
              className="min-h-[48px] flex-1 bg-sky-50"
              onPress={() => openLink(`tel:${clinic.phone}`)}
            />
          ) : null}
        </View>
      </View>
    </Screen>
  );
}
