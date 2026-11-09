import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SharedSyncRecord {
  record_key: string;
  payload: Record<string, unknown>;
  updated_at: string;
}

export interface CloudBackupRecord {
  payload: Record<string, unknown>;
  updated_at: string;
}

export type CloudBackupApp = 'mishkah' | 'furqan';

const extra = Constants.expoConfig?.extra ?? {};
const SUPABASE_URL = String(extra.supabaseUrl ?? '').trim();
const SUPABASE_ANON_KEY = String(extra.supabaseAnonKey ?? '').trim();
const AUTH_STORAGE_KEY = 'lixzon.supabase.auth.v1';
const PAIR_CODE_STORAGE_KEY = 'lixzon.sync.pair-code.v1';
const PAIR_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PAIR_CODE_LENGTH = 20;

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

export class PairingCodeRevokedError extends Error {
  constructor() {
    super('This pairing was revoked on another device.');
    this.name = 'PairingCodeRevokedError';
  }
}

export function isPairingCodeRevokedError(error: unknown): error is PairingCodeRevokedError {
  return error instanceof PairingCodeRevokedError;
}

function isPairingCodeNotFound(message: string): boolean {
  return /pairing code (?:revoked or )?not found/i.test(message);
}

export function isSupabaseSyncConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function getSavedPairCode(): Promise<string | null> {
  return secureStorage.getItem(PAIR_CODE_STORAGE_KEY);
}

async function savePairCode(code: string | null): Promise<void> {
  if (code) await secureStorage.setItem(PAIR_CODE_STORAGE_KEY, code);
  else await secureStorage.removeItem(PAIR_CODE_STORAGE_KEY);
}

function validatePairCode(value: string): string {
  const code = value.trim().toUpperCase().replace(/[\s-]/g, '');
  if (!new RegExp(`^[${PAIR_CODE_ALPHABET}]{${PAIR_CODE_LENGTH}}$`).test(code)) {
    throw new Error('Enter the complete 20-character pairing code.');
  }
  return code;
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
        detectSessionInUrl: Platform.OS === 'web',
      },
    });
  }
  return client;
}

export async function createPairCode(): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Pairing sync is not configured for this build.');
  const bytes = await Crypto.getRandomBytesAsync(PAIR_CODE_LENGTH);
  const code = Array.from(bytes, (byte) => PAIR_CODE_ALPHABET[byte & 31]).join('');
  const { error } = await supabase.rpc('create_lixzon_sync_pair', { p_code: code });
  if (error) throw new Error(`Could not create an app-pairing code: ${error.message}`);
  await savePairCode(code);
  return code;
}

export async function joinPairCode(value: string): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Pairing sync is not configured for this build.');
  const code = validatePairCode(value);
  const { error } = await supabase.rpc('join_lixzon_sync_pair', { p_code: code });
  if (error) throw new Error(`Could not join that app pairing: ${error.message}`);
  await savePairCode(code);
  return code;
}

export async function forgetPairCode(): Promise<void> {
  await savePairCode(null);
}

export async function revokePairCode(value: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Pairing sync is not configured for this build.');
  const code = validatePairCode(value);
  const { data, error } = await supabase.rpc('revoke_lixzon_sync_pair', { p_code: code });
  if (error) throw new Error(`Could not revoke the app pairing: ${error.message}`);
  if (typeof data !== 'boolean') throw new Error('The sync service returned an invalid revocation response.');
  return data;
}

export async function readPairedRecords(code: string): Promise<SharedSyncRecord[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Pairing sync is not configured for this build.');
  const { data, error } = await supabase.rpc('read_lixzon_paired_records', { p_code: code });
  if (error) {
    if (isPairingCodeNotFound(error.message)) throw new PairingCodeRevokedError();
    throw new Error(`Could not load paired app data: ${error.message}`);
  }
  if (!Array.isArray(data)) throw new Error('The sync service returned invalid paired data.');
  return data.filter((row): row is SharedSyncRecord =>
    typeof row === 'object' &&
    row !== null &&
    typeof row.record_key === 'string' &&
    typeof row.updated_at === 'string' &&
    typeof row.payload === 'object' &&
    row.payload !== null &&
    !Array.isArray(row.payload),
  );
}

export async function upsertPairedRecords(
  code: string,
  records: Array<{ record_key: string; payload: Record<string, unknown> }>,
): Promise<void> {
  if (records.length === 0) return;
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Pairing sync is not configured for this build.');
  const { error } = await supabase.rpc('upsert_lixzon_paired_records', {
    p_code: code,
    p_records: records,
  });
  if (error) {
    if (isPairingCodeNotFound(error.message)) throw new PairingCodeRevokedError();
    throw new Error(`Could not sync paired app data: ${error.message}`);
  }
}

export async function requestEmailCode(email: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cloud backup is not configured for this build.');
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('Enter a valid email address.');
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: { shouldCreateUser: true },
  });
  if (error) throw new Error(`Could not send a sign-in code: ${error.message}`);
}

export async function verifyEmailCode(email: string, token: string): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cloud backup is not configured for this build.');
  const normalizedEmail = email.trim().toLowerCase();
  const verificationCode = token.trim().replace(/\s/g, '');
  if (!normalizedEmail || !verificationCode) throw new Error('Enter your email and the code you received.');
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: verificationCode,
    type: 'email',
  });
  if (error) throw new Error(`Could not verify the email code: ${error.message}`);
  if (!data.user?.email) throw new Error('Email verification succeeded but no account email was returned.');
  return data.user.email;
}

export async function getCloudUserEmail(): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(`Could not load the signed-in account: ${error.message}`);
  return data.session?.user.email ?? null;
}

export async function signOutCloudAccount(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cloud backup is not configured for this build.');
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(`Could not sign out: ${error.message}`);
}

export async function readCloudBackup(app: CloudBackupApp): Promise<CloudBackupRecord | null> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cloud backup is not configured for this build.');
  const { data, error } = await supabase
    .from('lixzon_user_backups')
    .select('payload, updated_at')
    .eq('app_id', app)
    .maybeSingle();
  if (error) throw new Error(`Could not load the cloud backup: ${error.message}`);
  if (!data) return null;
  if (
    typeof data.payload !== 'object' ||
    data.payload === null ||
    Array.isArray(data.payload) ||
    typeof data.updated_at !== 'string'
  ) {
    throw new Error('The cloud backup has an invalid format.');
  }
  return { payload: data.payload as Record<string, unknown>, updated_at: data.updated_at };
}

export async function writeCloudBackup(
  app: CloudBackupApp,
  payload: Record<string, unknown>,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Cloud backup is not configured for this build.');
  const serialized = JSON.stringify(payload);
  let byteLength = 0;
  for (const character of serialized) {
    const codePoint = character.codePointAt(0) ?? 0;
    byteLength += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
    if (byteLength > 1_000_000) break;
  }
  if (byteLength > 1_000_000) {
    throw new Error('This backup is larger than the cloud backup limit. Use an exported backup file instead.');
  }
  const { error } = await supabase.from('lixzon_user_backups').upsert(
    { app_id: app, schema_version: 1, payload },
    { onConflict: 'user_id,app_id' },
  );
  if (error) throw new Error(`Could not save the cloud backup: ${error.message}`);
}
