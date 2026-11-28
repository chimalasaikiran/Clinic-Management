import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/state/SessionState';

/** For screens outside the tabs that still need a signed-in patient. */
export function SignedInStack() {
  const { session } = useSession();
  if (session.status !== 'signedIn') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
