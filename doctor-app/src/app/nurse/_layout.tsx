import { Stack } from 'expo-router';

export const unstable_settings = { anchor: '(tabs)' };

export default function NurseLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
