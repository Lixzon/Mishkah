export const DAILY_QURAN_JOURNEY_IDS = [
  'adam',
  'nuh',
  'ibrahim',
  'yusuf',
  'musa',
  'muhammad',
  'abu-bakr',
  'umar',
  'people-of-the-cave',
  'ashab-al-ukhdud',
  'dajjal',
  'yajuj-majuj',
] as const;

export type DailyQuranJourneyId = (typeof DAILY_QURAN_JOURNEY_IDS)[number];

export interface QuranScheduleDay {
  dateKey: string;
  globalAyah: number;
  surah: number;
  ayah: number;
  journeyId: DailyQuranJourneyId;
}

export function utcDateKey(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError('The Quran schedule date must be valid.');
  return date.toISOString().slice(0, 10);
}

const DAY_MS = 86_400_000;
const TOTAL_AYAH_COUNT = 6236;
const KAHF_START_GLOBAL_AYAH = 2141;
const KAHF_AYAH_COUNT = 110;
const NON_FRIDAY_SEED = 0x46555251;
const FRIDAY_SEED = 0x4b414846;

const SURAH_AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110,
  98, 135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88,
  75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24,
  13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
  29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3,
  9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6,
];

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function shuffled(values: number[], seed: number): number[] {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };

  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

const FRIDAY_AYAH_POOL = shuffled(
  Array.from({ length: KAHF_AYAH_COUNT }, (_, index) => KAHF_START_GLOBAL_AYAH + index),
  FRIDAY_SEED,
);
// Separate shuffled pools keep every verse unique throughout any 366-day range.
const NON_FRIDAY_AYAH_POOL = shuffled(
  Array.from({ length: TOTAL_AYAH_COUNT }, (_, index) => index + 1)
    .filter((globalAyah) =>
      globalAyah < KAHF_START_GLOBAL_AYAH ||
      globalAyah >= KAHF_START_GLOBAL_AYAH + KAHF_AYAH_COUNT),
  NON_FRIDAY_SEED,
);

function utcDayIndex(date: Date): number {
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 100) {
    throw new RangeError('The Quran schedule requires a valid date from year 100 onward.');
  }
  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / DAY_MS);
}

export function getQuranReference(globalAyah: number): { surah: number; ayah: number } {
  if (!Number.isInteger(globalAyah) || globalAyah < 1 || globalAyah > TOTAL_AYAH_COUNT) {
    throw new RangeError('The global Quran ayah number is out of range.');
  }

  let remaining = globalAyah;
  for (let index = 0; index < SURAH_AYAH_COUNTS.length; index += 1) {
    if (remaining <= SURAH_AYAH_COUNTS[index]) return { surah: index + 1, ayah: remaining };
    remaining -= SURAH_AYAH_COUNTS[index];
  }
  throw new Error('The Quran reference could not be resolved.');
}

export function getDailyQuranSchedule(date = new Date()): QuranScheduleDay {
  const dayIndex = utcDayIndex(date);
  const previousFridays = Math.floor((dayIndex + 5) / 7);
  const isFriday = date.getUTCDay() === 5;
  const globalAyah = isFriday
    ? FRIDAY_AYAH_POOL[positiveModulo(previousFridays, FRIDAY_AYAH_POOL.length)]
    : NON_FRIDAY_AYAH_POOL[
        positiveModulo(dayIndex - previousFridays, NON_FRIDAY_AYAH_POOL.length)
      ];

  return {
    dateKey: utcDateKey(date),
    globalAyah,
    ...getQuranReference(globalAyah),
    journeyId: DAILY_QURAN_JOURNEY_IDS[positiveModulo(dayIndex, DAILY_QURAN_JOURNEY_IDS.length)],
  };
}

export function getQuranScheduleRange(startDate: Date, dayCount = 365): QuranScheduleDay[] {
  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 366) {
    throw new RangeError('A Quran schedule range must contain between 1 and 366 days.');
  }
  const firstDay = utcDayIndex(startDate);
  return Array.from({ length: dayCount }, (_, index) =>
    getDailyQuranSchedule(new Date((firstDay + index) * DAY_MS)),
  );
}

export function getQuranYearSchedule(year: number): QuranScheduleDay[] {
  if (!Number.isInteger(year) || year < 100 || year > 9998) {
    throw new RangeError('The Quran schedule year is out of range.');
  }
  const start = Date.UTC(year, 0, 1);
  const nextStart = Date.UTC(year + 1, 0, 1);
  return getQuranScheduleRange(new Date(start), (nextStart - start) / DAY_MS);
}
