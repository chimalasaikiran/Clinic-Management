import { router } from 'expo-router';

import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';

import { PageHeader } from './PageHeader';

/** ClinicOS has no staff help desk yet, so the app does not pretend to send a request. */
export function SupportUnavailable() {
  return (
    <Screen className="bg-sky-50" header={<PageHeader title="Support Request" />} contentClassName="px-5 pt-6">
      <EmptyState
        title="Support requests are not available yet"
        message="Contact your clinic administrator. Nothing is sent from this app."
        actionLabel="Help & Support"
        onAction={() => router.replace('/support')}
      />
    </Screen>
  );
}
