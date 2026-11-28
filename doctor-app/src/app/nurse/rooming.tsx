import { router } from 'expo-router';

import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/ui/States';
import { NurseHeader } from '@/features/nurse/ui';

/** Rooms and patient transfers are not part of ClinicOS yet. */
export default function Rooming() {
  return (
    <Screen className="bg-sky-50" header={<NurseHeader title="Rooming & Transfer" />} contentClassName="px-4 pt-6">
      <EmptyState
        title="Rooming is not available yet"
        message="ClinicOS does not track rooms or patient transfers. Record vitals from the queue; the doctor sees them straight away."
        actionLabel="Open Queue"
        onAction={() => router.replace('/nurse/patients')}
      />
    </Screen>
  );
}
