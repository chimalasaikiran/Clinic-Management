import '../global.css';

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionGate } from '@/components/layout/SessionGate';
import { ToastProvider } from '@/components/ui/Toast';
import { ConsultationProvider } from '@/state/ConsultationState';
import { LiveProvider } from '@/state/LiveState';
import { SessionProvider } from '@/state/SessionState';
import { StaffProvider } from '@/state/StaffState';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <SessionProvider>
      <LiveProvider>
      <StaffProvider>
        <ConsultationProvider>
              <ToastProvider>
                <StatusBar style="dark" />
                <SessionGate>
                  <Stack screenOptions={{ headerShown: false }} />
                </SessionGate>
              </ToastProvider>
        </ConsultationProvider>
      </StaffProvider>
      </LiveProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
