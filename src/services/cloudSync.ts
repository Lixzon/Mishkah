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
