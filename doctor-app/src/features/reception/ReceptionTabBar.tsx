import { StaffTabBar, type TabBarProps, type TabItem } from '@/components/staff/TabBar';

/** The first three switch tabs. Queue and Settings open as screens with a back arrow. */
const items: TabItem[] = [
  { label: 'Cockpit', icon: 'dashboard', route: 'index' },
  { label: 'Schedule', icon: 'calendar-month', route: 'appointments' },
  { label: 'Patients', icon: 'people-outline', route: 'patients' },
  { label: 'Queue', icon: 'format-list-numbered', href: '/reception/queue' },
  { label: 'Settings', icon: 'tune', href: '/reception/profile' },
];

export function ReceptionTabBar(props: TabBarProps) {
  return <StaffTabBar {...props} items={items} />;
}
