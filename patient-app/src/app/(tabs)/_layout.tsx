import { Redirect, Tabs } from 'expo-router';

import { TabBar } from '@/components/layout/TabBar';
import { useSession } from '@/state/SessionState';

export default function TabsLayout() {
  const { session } = useSession();
  // Also what moves the patient out when the server ends their session.
  if (session.status !== 'signedIn') return <Redirect href="/" />;

  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="clinics" />
      <Tabs.Screen name="appointments" />
      <Tabs.Screen name="health" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
