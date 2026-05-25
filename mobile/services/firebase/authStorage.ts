// Auth persistence storage (M2.4).
//
// Firebase JS SDK persists the signed-in session through an AsyncStorage-shaped
// interface (`getReactNativePersistence` in services/firebase/auth.ts). We back
// it with MMKV — already a dependency — instead of adding
// @react-native-async-storage/async-storage. MMKV is synchronous; Firebase only
// requires the three methods to RETURN promises, so we wrap each call.
//
// A dedicated MMKV instance ('floq.auth') isolates Firebase's token keys
// (`firebase:authUser:...`) from app data in the default instance, so sign-out
// teardown (which clears app keys) never has to reason about auth internals.

import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'floq.auth' });

/** AsyncStorage-compatible shim over MMKV for Firebase Auth RN persistence. */
export const mmkvAuthStorage = {
  setItem(key: string, value: string): Promise<void> {
    storage.set(key, value);
    return Promise.resolve();
  },
  getItem(key: string): Promise<string | null> {
    return Promise.resolve(storage.getString(key) ?? null);
  },
  removeItem(key: string): Promise<void> {
    storage.remove(key);
    return Promise.resolve();
  },
};
