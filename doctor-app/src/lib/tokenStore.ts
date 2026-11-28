import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'clinicos.staff.session';

// The session token lives in the phone's keychain / keystore. A web build has no secure store, so there it
// is kept in memory only and a reload signs out.
let memory: string | null = null;
const secure = Platform.OS !== 'web';

export const tokenStore = {
  read: async () => (secure ? SecureStore.getItemAsync(KEY) : memory),
  write: async (token: string) => {
    if (secure) await SecureStore.setItemAsync(KEY, token);
    else memory = token;
  },
  clear: async () => {
    if (secure) await SecureStore.deleteItemAsync(KEY);
    else memory = null;
  },
};
