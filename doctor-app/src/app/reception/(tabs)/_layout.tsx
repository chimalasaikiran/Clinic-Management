import { Tabs } from 'expo-router';

import { ReceptionTabBar } from '@/features/reception/ReceptionTabBar';

export default function ReceptionTabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <ReceptionTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="appointments" />
      <Tabs.Screen name="patients" />
    </Tabs>
  );
}
