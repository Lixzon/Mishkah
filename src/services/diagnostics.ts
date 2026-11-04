import { gcm } from '@noble/ciphers/aes.js';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BUFFER_KEY = 'mishkah.diagnostics.encrypted.v1';
const ENCRYPTION_KEY = 'mishkah.diagnostics.key.v1';
const BUFFER_CAPACITY = 20;
const secureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export type DiagnosticEntry = {
  timestamp: string;
  name: string;
  message: string;
  stack: string;
};

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !/^[0-9a-f]*$/i.test(hex)) {
    throw new Error('The encrypted diagnostics data is not valid hexadecimal.');
  }
  return Uint8Array.from(
    hex.match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? [],
  );
}

function encodeUtf8(value: string): Uint8Array {
  const encoded = encodeURIComponent(value);
  const bytes: number[] = [];
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === '%') {
      bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(encoded.charCodeAt(index));
    }
  }
  return Uint8Array.from(bytes);
}

function decodeUtf8(bytes: Uint8Array): string {
  const escaped = Array.from(bytes, (byte) => `%${byte.toString(16).padStart(2, '0')}`).join('');
  return decodeURIComponent(escaped);
}

async function getEncryptionKey(): Promise<Uint8Array> {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new Error('Secure device storage is unavailable; encrypted diagnostics require iOS or Android.');
  }
  const stored = await SecureStore.getItemAsync(ENCRYPTION_KEY, secureStoreOptions);
  if (stored) {
    const key = fromHex(stored);
    if (key.length !== 32) {
      throw new Error('The protected diagnostics key has an invalid length.');
    }
    return key;
  }

  const key = await Crypto.getRandomBytesAsync(32);
  await SecureStore.setItemAsync(ENCRYPTION_KEY, toHex(key), secureStoreOptions);
  return key;
}

async function readEntriesWithKey(key: Uint8Array): Promise<DiagnosticEntry[]> {
  const encrypted = await AsyncStorage.getItem(BUFFER_KEY);
  if (encrypted === null) {
    return [];
  }

  const [nonceHex, ciphertextHex] = encrypted.split(':');
  if (!nonceHex || !ciphertextHex) {
    throw new Error('The encrypted diagnostics buffer has an invalid format.');
  }
  const plaintext = gcm(key, fromHex(nonceHex)).decrypt(fromHex(ciphertextHex));
  const parsed: unknown = JSON.parse(decodeUtf8(plaintext));
  if (!Array.isArray(parsed)) {
    throw new Error('The encrypted diagnostics buffer has an invalid payload.');
  }
  return parsed.slice(-BUFFER_CAPACITY) as DiagnosticEntry[];
}

async function writeEntriesWithKey(key: Uint8Array, entries: DiagnosticEntry[]): Promise<void> {
  const nonce = await Crypto.getRandomBytesAsync(12);
  const ciphertext = gcm(key, nonce).encrypt(encodeUtf8(JSON.stringify(entries.slice(-BUFFER_CAPACITY))));
  await AsyncStorage.setItem(BUFFER_KEY, `${toHex(nonce)}:${toHex(ciphertext)}`);
}

export async function readDiagnosticEntries(): Promise<DiagnosticEntry[]> {
  return readEntriesWithKey(await getEncryptionKey());
}

let writeQueue: Promise<void> = Promise.resolve();

export function recordUnhandledException(error: Error): Promise<void> {
  const operation = writeQueue.then(async () => {
    const key = await getEncryptionKey();
    const currentEntries = await readEntriesWithKey(key);
    const entry: DiagnosticEntry = {
      timestamp: new Date().toISOString(),
      name: error.name.slice(0, 120),
      message: error.message.slice(0, 500),
      stack: (error.stack ?? '').slice(0, 2000),
    };
    await writeEntriesWithKey(key, [...currentEntries, entry]);
  });
  writeQueue = operation.catch((writeError: unknown) => {
    console.error('Mishkah could not persist its encrypted diagnostics entry.', writeError);
  });
  return writeQueue;
}

type ErrorHandler = (error: Error, isFatal?: boolean) => void;
type ErrorUtilsLike = {
  getGlobalHandler: () => ErrorHandler;
  setGlobalHandler: (handler: ErrorHandler) => void;
};

export function installUnhandledExceptionRecorder(): () => void {
  const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils) {
    throw new Error('The native exception handler is unavailable on this platform.');
  }
  const previousHandler = errorUtils.getGlobalHandler();
  const recorder: ErrorHandler = (error, isFatal) => {
    void recordUnhandledException(error);
    previousHandler(error, isFatal);
  };
  errorUtils.setGlobalHandler(recorder);
  return () => errorUtils.setGlobalHandler(previousHandler);
}

export function buildFridayDigest(entries: readonly DiagnosticEntry[], now = new Date()): string {
  const recentEntries = entries.filter((entry) => {
    const timestamp = Date.parse(entry.timestamp);
    const age = now.getTime() - timestamp;
    return Number.isFinite(timestamp) && age >= 0 && age <= 7 * 86_400_000;
  });
  return `Last 7 days: ${recentEntries.length} locally encrypted ${recentEntries.length === 1 ? 'exception' : 'exceptions'} recorded.`;
}

export async function isSecureDiagnosticsAvailable(): Promise<boolean> {
  return SecureStore.isAvailableAsync();
}

export async function checkDiagnosticsStorage(): Promise<void> {
  await getEncryptionKey();
  await readDiagnosticEntries();
}
