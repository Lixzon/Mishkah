import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';

export interface SharedSyncRecord {
  record_key: string;
  payload: Record<string, unknown>;
  updated_at: string;
}

type SharedSyncRow = SharedSyncRecord & { user_id: string };

const extra = Constants.expoConfig?.extra ?? {};
const SUPABASE_URL = String(extra.supabaseUrl ?? '').trim();
const SUPABASE_ANON_KEY = String(extra.supabaseAnonKey ?? '').trim();
const AUTH_STORAGE_KEY = 'lixzon.supabase.auth.v1';

const secureStorage = {
  getItem: (key: string) => Platform.OS === 'web'
    ? AsyncStorage.getItem(key)
    : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => Platform.OS === 'web'
    ? AsyncStorage.setItem(key, value)
    : SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => Platform.OS === 'web'
    ? AsyncStorage.removeItem(key)
    : SecureStore.deleteItemAsync(key),
};

let client: SupabaseClient | null = null;
let channel: RealtimeChannel | null = null;

export function isSupabaseSyncConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseSyncConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: secureStorage,
        storageKey: AUTH_STORAGE_KEY,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export async function connectSupabaseGoogleAccount(
  idToken: string,
  accessToken?: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase sync is not configured for this build.');
  if (!idToken) throw new Error('Google did not provide an identity token.');
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: idToken,
    ...(accessToken ? { access_token: accessToken } : {}),
  });
  if (error) throw new Error(`Supabase sign-in failed: ${error.message}`);
}

export async function disconnectSupabaseAccount(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw new Error(`Supabase sign-out failed: ${error.message}`);
}

export async function upsertSharedRecord(
  recordKey: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase sync is not configured for this build.');
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`Could not verify the signed-in account: ${userError.message}`);
  const user = userResult.user;
  if (!user) throw new Error('Sign in before syncing LIXZON progress.');

  const { error } = await supabase.from('lixzon_sync_records').upsert({
    user_id: user.id,
    record_key: recordKey,
    payload,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,record_key' });
  if (error) throw new Error(`Could not sync ${recordKey}: ${error.message}`);
}

export async function readSharedRecords(): Promise<SharedSyncRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase sync is not configured for this build.');
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`Could not verify the signed-in account: ${userError.message}`);
  if (!userResult.user) throw new Error('Sign in before loading LIXZON progress.');

  const { data, error } = await supabase
    .from('lixzon_sync_records')
    .select('record_key,payload,updated_at')
    .eq('user_id', userResult.user.id);
  if (error) throw new Error(`Could not load shared progress: ${error.message}`);
  return (data ?? []) as SharedSyncRecord[];
}

export async function subscribeToSharedRecords(
  onRecord: (record: SharedSyncRecord) => void,
): Promise<() => Promise<void>> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase sync is not configured for this build.');
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`Could not verify the signed-in account: ${userError.message}`);
  if (!userResult.user) throw new Error('Sign in before subscribing to LIXZON progress.');
  const userId = userResult.user.id;

  if (channel) {
    await supabase.removeChannel(channel);
    channel = null;
  }
  channel = supabase
    .channel(`lixzon-sync:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'lixzon_sync_records',
        filter: `user_id=eq.${userId}`,
      },
      (change) => {
        const row = change.new as Partial<SharedSyncRow>;
        if (
          typeof row.record_key === 'string' &&
          typeof row.updated_at === 'string' &&
          typeof row.payload === 'object' &&
          row.payload !== null &&
          !Array.isArray(row.payload)
        ) {
          onRecord({
            record_key: row.record_key,
            payload: row.payload as Record<string, unknown>,
            updated_at: row.updated_at,
          });
        }
      },
    )
    .subscribe((status, error) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        console.error('LIXZON sync realtime subscription failed.', error);
      }
    });

  const subscription = channel;
  return async () => {
    if (channel !== subscription) return;
    await supabase.removeChannel(subscription);
    channel = null;
  };
}
