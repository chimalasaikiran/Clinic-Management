import { router, useLocalSearchParams, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Share } from 'react-native';

import { AppHeader, IconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { ErrorState, LoadingState } from '@/components/ui/States';
import { useResource } from '@/hooks/useResource';

type Props<T> = {
  title: string;
  /** The API path for the record named in the route, without the id. */
  path: string;
  listHref: Href;
  subtitle: (record: T) => string;
  shareMessage: (record: T) => string;
  children: (record: T, reload: () => void) => ReactNode;
};

/** Loads one record by the id in the route, and handles loading, "not found" and connection problems. */
export function RecordDetailScreen<T>({ title, path, listHref, subtitle, shareMessage, children }: Props<T>) {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Records change when the clinic releases or updates them, and access changes when a link is removed.
  const record = useResource<T>(`${path}/${encodeURIComponent(id)}`, ['records', 'requests', 'app_access']);

  if (!record.data) {
    const missing = record.error?.code === 'NOT_FOUND' || record.error?.code === 'VALIDATION_FAILED';
    return (
      <Screen inTabs header={<AppHeader title={title} />}>
        {record.error ? (
          <ErrorState
            title={missing ? 'Record not found' : 'Could not load this record'}
            message={missing ? 'This record is not available on your account. It may not have been released by your clinic yet.' : record.error.message}
            actionLabel={missing ? 'Back to list' : 'Try again'}
            onAction={missing ? () => router.replace(listHref) : record.reload}
          />
        ) : (
          <LoadingState label="Loading record…" />
        )}
      </Screen>
    );
  }

  const data = record.data;
  return (
    <Screen
      inTabs
      className="bg-[#f4f7f6]"
      header={
        <AppHeader
          title={title}
          subtitle={subtitle(data)}
          right={<IconButton icon="share" label="Share this record" onPress={() => Share.share({ message: shareMessage(data) })} />}
        />
      }
      contentClassName="gap-3.5 pt-3 pb-6">
      {children(data, record.reload)}
    </Screen>
  );
}
