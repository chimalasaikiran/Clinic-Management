import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';

import { AppHeader, IconButton } from '@/components/layout/AppHeader';
import { Screen } from '@/components/layout/Screen';
import { FilterChips } from '@/components/ui/FilterChips';
import { SearchField } from '@/components/ui/SearchField';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import { Text } from '@/components/ui/Text';
import { useToast } from '@/components/ui/Toast';
import type { Resource } from '@/hooks/useResource';
import type { Listed } from '@/lib/api';

type Props<Item extends { clinicName: string }, Filter extends string> = {
  title: string;
  subtitle: string;
  records: Resource<Listed<Item[]>>;
  /** Shown above the search box, once the records have loaded. */
  summary?: (items: Item[]) => ReactNode;
  searchPlaceholder: string;
  filters: (items: Item[]) => readonly { value: Filter; label: string }[];
  /** The words a search is matched against. */
  searchText: (item: Item) => string;
  matches: (item: Item, filter: Filter) => boolean;
  renderItems: (items: Item[]) => ReactNode;
  emptyMessage: string;
  footer?: ReactNode;
};

/** The layout shared by record lists: summary, search, filters, results and notice. */
export function RecordListScreen<Item extends { clinicName: string }, Filter extends string>({
  title,
  subtitle,
  records,
  summary,
  searchPlaceholder,
  filters,
  searchText,
  matches,
  renderItems,
  emptyMessage,
  footer,
}: Props<Item, Filter>) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter | null>(null);
  const [clinic, setClinic] = useState('all');
  const items = records.data?.data ?? [];
  const total = records.data?.meta.total ?? items.length;
  const options = filters(items);
  const active = filter ?? options[0]!.value;
  // With records from more than one clinic, they can be shown one clinic at a time.
  const clinics = [...new Set(items.map((item) => item.clinicName))];
  const needle = query.trim().toLowerCase();
  const results = items.filter(
    (item) =>
      (clinic === 'all' || item.clinicName === clinic) &&
      matches(item, active) &&
      searchText(item).toLowerCase().includes(needle),
  );

  return (
    <Screen
      inTabs
      className="bg-[#f4f7f6]"
      header={
        <AppHeader
          title={title}
          subtitle={subtitle}
          right={
            <IconButton
              icon="help-circle"
              label="About these records"
              onPress={() => toast('These records are written and signed by your clinic. You can read them here but not change them.')}
            />
          }
        />
      }
      contentClassName="gap-3.5 pt-3 pb-6">
      {!records.data ? (
        records.error ? (
          <ErrorState message={records.error.message} onAction={records.reload} />
        ) : (
          <LoadingState label="Loading your records…" />
        )
      ) : items.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          message={emptyMessage}
          actionLabel="Connected clinics"
          onAction={() => router.push('/security')}
        />
      ) : (
        <>
          {summary?.(items)}
          <SearchField value={query} onChangeText={setQuery} placeholder={searchPlaceholder} />
          {clinics.length > 1 ? (
            <FilterChips
              options={[{ value: 'all', label: 'All clinics' }, ...clinics.map((name) => ({ value: name, label: name }))]}
              value={clinic}
              onChange={setClinic}
            />
          ) : null}
          <FilterChips options={options} value={active} onChange={setFilter} />
          {results.length === 0 ? (
            <EmptyState
              title="Nothing to show"
              message={needle ? 'No records match your search.' : 'There are no records in this category.'}
              actionLabel="Clear filters"
              onAction={() => {
                setQuery('');
                setFilter(null);
                setClinic('all');
              }}
            />
          ) : (
            renderItems(results)
          )}
          {total > items.length ? (
            <Text className="text-center text-[12px] leading-[18px] text-slate">
              Showing your {items.length} most recent of {total}. Ask the clinic for older records.
            </Text>
          ) : null}
        </>
      )}
      {footer}
    </Screen>
  );
}

/** "All (4)" style labels. */
export const counted = <Item,>(items: Item[], label: string, test: (item: Item) => boolean = () => true) =>
  `${label} (${items.filter(test).length})`;
