import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';

import { AppHeader } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useResource, type Resource } from '@/hooks/useResource';
import type { Appointment } from '@/types';

type Props = {
  title?: string;
  inTabs?: boolean;
  children: (appointment: Appointment, resource: Resource<Appointment>) => ReactNode;
};

/** Loads the appointment named in the route, handling loading, "not found" and connection problems. */
export function AppointmentGate({ title = 'Appointment', inTabs = true, children }: Props) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const resource = useResource<Appointment>(`/v1/patient/appointments/${encodeURIComponent(id)}`, ['appointments', 'app_access']);
  if (resource.data) return <>{children(resource.data, resource)}</>;

  const missing = resource.error?.code === 'NOT_FOUND' || resource.error?.code === 'VALIDATION_FAILED';
  return (
    <Screen inTabs={inTabs} header={<AppHeader title={title} />}>
      {resource.error ? (
        <ErrorState
          title={missing ? 'Appointment not found' : 'Could not load this appointment'}
          message={missing ? 'This booking is not available on your account.' : resource.error.message}
          actionLabel={missing ? 'My appointments' : 'Try again'}
          onAction={missing ? () => router.dismissTo('/appointments') : resource.reload}
        />
      ) : (
        <LoadingState label="Loading your appointment…" />
      )}
    </Screen>
  );
}
