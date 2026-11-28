import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Select } from '@/components/form/Select';
import { AppHeader, IconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { useToast } from '@/components/ui/Toast';
import { recordCard, recordKicker, recordMeta, recordTitle } from '@/features/health/RecordKit';
import { cn } from '@/lib/cn';

type Preference = {
  id: string;
  title: string;
  body: string;
  tag?: string;
  channels?: string[];
  mandatory?: boolean;
};

const channels: Preference[] = [
  { id: 'push', title: 'Push Notifications', tag: 'Enabled', body: 'Instant alerts on this device · System permission granted' },
  { id: 'whatsapp', title: 'WhatsApp Alerts', tag: 'Verified', body: 'Encrypted health updates & PDF passes · +91 98765 43210' },
  { id: 'sms', title: 'SMS Gateway', tag: 'DLT Reg.', body: 'Critical appointment reminders & OTP codes' },
  { id: 'email', title: 'Email Summary', tag: 'Optional', body: 'Monthly health digest & tax-compliant statements' },
];

const categories: { title: string; items: Preference[] }[] = [
  {
    title: 'Appointments',
    items: [
      { id: 'confirmations', title: 'Appointment Confirmations', body: 'Dispatch to:', channels: ['Push', 'WhatsApp'] },
      { id: 'reminders', title: 'Upcoming Visit Reminders', body: 'Dispatch to:', channels: ['Push', 'WhatsApp', 'SMS'] },
      { id: 'changes', title: 'Reschedule & Cancellation Notices', body: 'Clinical safety alert delivered via all active channels', tag: 'Mandatory', mandatory: true },
    ],
  },
  {
    title: 'Health Updates & Clinical Vault',
    items: [
      { id: 'reports', title: 'New Lab Reports & Scans', body: 'Alert when certified by Dr. Siddharth Verma', channels: ['Push', 'WhatsApp PDF'] },
      { id: 'prescriptions', title: 'Prescription Updates & Refills', body: 'Dosage adjustments and automated refill countdowns' },
      { id: 'carePlans', title: 'Care Plan Milestones & Follow-ups', body: 'Cardiovascular telemetry & protocol review reminders' },
      { id: 'signed', title: 'Cryptographic Document Signed', body: 'ABDM electronic certificate stamped by clinic registry' },
    ],
  },
  {
    title: 'Clinic Operational Notices',
    items: [
      { id: 'holidays', title: 'Holiday Schedules & Chamber Advisories', body: 'Doctor leave notices & seasonal triage timings' },
      { id: 'drives', title: 'Preventive Health & Vaccination Drives', body: 'Optional community health initiatives and camps' },
      { id: 'tips', title: 'Educational Health Tips', body: 'Monthly lifestyle & wellness guidance articles' },
    ],
  },
];

const leadTimes = ['24h Before', '2h Before'];

const quietOptions = [
  { value: '22-07', label: '10:00 PM – 07:00 AM' },
  { value: '23-07', label: '11:00 PM – 07:00 AM' },
  { value: '21-06', label: '09:00 PM – 06:00 AM' },
];

const defaults = {
  enabled: {
    push: true, whatsapp: true, sms: true, email: false, confirmations: true, reminders: true,
    changes: true, reports: true, prescriptions: true, carePlans: true, signed: true,
    holidays: true, drives: false, tips: false, quiet: true,
  } as Record<string, boolean>,
  leads: leadTimes,
  quietHours: '22-07',
};

export default function NotificationPreferences() {
  const toast = useToast();
  const [saved, setSaved] = useState(defaults);
  const [draft, setDraft] = useState(defaults);
  const [saving, setSaving] = useState(false);
  const changed = JSON.stringify(draft) !== JSON.stringify(saved);
  const activeChannels = channels.filter((item) => draft.enabled[item.id]).length;

  const toggle = (id: string, value: boolean) =>
    setDraft({ ...draft, enabled: { ...draft.enabled, [id]: value } });

  const save = () => {
    setSaving(true);
    // Stands in for the request that stores the preferences.
    setTimeout(() => {
      setSaved(draft);
      setSaving(false);
      toast('Notification preferences saved.');
    }, 600);
  };

  const row = (item: Preference, index: number) => (
    <View
      key={item.id}
      className={cn('flex-row gap-3', index > 0 && 'border-t border-edge/60 pt-3')}>
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Text className="shrink font-pj-bd text-[14px] leading-5 text-heading">{item.title}</Text>
          {item.tag ? <Pill label={item.tag} tone={item.mandatory ? 'amber' : 'mint'} /> : null}
        </View>
        <Text className={recordMeta}>{item.body}</Text>
        {item.channels ? (
          <View className="flex-row flex-wrap gap-1.5">
            {item.channels.map((channel) => (
              <Pill key={channel} label={channel} tone="sky" />
            ))}
          </View>
        ) : null}
        {item.id === 'reminders' && draft.enabled.reminders ? (
          <View className="gap-1.5 rounded-xl bg-[#f4f7f6] p-2.5">
            <Text className={recordKicker}>LEAD TIME TRIGGERS</Text>
            <View className="flex-row gap-1.5">
              {leadTimes.map((lead) => {
                const active = draft.leads.includes(lead);
                return (
                  <Pressable
                    key={lead}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    onPress={() =>
                      setDraft({
                        ...draft,
                        leads: active
                          ? draft.leads.filter((value) => value !== lead)
                          : leadTimes.filter((value) => value === lead || draft.leads.includes(value)),
                      })
                    }
                    className={cn(
                      'rounded-full border px-3 py-1',
                      active ? 'border-black bg-black' : 'border-edge bg-white',
                    )}>
                    <Text
                      className={cn(
                        'font-pj-sb text-[11px] leading-4',
                        active ? 'text-white' : 'text-[#566b74]',
                      )}>
                      {lead}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </View>
      <Toggle
        label={item.title}
        value={draft.enabled[item.id]}
        disabled={item.mandatory}
        onValueChange={(value) => toggle(item.id, value)}
      />
    </View>
  );

  return (
    <Screen
      inTabs
      className="bg-[#f4f7f6]"
      header={
        <AppHeader
          title="Notification Preferences"
          right={
            <IconButton
              icon="info"
              label="About notification preferences"
              onPress={() => toast('Safety alerts stay on for every patient.')}
            />
          }
        />
      }
      footer={
        <View className="gap-1.5">
          <View className="flex-row gap-2.5">
            <Button
              label="Save Preferences"
              className="flex-1"
              disabled={!changed}
              loading={saving}
              onPress={save}
            />
            <Button
              label="Reset"
              variant="soft"
              onPress={() => setDraft(defaults)}
            />
          </View>
          <Text className="text-center text-[11px] leading-4 text-[#566b74]">
            {changed ? 'You have unsaved changes' : 'All preferences synchronized with ABDM gateway'}
          </Text>
        </View>
      }
      contentClassName="gap-3.5 pt-3 pb-6">
      <View className="gap-1.5 rounded-[20px] border border-teal-200 bg-teal-100 p-4">
        <View className="flex-row items-center justify-between gap-2">
          <Text className={recordTitle}>Mandatory Statutory Alerts</Text>
          <Pill label="DISHA V2" tone="plain" />
        </View>
        <Text className={recordMeta}>
          Critical clinical alerts (prescribed medication recalls, emergency reschedule notices, and
          statutory ABHA cryptographic authorizations) are mandatory and sent via verified
          SMS/WhatsApp for patient safety.
        </Text>
      </View>

      <View className="flex-row items-end justify-between gap-2">
        <View className="flex-1">
          <Text className={recordTitle}>Delivery Channels</Text>
          <Text className={recordMeta}>Gateway endpoints authorized for patient device</Text>
        </View>
        <Text className="font-pj-sb text-[11px] leading-4 text-teal">
          {activeChannels} of {channels.length} active
        </Text>
      </View>
      <View className={recordCard}>{channels.map(row)}</View>

      <View>
        <Text className={recordTitle}>Category Matrix</Text>
        <Text className={recordMeta}>Fine-grained delivery controls per health domain</Text>
      </View>
      {categories.map((category) => (
        <View key={category.title} className={recordCard}>
          <View className="flex-row justify-between gap-2">
            <Text className="flex-1 font-pj-bd text-[13px] leading-[18px] text-teal">
              {category.title}
            </Text>
            <Text className="text-[11px] leading-4 text-[#566b74]">
              {category.items.length} Controls
            </Text>
          </View>
          {category.items.map(row)}
        </View>
      ))}

      <View className={recordCard}>
        {row(
          { id: 'quiet', title: 'Quiet Hours for Routine Alerts', body: 'Mute non-urgent reminders during sleep' },
          0,
        )}
        {draft.enabled.quiet ? (
          <Select
            label="Quiet window"
            value={draft.quietHours}
            options={quietOptions}
            onChange={(quietHours) => setDraft({ ...draft, quietHours })}
          />
        ) : null}
        <Text className="text-[12px] leading-[18px] text-[#566b74]">
          Emergency reschedule and urgent doctor callbacks automatically override quiet hours for
          patient safety.
        </Text>
      </View>

      <View className="gap-1 rounded-[20px] border border-edge bg-white p-4">
        <Text className={recordKicker}>FACILITY BOUNDARY ISOLATION · Aura Health · Pune</Text>
        <Text className={recordMeta}>
          Preferences configured on this screen apply strictly to Aura Health & Specialty Clinic
          (Chambers 101–104). If you consult with secondary specialists at other ClinicOS network
          facilities, their notification conduits remain sovereignly isolated.
        </Text>
      </View>
    </Screen>
  );
}
