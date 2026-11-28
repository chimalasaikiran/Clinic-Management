import { router } from 'expo-router';

import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';

import { ProfileButton, ReceptionHeader } from './ui';

/**
 * Collecting payments from the app waits on a decision about which role may take money at the desk. Until then
 * the desk records payments in the admin panel, and these screens say so instead of showing sample invoices.
 */
export function BillingUnavailable({ title }: { title: string }) {
  return (
    <Screen className="bg-sky-50" header={<ReceptionHeader title={title} subtitle="Front Desk" right={<ProfileButton initials />} />} contentClassName="px-4 pt-6">
      <EmptyState
        title="Not available in the app yet"
        message="Invoices and payments are recorded in the ClinicOS admin panel for now."
        actionLabel="Back to Desk"
        onAction={() => router.replace('/reception')}
      />
    </Screen>
  );
}
