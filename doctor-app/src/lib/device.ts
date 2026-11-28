import { Platform } from 'react-native';

/** What the staff "active sessions" list shows for this phone. */
export const deviceName = () => (Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'web' ? 'Web browser' : 'Android phone');
