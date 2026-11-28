import { Tabs } from 'expo-router';

import { StaffTabBar, type TabItem } from '@/components/staff/TabBar';
import { useNotices } from '@/features/common/notices';

export default function NurseTabsLayout() {
  const { unread } = useNotices(1);
  // The designs show three different bars. This is the one from the patient queue.
  const items: TabItem[] = [
    { label: 'Today', icon: 'calendar-today', route: 'index' },
    { label: 'Patients', icon: 'people-outline', route: 'patients' },
    { label: 'Tasks', icon: 'checklist', route: 'tasks' },
    { label: 'Alerts', icon: 'notifications-none', route: 'alerts', dot: unread > 0 },
    { label: 'More', icon: 'more-horiz', route: 'profile' },
  ];
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <StaffTabBar {...props} items={items} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="patients" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="alerts" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
