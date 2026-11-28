import { Redirect, useSegments } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { useSession } from '@/state/SessionState';

// Screens a signed-out person may see.
const PUBLIC = new Set(['', 'verify']);

/** Keeps every screen but sign-in behind a live session, and says so when the saved one cannot be checked. */
export function SessionGate({ children }: { children: ReactNode }) {
  const { session, retry, signOut } = useSession();
  const segments = useSegments() as string[];
  const first = segments[0] ?? '';

  if (session.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-sky-50">
        <ActivityIndicator color="#081e26" />
      </View>
    );
  }
  if (session.status === 'unreachable') {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-sky-50 px-8">
        <Text className="text-center font-pj-sb text-[18px] leading-6 text-ink">Cannot reach ClinicOS</Text>
        <Text className="text-center text-[14px] leading-5 text-slate">{session.message}</Text>
        <Button label="Try Again" onPress={retry} />
        <Button label="Sign Out" variant="outline" onPress={signOut} />
      </View>
    );
  }
  if (session.status === 'signedOut' && !PUBLIC.has(first)) return <Redirect href="/" />;
  return <>{children}</>;
}
