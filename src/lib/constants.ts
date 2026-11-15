import type { AccentId, DownloadQuality, Reciter, ScriptStyle } from '../types';

export const APP_NAME = 'Furqan';
export const APP_NAME_AR = 'الفرقان';
export const APP_TAGLINE = 'The Seeker who carries the Light of Guidance across horizons.';
export const APP_DEVELOPER = 'LIXZON';
/** Quiet attribution shown on splash, settings, player and generated cards. */
export const APP_ATTRIBUTION = 'by LIXZON';

/* ---------------- support ---------------- */

export const SUPPORT = {
  bankName: 'Guaranty Trust Bank (GTB)',
  accountName: 'Ojulari Aliy Ayodeji',
  accountNumber: '0687041418',
  currency: 'NGN',
  /** Global card checkout is enabled when this URL is configured at build time. */
  checkoutUrl: import.meta.env.VITE_SUPPORT_CHECKOUT_URL ?? '',
  playStoreUrl: import.meta.env.VITE_PLAY_STORE_URL ?? '',
  instagramUrl: 'https://www.instagram.com/Lixzon9/',
  instagramHandle: 'Lixzon9',
  discordHandle: 'Lixzon8',
} as const;

/** Optional HTTPS endpoint. It must accept privacy-minimized diagnostic summaries. */
export const DIAGNOSTICS_REPORT_ENDPOINT = import.meta.env.VITE_DIAGNOSTICS_REPORT_ENDPOINT?.trim() ?? '';

export const MAX_PLAYLIST_ITEMS = 10;

/* ---------------- accent themes ---------------- */

export interface AccentOption {
  id: AccentId;
  label: string;
  swatch: string; // representative colour for the picker
}

export const ACCENTS: AccentOption[] = [
  { id: 'teal', label: 'Teal', swatch: '#0d9488' },
  { id: 'emerald', label: 'Emerald', swatch: '#10b981' },
  { id: 'amber', label: 'Amber', swatch: '#d97706' },
  { id: 'slate', label: 'Slate', swatch: '#64748b' },
  { id: 'green', label: 'Green', swatch: '#16a34a' },
  { id: 'gold', label: 'Gold', swatch: '#c9a227' },
  { id: 'blue', label: 'Blue', swatch: '#2563eb' },
  { id: 'rose', label: 'Rose', swatch: '#e11d48' },
  { id: 'purple', label: 'Purple', swatch: '#7c3aed' },
  { id: 'sapphire', label: 'Sapphire', swatch: '#1e3a8a' },
];

/* ---------------- Arabic script styles ---------------- */

export interface ScriptStyleOption {
  id: ScriptStyle;
  label: string;
  description: string;
  className: string;
}

export const SCRIPT_STYLES: ScriptStyleOption[] = [
  {
    id: 'uthmani',
    label: 'Uthmani',
    description: 'Classical Uthmani mushaf script',
    className: 'ar-uthmani',
  },
  {
    id: 'naskh',
    label: 'Naskh',
    description: 'Traditional Naskh calligraphy',
    className: 'ar-naskh',
  },
  {
    id: 'clear',
    label: 'Clear Naskh',
    description: 'Modern, easy-to-read Naskh',
    className: 'ar-clear',
  },
];

export function scriptClassName(script: ScriptStyle): string {
  const found = SCRIPT_STYLES.find((s) => s.id === script);
  return found ? found.className : 'ar-uthmani';
}

/* ---------------- reciters ---------------- */

const AUDIO_PATH = (bitrate: number, edition: string, surah: number) =>
  `/audio-surah/${bitrate}/${edition}/${surah}.mp3`;

export const DOWNLOAD_QUALITY_OPTIONS: Array<{ id: DownloadQuality; label: string; bitrate: number; description: string }> = [
  { id: 'low', label: 'Low', bitrate: 32, description: 'Smallest files for quick downloads' },
  { id: 'medium', label: 'Medium', bitrate: 64, description: 'Balanced quality and size' },
  { id: 'high', label: 'High', bitrate: 128, description: 'Current default, full quality' },
];

export const DEFAULT_DOWNLOAD_QUALITY: DownloadQuality = 'high';

