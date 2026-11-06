import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface AuthSession {
  provider: 'google';
  idToken: string;
  accessToken?: string;
  email?: string;
  name?: string;
  linkedAt: number;
  expiresAt: number;
}

const AUTH_STORAGE_KEY = 'mishkah.auth.session.v1';

export async function saveAuthSession(session: AuthSession): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export async function loadAuthSession(): Promise<AuthSession | null> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => undefined);
    return null;
  }

  await AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => undefined);

  try {
    const stored = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<AuthSession>;
    if (typeof parsed.idToken === 'string' && typeof parsed.linkedAt === 'number') {
      return { ...parsed, provider: 'google' } as AuthSession;
    }
  } catch {
    return null;
  }

  return null;
}

export async function clearAuthSession(): Promise<void> {
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
    } catch {
      // Continue clearing legacy storage if secure storage is unavailable.
    }
  }

  // Remove auth tokens persisted by older builds in web storage.
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      globalThis.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Ignore storage restrictions.
    }
  }
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY).catch(() => undefined);
}

export function isAuthSessionExpired(session: AuthSession | null | undefined): boolean {
  if (!session) return true;
  return Number.isFinite(session.expiresAt) && Date.now() >= session.expiresAt;
}
