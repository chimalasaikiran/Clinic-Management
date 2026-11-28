import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppHeader, goBack } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { Tag, type Tone } from '@/components/ui/Kit';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useActiveEncounter } from '@/features/doctor/clinical';
import type { IconName } from '@/theme/icons';

import { PatientBanner } from './PatientBanner';

type Props = {
  title: string;
  subtitle: string;
  badge?: { label: string; tone: Tone };
  /** The autosave and sync line under the header. */
  status: string;
  headerRight?: ReactNode;
  secondary?: { label: string; onPress?: () => void };
  primary: {
    label: string;
    onPress: () => void;
    icon?: IconName;
    disabled?: boolean;
    loading?: boolean;
  };
  footnote?: string;
  children: ReactNode;
};

/** The frame shared by every step of an encounter. */
export function WorkflowScreen({
  title,
  subtitle,
  badge,
  status,
  headerRight,
  secondary,
  primary,
  footnote,
  children,
}: Props) {
  const { encounterId, encounter, sealed } = useActiveEncounter();
  // Each step saves to the server as the doctor goes, so leaving a step loses nothing.
  const backToWorkspace = () => (router.canGoBack() ? goBack() : router.replace('/patients/workspace'));

  if (!encounter.data) {
    return (
      <Screen className="bg-sky-50" header={<AppHeader title={title} subtitle="Consultation" />} contentClassName="px-4 pt-6">
        {!encounterId ? (
          <EmptyState title="No consultation open" message="Start or resume a consultation from Today's patient list." actionLabel="Open Today" onAction={() => router.replace('/today')} />
        ) : encounter.error ? (
          <ErrorState message={encounter.error.message} onAction={encounter.reload} />
        ) : (
          <LoadingState label="Opening the consultation…" />
        )}
      </Screen>
    );
  }

  return (
    <Screen
      className="bg-sky-50"
      header={
        <>
          <AppHeader
            title={title}
            subtitle={subtitle}
            badge={badge ? <Tag label={badge.label} tone={badge.tone} /> : undefined}
            right={headerRight}
          />
          <View className="bg-sky-200/40 px-5 py-1.5">
            <Text numberOfLines={1} className="font-pj-md text-[11px] leading-4 text-slate">
              {status}
            </Text>
          </View>
        </>
      }
      footer={
        sealed ? (
          <View className="gap-1.5">
            <Text className="text-center text-[12px] leading-4 text-slate">
              This encounter is signed. Add an addendum to its note for any correction.
            </Text>
            <Button label="View Summary" onPress={() => router.dismissTo('/patients/completed')} />
          </View>
        ) : (
          <View className="gap-1.5">
            <View className="flex-row gap-2">
              <Button
                label={secondary?.label ?? 'Workspace'}
                variant="soft"
                className="min-h-[48px] rounded-xl"
                onPress={secondary?.onPress ?? backToWorkspace}
              />
              <Button
                label={primary.label}
                iconRight={primary.icon ?? 'arrow-right-white'}
                className="min-h-[48px] flex-1 rounded-xl"
                textClassName="font-pj-bd text-[14px]"
                disabled={primary.disabled}
                loading={primary.loading}
                onPress={primary.onPress}
              />
            </View>
            {footnote ? (
              <Text className="text-center text-[10px] leading-[15px] text-slate">{footnote}</Text>
            ) : null}
          </View>
        )
      }
      contentClassName="gap-3 px-4 pt-3 pb-6">
      <PatientBanner />
      {children}
    </Screen>
  );
}
