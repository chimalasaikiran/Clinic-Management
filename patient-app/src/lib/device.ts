import { Platform } from 'react-native';

/** What the "active sessions" list shows for this phone. */
export const deviceDetails = () => {
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'android';
  const names = { ios: 'iPhone', android: 'Android phone', web: 'Web browser' } as const;
  return { platform, deviceName: names[platform] };
};