export const RECITERS: Reciter[] = [
  { id: 'ar.alafasy', label: 'Mishary Rashid Alafasy', arabicName: 'مشاري راشد العفاسي', edition: 'ar.alafasy', bitrate: 128, availableBitrates: [128] },
  { id: 'ar.abdulbasitmurattal', label: 'Abdul Basit (Murattal)', arabicName: 'عبد الباسط عبد الصمد', edition: 'ar.abdulbasitmurattal', bitrate: 128, availableBitrates: [128] },
  { id: 'ar.abdurrahmaansudais', label: 'Abdur-Rahman As-Sudais', arabicName: 'عبد الرحمن السديس', edition: 'ar.abdurrahmaansudais', bitrate: 128, availableBitrates: [128] },
  { id: 'ar.saudalshuraym', label: 'Saud Ash-Shuraym', arabicName: 'سعود الشريم', edition: 'ar.saudalshuraym', bitrate: 128, availableBitrates: [128] },
  { id: 'ar.saadghamdi', label: 'Saad Al-Ghamdi', arabicName: 'سعد الغامدي', edition: 'ar.saadghamdi', bitrate: 128, availableBitrates: [128] },
  { id: 'ar.mahermuaiqly', label: 'Maher Al-Muaiqly', arabicName: 'ماهر المعيقلي', edition: 'ar.mahermuaiqly', bitrate: 128, availableBitrates: [128] },
  { id: 'ar.husary', label: 'Mahmoud Khalil Al-Husary', arabicName: 'محمود خليل الحصري', edition: 'ar.husary', bitrate: 128, availableBitrates: [128] },
  { id: 'ar.minshawi', label: 'Muhammad Siddiq Al-Minshawi', arabicName: 'محمد صديق المنشاوي', edition: 'ar.minshawi', bitrate: 128, availableBitrates: [128] },
  { id: 'ar.muhammadayyoub', label: 'Muhammad Ayyub', arabicName: 'محمد أيوب', edition: 'ar.muhammadayyoub', bitrate: 128, availableBitrates: [128] },
  { id: 'ar.hanirifai', label: 'Hani Ar-Rifai', arabicName: 'هاني الرفاعي', edition: 'ar.hanirifai', bitrate: 128, availableBitrates: [128] },
  { id: 'ar.muhammadjibreel', label: 'Muhammad Jibreel', arabicName: 'محمد جبريل', edition: 'ar.muhammadjibreel', bitrate: 128, availableBitrates: [128] },
];

export function reciterById(id: string): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0];
}

/**
 * URL for media elements. `<audio>` may stream cross-origin without CORS and
 * handles byte ranges natively, so production points straight at the CDN.
 * Development uses the Vite proxy configured in vite.config.ts.
 */
export function audioStreamUrl(reciter: string, surah: number): string {
  const r = reciterById(reciter);
  const path = AUDIO_PATH(r.bitrate, r.edition, surah);
  return import.meta.env.DEV ? path : `https://cdn.islamic.network/quran${path}`;
}

/**
 * URL for reading audio bytes in JS (downloads, ranged fallback).
 *
 * Must stay same-origin: cdn.islamic.network sends no Access-Control-Allow-Origin
 * header, so a direct cross-origin fetch() cannot be read and downloads fail.
 * Served by the Vite dev proxy locally and the Vercel rewrite in production.
 */
export function resolveAudioBitrate(reciter: string, quality: DownloadQuality = DEFAULT_DOWNLOAD_QUALITY): number {
  const r = reciterById(reciter);
  const candidates = r.availableBitrates && r.availableBitrates.length > 0 ? r.availableBitrates : [r.bitrate];
  const desired = DOWNLOAD_QUALITY_OPTIONS.find((option) => option.id === quality)?.bitrate ?? r.bitrate;
  const available = [...candidates].sort((a, b) => a - b);
  const exact = available.find((bitrate) => bitrate === desired);
  if (exact) return exact;
  return available.find((bitrate) => bitrate >= desired) ?? available[available.length - 1] ?? r.bitrate;
}

export function audioFetchUrl(reciter: string, surah: number, quality: DownloadQuality = DEFAULT_DOWNLOAD_QUALITY): string {
  const r = reciterById(reciter);
  const bitrate = resolveAudioBitrate(reciter, quality);
  return AUDIO_PATH(bitrate, r.edition, surah);
}

/* ---------------- default values ---------------- */

export const DEFAULT_ACCENT: AccentId = 'teal';
export const DEFAULT_RECITER = 'ar.alafasy';
export const DEFAULT_ARABIC_SCALE = 28 / 26;

/** theme colour applied to the browser chrome */
export function accentHex(accent: AccentId, dark: boolean): string {
  const map: Record<AccentId, [string, string]> = {
    teal: ['#0d9488', '#2dd4bf'],
    emerald: ['#10b981', '#34d399'],
    amber: ['#d97706', '#fbbf24'],
    slate: ['#475569', '#94a3b8'],
    green: ['#16a34a', '#4ade80'],
    gold: ['#c08a1e', '#e3b341'],
    blue: ['#2563eb', '#60a5fa'],
    rose: ['#e11d48', '#fb7185'],
    purple: ['#7c3aed', '#a78bfa'],
    sapphire: ['#1e3a8a', '#3b82f6'],
  };
  return dark ? map[accent][1] : map[accent][0];
}
