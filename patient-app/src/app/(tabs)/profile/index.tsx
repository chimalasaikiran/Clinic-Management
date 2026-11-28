import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppHeader, IconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Pill } from '@/components/ui/Pill';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import { Avatar } from '@/features/profile/Avatar';
import { LogoutSheet } from '@/features/profile/LogoutSheet';
import { MenuRow } from '@/features/profile/MenuRow';
import { ConnectClinicSheet } from '@/features/profile/ConnectClinicSheet';
import { errorMessage } from '@/lib/api';
import { ageOn, longDate } from '@/lib/dates';
import { formatMobile } from '@/lib/validation';
import { languages, useOnboarding } from '@/state/OnboardingState';
import { useAccount, useSession } from '@/state/SessionState';
import type { ClinicLink } from '@/types';

const kicker = 'font-pj-bd text-[11px] leading-4 tracking-[0.5px] text-slate';
const group = 'overflow-hidden rounded-2xl border border-line/40 bg-white';

const genders = { female: 'F', male: 'M', other: 'Other' } as const;

export default function ProfileHome() {
  const toast = useToast();
  const account = useAccount();
  const { call } = useSession();
  const { language, setLanguage } = useOnboarding();
  const [loggingOut, setLoggingOut] = useState(false);
  const [pickingLanguage, setPickingLanguage] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [links, setLinks] = useState<ClinicLink[] | null>(null);
  const [linkError, setLinkError] = useState('');
  const edit = () => router.push('/profile/edit');

  const loadLinks = useCallback(async () => {
    try {
      setLinks(await call<ClinicLink[]>('/v1/patient/links'));
      setLinkError('');
    } catch (failure) {
      setLinkError(errorMessage(failure));
    }
  }, [call]);

  // Reloaded each time the tab is opened, so a link the clinic added or removed shows up.
  useFocusEffect(useCallback(() => {
    loadLinks();
  }, [loadLinks]));

  const name = account?.fullName ?? '';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const address = [account?.addressLine, account?.city, account?.pinCode].filter(Boolean).join(', ');
  const emergency = [account?.emergencyName, account?.emergencyPhone, account?.emergencyRelation].filter(Boolean).join(' · ');
  const languageName = languages.find((item) => item.code === language)?.name;

  return (
    <Screen
      inTabs
      className="bg-sky-50"
      header={
        <AppHeader
          title="Profile"
          back={false}
          right={
            <>
              <IconButton
                icon="bell"
                label="Notifications"
                onPress={() => router.push('/health/notifications')}
              />
              <IconButton
                icon="lock"
                label="Security and login"
                onPress={() => router.push('/security')}
              />
            </>
          }
        />
      }
      contentClassName="gap-4 pt-4 pb-6">
      <View className="gap-3 rounded-2xl border border-line/40 bg-white p-4">
        <View className="flex-row items-center gap-3">
          <Avatar square photoUri={null} initials={initials} size={48} />
          <View className="flex-1">
            <Text className="font-pj-bd text-[16px] leading-6 text-ink">{name}</Text>
            <Text className="text-[12px] leading-[18px] text-slate">
              {links?.[0] ? `${links[0].mrn} · ${links[0].clinicName}` : 'Clinic OS account'}
            </Text>
          </View>
          <Button label="Edit" iconLeft="edit-pencil" variant="outline" size="sm" onPress={edit} />
        </View>
        <View className="gap-2 border-t border-line/30 pt-3">
          {[
            ['ABHA ID', 'Not linked'],
            ['Mobile', `+91 ${formatMobile(account?.mobile ?? '')}`],
            ['Email', account?.email ?? 'Not added'],
          ].map(([label, value]) => (
            <View key={label} className="flex-row justify-between gap-3">
              <Text className="text-[12px] leading-[18px] text-slate">{label}</Text>
              <Text
                numberOfLines={1}
                className="flex-1 text-right font-pj-sb text-[12px] leading-[18px] text-ink">
                {value}
              </Text>
            </View>
          ))}
        </View>
        <View className="flex-row flex-wrap gap-1.5">
          {account?.bloodGroup ? <Pill label={`${account.bloodGroup} (Self-reported)`} tone="plain" /> : null}
          {account?.dateOfBirth ? (
            <Pill
              label={`${ageOn(account.dateOfBirth)}${account.gender ? genders[account.gender] : ''} (${longDate(account.dateOfBirth)})`}
              tone="plain"
            />
          ) : null}
          {account?.emergencyName ? <Pill label={account.emergencyName} tone="plain" /> : null}
        </View>
      </View>

      <Text className={kicker}>PERSONAL RECORDS & BIO</Text>
      <View className={group}>
        <MenuRow first icon="tab-profile" title="Personal Details" caption="Name, DOB, Biological Sex, Blood Group" onPress={edit} />
        <MenuRow icon="mail" title="Contact Information" caption="Mobile, Email, Channels" onPress={edit} />
        <MenuRow
          icon="phone"
          title="Emergency Contact"
          caption={emergency || 'Not added'}
          onPress={() => toast('Editing your emergency contact is not available yet.')}
        />
        <MenuRow
          icon="pin-slate"
          title="Address & Residence"
          caption={address || 'Not added'}
          onPress={edit}
        />
      </View>

      <View>
        <View className="flex-row items-center gap-2">
          <Text className="font-pj-bd text-[16px] leading-6 text-ink">My Clinics</Text>
          {links ? <Pill label={`${links.length} Connected`} /> : null}
        </View>
        <Text className="text-[12px] leading-[18px] text-slate">
          Each clinic keeps its own record of you
        </Text>
      </View>
      {linkError ? (
        <Pressable accessibilityRole="button" onPress={loadLinks}>
          <Text accessibilityRole="alert" className="text-[12px] leading-[18px] text-[#ba1a1a]">
            {linkError} Tap to try again.
          </Text>
        </Pressable>
      ) : null}
      {links?.length === 0 ? (
        <Text className="text-[12px] leading-[18px] text-slate">
          No clinic record is connected yet. Ask your clinic desk for a connection code.
        </Text>
      ) : null}
      {links?.map((link) => (
        <Pressable
          key={link.id}
          accessibilityRole="button"
          onPress={() => router.push('/clinics')}
          className="gap-2.5 rounded-2xl border border-line/40 bg-white p-3.5">
          <View className="flex-row gap-3">
            <View className="size-9 items-center justify-center rounded-xl bg-sky-100">
              <Icon name="clinic-building" />
            </View>
            <View className="flex-1">
              <Text className="font-pj-bd text-[14px] leading-5 text-ink">{link.clinicName}</Text>
              <Text className="text-[12px] leading-[18px] text-slate">{link.homeBranch.name}</Text>
            </View>
            <Pill label="Connected" tone="mint" />
          </View>
          <View className="flex-row justify-between border-t border-line/30 pt-2">
            <Text className="text-[11px] leading-4 text-slate">{link.patientName}</Text>
            <Text className="font-pj-sb text-[11px] leading-4 text-ink">{link.mrn}</Text>
          </View>
        </Pressable>
      ))}
      <Button
        label="Connect Another Clinic"
        iconLeft="plus-white"
        iconColor="#081e26"
        variant="outline"
        className="border-dashed border-line"
        onPress={() => setConnecting(true)}
      />

      <Text className={kicker}>ACCOUNT & HEALTH LOCKER</Text>
      <View className={group}>
        <MenuRow first icon="bell" title="Notification Preferences" caption="Push, WhatsApp, SMS matrix" onPress={() => router.push('/profile/notification-preferences')} />
        <MenuRow icon="translate" title="Language Preferences" caption={`${languageName} selected`} onPress={() => setPickingLanguage(true)} />
        <MenuRow icon="shield-check" title="Privacy & Consent Locker" caption="Sign-in and consent settings" onPress={() => router.push('/security')} />
        <MenuRow icon="fingerprint" title="Security & Biometrics" caption="Signed-in devices" onPress={() => router.push('/security')} />
        <MenuRow icon="help-circle" title="Help & Concierge Support" caption="FAQs and clinic contacts" onPress={() => router.push('/profile/help')} />
        <MenuRow icon="info" title="About Clinic OS" caption="Version 1.0.0" onPress={() => toast('Clinic OS Patient App, preview build.')} />
      </View>

      <Button
        label="Log Out"
        variant="outline"
        className="border-line/60"
        onPress={() => setLoggingOut(true)}
      />
      <LogoutSheet visible={loggingOut} onClose={() => setLoggingOut(false)} />
      <ConnectClinicSheet
        visible={connecting}
        onClose={() => setConnecting(false)}
        onConnected={setLinks}
      />
      <Sheet
        visible={pickingLanguage}
        onClose={() => setPickingLanguage(false)}
        title="Language preferences">
        {languages.map((item) => (
          <Pressable
            key={item.code}
            accessibilityRole="menuitem"
            accessibilityState={{ selected: item.code === language }}
            onPress={() => {
              setLanguage(item.code);
              setPickingLanguage(false);
            }}
            className={`rounded-xl px-3 py-3 ${item.code === language ? 'bg-sky-100' : ''}`}>
            <Text className="text-[16px] leading-6 text-heading">{item.name}</Text>
          </Pressable>
        ))}
      </Sheet>
    </Screen>
  );
}
