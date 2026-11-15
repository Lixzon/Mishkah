import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface CloudBackupRecord {
  payload: Record<string, unknown>;
  updated_at: string;
}

export type CloudBackupApp = 'mishkah' | 'furqan';

export const CLOUD_BACKUP_ENABLED_EVENT = 'lixzon:cloud-backup:enabled';
export const CLOUD_BACKUP_ENABLED_KEY_PREFIX = 'lixzon.cloud-backup.enabled:furqan:';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

let client: SupabaseClient | null = null;

export function isSupabaseSyncConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseSyncConfigured()) return null;
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  }
  return client;
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
