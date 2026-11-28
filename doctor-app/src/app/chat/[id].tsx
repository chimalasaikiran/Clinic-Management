import { router } from 'expo-router';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';

/** Messaging between clinicians, patients and caregivers has no service behind it yet. */
export default function Chat() {
  return (
    <Screen className="bg-sky-50" header={<AppHeader title="Messages" />} contentClassName="px-4 pt-6">
      <EmptyState
        title="Messaging is not available yet"
        message="Clinical conversations with patients and the care team are not part of ClinicOS yet. Use the clinical inbox for results and alerts."
        actionLabel="Open Inbox"
        onAction={() => router.replace('/inbox')}
      />
    </Screen>
  );
}
