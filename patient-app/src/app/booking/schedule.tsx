import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TextField } from '@/components/form/TextField';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Sheet } from '@/components/ui/Sheet';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { BookingHeader } from '@/features/booking/BookingHeader';
import { Calendar } from '@/features/booking/Calendar';
import { QuickDates } from '@/features/booking/QuickDates';
import { SlotPicker } from '@/features/booking/SlotPicker';
import { useResource } from '@/hooks/useResource';
import { ApiError, errorMessage } from '@/lib/api';
import { dayMonth, fullDay, weekday } from '@/lib/dates';
import { clock, rupees } from '@/lib/visit';
import { useBooking } from '@/state/BookingState';
import { useSession } from '@/state/SessionState';
import type { Appointment, ClinicDetail, Slots } from '@/types';

export default function SelectDateTime() {
  const { branchId, serviceId, date, setDate, time, setTime } = useBooking();
  const { call } = useSession();
  const [reviewing, setReviewing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null);
  const clinic = useResource<ClinicDetail>(branchId ? `/v1/patient/clinics/${branchId}` : null, ['app_access']);
  const slots = useResource<Slots>(
    branchId && serviceId ? `/v1/patient/clinics/${branchId}/slots?serviceId=${serviceId}&from=${date}&days=1` : null,
    // Someone else's booking can take a time while this screen is open.
    ['appointments'],
  );

  const service = clinic.data?.services.find((entry) => entry.id === serviceId);
  if (!clinic.data || !service) {
    return (
      <Screen header={<BookingHeader step={2} />}>
        {!branchId || !serviceId || (clinic.data && !service) ? (
          <EmptyState
            title="Choose a service first"
            message="Pick a clinic and a service before choosing a time."
            actionLabel="Find a clinic"
            onAction={() => router.dismissTo('/clinics')}
          />
        ) : clinic.error ? (
          <ErrorState message={clinic.error.message} onAction={clinic.reload} />
        ) : (
          <LoadingState />
        )}
      </Screen>
    );
  }

  const place = clinic.data;
  const fee = rupees(service.fee);
  const open = slots.data?.days[0]?.slots.some((slot) => slot.time === time && slot.available) ?? false;
  const chosen = time && open ? time : null;
  const summary = chosen ? `${weekday(date)}, ${dayMonth(date)} at ${clock(chosen)}` : 'Choose a time slot';
  const record = place.booking;

  const confirm = async () => {
    if (!chosen) return;
    setConfirming(true);
    setFailure(null);
    try {
      const created = await call<Appointment>('/v1/patient/appointments', {
        method: 'POST',
        body: { branchId, serviceId, date, time: chosen, reason: reason.trim() || null },
      });
      setReviewing(false);
      router.replace({ pathname: '/booking/confirmed', params: { id: created.id } });
    } catch (error) {
      setFailure({ code: error instanceof ApiError ? error.code : 'UNKNOWN', message: errorMessage(error) });
      // The time may have just been taken, so show what is open now.
      slots.reload();
      clinic.reload();
    } finally {
      setConfirming(false);
    }
  };

  const goTo = (path: '/profile/edit' | '/security') => {
    setReviewing(false);
    router.push(path);
  };

  return (
    <Screen
      header={<BookingHeader step={2} />}
      footer={
        <View className="gap-2">
          <View className="flex-row justify-between gap-2 border-b border-line/20 pb-2">
            <View className="flex-1 flex-row items-center gap-1.5">
              <Icon name="schedule-clock" />
              <Text className="shrink font-pj-bd text-[13px] leading-[18px] text-ink">{summary}</Text>
            </View>
            <Text className="text-[12px] leading-4 text-slate">Consultation: {fee}</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <View>
              <Text className="text-[11px] leading-[17px] text-slate">Total Amount</Text>
              <Text className="font-pj-bd text-[18px] leading-5 text-ink">{fee}</Text>
              <Text className="text-[10px] leading-[15px] text-slate">Pay at the clinic</Text>
            </View>
            <Button
              label="Continue to Review"
              iconRight="arrow-forward-white"
              className="min-h-[48px] flex-1 rounded-xl"
              textClassName="font-pj-bd"
              disabled={!chosen}
              onPress={() => {
                setFailure(null);
                setReviewing(true);
              }}
            />
          </View>
        </View>
      }
      contentClassName="gap-5 bg-white pt-1 pb-6">
      <View className="gap-1">
        <View className="flex-row items-center gap-2">
          <Icon name="calendar-outline" />
          <Text accessibilityRole="header" className="font-pj-bd text-[18px] leading-6 tracking-[-0.4px] text-ink">
            Select Date & Time
          </Text>
        </View>
        <Text className="text-[14px] leading-5 text-slate">Times are shown in India Standard Time.</Text>
      </View>

      <View className="gap-2.5 rounded-xl border border-line/50 bg-sky-100 p-3.5">
        <View className="flex-row items-center gap-2">
          <View className="size-8 items-center justify-center rounded-lg border border-line/30 bg-white">
            <Icon name="clinic-building" />
          </View>
          <View className="flex-1">
            <Text className="font-pj-bd text-[13px] leading-4 tracking-[0.3px] text-ink">{place.clinicName}</Text>
            <Text className="text-[13px] leading-[18px] text-slate">
              {place.name} · {place.city}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.dismissTo('/clinics')}
            className="rounded-full border border-line/60 bg-white px-2.5 py-1">
            <Text className="font-pj-bd text-[11px] leading-[14px] text-black">Change</Text>
          </Pressable>
        </View>
        <View className="flex-row items-center gap-1.5 border-t border-line/30 pt-2.5">
          <Icon name="stethoscope" />
          <Text className="flex-1 text-[13px] leading-[18px] text-slate">
            <Text className="font-pj-bd text-[13px] text-ink">{service.name}</Text> · {service.department}
          </Text>
          <Text className="font-pj-bd text-[13px] leading-[18px] text-ink">{fee}</Text>
        </View>
      </View>

      <View className="gap-2">
        <Text className="font-pj-bd text-[13px] leading-[18px] tracking-[0.3px] text-slate">Quick Select</Text>
        <QuickDates selected={date} onSelect={setDate} />
      </View>

      {/* Remount when a quick date changes month, so the grid follows it. */}
      <Calendar key={date.slice(0, 7)} selected={date} onSelect={setDate} />

      <View className="gap-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-pj-bd text-[15px] leading-5 text-ink">Available Time Slots</Text>
          <Text className="text-[13px] leading-[18px] text-slate">{fullDay(date)}</Text>
        </View>
        <SlotPicker slots={slots} selected={chosen} onSelect={setTime} />
      </View>

      <Sheet visible={reviewing} onClose={() => !confirming && setReviewing(false)} title="Review your booking">
        <View className="gap-2 pb-4">
          {[
            ['Clinic', `${place.clinicName}, ${place.name}`],
            ['Service', service.name],
            ['When', chosen ? `${fullDay(date)} · ${clock(chosen)}` : 'That time is no longer open'],
            ['Consultation fee', `${fee}${service.gstRate > 0 ? ` + ${service.gstRate}% GST` : ''}, paid at the clinic`],
            ...(record.status === 'linked' || record.status === 'new_record' ? [['Patient', record.patientName]] : []),
          ].map(([name, value]) => (
            <View key={name} className="flex-row justify-between gap-4 border-b border-line/30 pb-2">
              <Text className="text-[13px] leading-5 text-slate">{name}</Text>
              <Text className="flex-1 text-right font-pj-sb text-[13px] leading-5 text-ink">{value}</Text>
            </View>
          ))}
          {record.status === 'new_record' ? (
            <Text className="text-[12px] leading-[18px] text-slate">
              Booking registers you at this clinic and shares your name, mobile, date of birth, gender and address with it.
            </Text>
          ) : null}
          <TextField
            label="Reason for visit"
            optionalLabel
            placeholder="What would you like to see the clinic about?"
            value={reason}
            onChangeText={setReason}
            maxLength={500}
            multiline
            inputClassName="min-h-[56px] text-[13px]"
          />
        </View>

        {record.status === 'profile_incomplete' ? (
          <View className="gap-2 pb-3">
            <Text className="text-[13px] leading-[18px] text-ink">
              Add your {record.missing.join(', ')} before booking here. The clinic needs them to register you.
            </Text>
            <Button label="Complete my profile" onPress={() => goTo('/profile/edit')} />
          </View>
        ) : record.status === 'code_required' ? (
          <View className="gap-2 pb-3">
            <Text className="text-[13px] leading-[18px] text-ink">
              This clinic may already have a record for you. Ask its reception desk for a connection code, then enter it.
            </Text>
            <Button label="Enter a connection code" onPress={() => goTo('/security')} />
          </View>
        ) : (
          <View className="gap-2">
            {failure ? (
              <Text accessibilityRole="alert" className="text-[13px] leading-[18px] text-[#ba1a1a]">
                {failure.message}
              </Text>
            ) : null}
            <Button label="Confirm Appointment" loading={confirming} disabled={!chosen} onPress={confirm} />
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
