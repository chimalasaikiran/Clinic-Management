import { Tabs } from 'expo-router';

import { TabBar } from '@/components/layout/TabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="today/index" />
      <Tabs.Screen name="patients" />
      <Tabs.Screen name="schedule/index" />
      <Tabs.Screen name="inbox/index" />
      <Tabs.Screen name="profile/index" />
    </Tabs>
  );
}
