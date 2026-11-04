import type { City } from './cities';

export type PrayerName = 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';
export type CalculationMethod = 'MWL' | 'ISNA' | 'Egyptian' | 'Umm al-Qura';

export const CALCULATION_METHODS: readonly CalculationMethod[] = [
  'MWL',
  'ISNA',
  'Egyptian',
  'Umm al-Qura',
];

const METHOD_ANGLES: Record<
  CalculationMethod,
  { fajr: number; isha: number; ishaIntervalMinutes?: number }
> = {
  MWL: { fajr: 18, isha: 17 },
  ISNA: { fajr: 15, isha: 15 },
  Egyptian: { fajr: 19.5, isha: 17.5 },
  'Umm al-Qura': { fajr: 18.5, isha: 18.5, ishaIntervalMinutes: 90 },
};

const SOLAR_ALTITUDE = -0.833;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export type PrayerTimes = Record<PrayerName, number>;

export function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    throw new Error(`Could not determine the local date for ${timeZone}.`);
  }
  return `${year}-${month}-${day}`;
}

export function addCalendarDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

export function timeZoneOffsetAt(localDate: string, timeZone: string): number {
  const [year, month, day] = localDate.split('-').map(Number);
  const utcNoon = Date.UTC(year, month - 1, day, 12);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(utcNoon));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const localAtUtcNoon = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
  );
  return Math.round((localAtUtcNoon - utcNoon) / 60_000);
}

function dayOfYear(year: number, month: number, day: number): number {
  return Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86_400_000);
}

function solarPosition(dayNumber: number): { declination: number; equationOfTime: number } {
  const angle = (2 * Math.PI * (dayNumber - 1)) / 365.2422;
  const declination =
    0.006918 -
    0.399912 * Math.cos(angle) +
    0.070257 * Math.sin(angle) -
    0.006758 * Math.cos(2 * angle) +
    0.000907 * Math.sin(2 * angle) -
    0.002697 * Math.cos(3 * angle) +
    0.00148 * Math.sin(3 * angle);
  const equationOfTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(angle) -
      0.032077 * Math.sin(angle) -
      0.014615 * Math.cos(2 * angle) -
      0.040849 * Math.sin(2 * angle));
  return { declination, equationOfTime };
}

function hourAngle(latitude: number, declination: number, altitude: number): number | undefined {
  const latitudeRad = latitude * DEG_TO_RAD;
  const cosHourAngle =
    (Math.sin(altitude * DEG_TO_RAD) -
      Math.sin(latitudeRad) * Math.sin(declination)) /
    (Math.cos(latitudeRad) * Math.cos(declination));
  if (!Number.isFinite(cosHourAngle) || cosHourAngle < -1 || cosHourAngle > 1) {
    return undefined;
  }
  return Math.acos(cosHourAngle) * RAD_TO_DEG;
}

export function getPrayerTimesForDate(
  city: City,
  localDate: string,
  method: CalculationMethod = 'MWL',
): PrayerTimes {
  const [year, month, day] = localDate.split('-').map(Number);
  const { declination, equationOfTime } = solarPosition(dayOfYear(year, month, day));
  const offset = timeZoneOffsetAt(localDate, city.timeZone);
  const solarNoon = 720 - 4 * city.longitude - equationOfTime + offset;
  const sunriseAngle = hourAngle(city.latitude, declination, SOLAR_ALTITUDE);
  const sunsetAngle = sunriseAngle;
  const daylightHalf = sunriseAngle === undefined ? 360 : sunriseAngle * 4;
  const sunrise = solarNoon - daylightHalf;
  const sunset = solarNoon + daylightHalf;
  const nightLength = 1440 - daylightHalf * 2;
  const fajrAngle = hourAngle(city.latitude, declination, -METHOD_ANGLES[method].fajr);
  const ishaAngle = hourAngle(city.latitude, declination, -METHOD_ANGLES[method].isha);
  const highLatitudeShare = 1 / 7;
  const fajr = fajrAngle === undefined
    ? sunrise - nightLength * highLatitudeShare
    : solarNoon - fajrAngle * 4;
  const isha = METHOD_ANGLES[method].ishaIntervalMinutes !== undefined
    ? sunset + METHOD_ANGLES[method].ishaIntervalMinutes
    : ishaAngle === undefined
      ? sunset + nightLength * highLatitudeShare
      : solarNoon + ishaAngle * 4;

  const asrAltitude =
    Math.atan(
      1 /
        (1 +
          Math.tan(Math.abs(city.latitude * DEG_TO_RAD - declination))),
    ) * RAD_TO_DEG;
  const asrAngle = hourAngle(city.latitude, declination, asrAltitude);

  return {
    Fajr: Math.round(fajr),
    Sunrise: Math.round(sunrise),
    Dhuhr: Math.round(solarNoon + 1),
    Asr: Math.round(solarNoon + (asrAngle ?? daylightHalf / 4) * 4),
    Maghrib: Math.round(sunset),
    Isha: Math.round(isha),
  };
}

export function getPrayerTimes(
  city: City,
  date: Date = new Date(),
  method: CalculationMethod = 'MWL',
): PrayerTimes {
  return getPrayerTimesForDate(city, dateInTimeZone(date, city.timeZone), method);
}

export function prayerTimeInstant(city: City, localDate: string, minute: number): Date {
  const [year, month, day] = localDate.split('-').map(Number);
  const offset = timeZoneOffsetAt(localDate, city.timeZone);
  return new Date(Date.UTC(year, month - 1, day) + (minute - offset) * 60_000);
}

export function localMinuteAt(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return hour * 60 + minute;
}

export function formatPrayerTime(minute: number, city: City, localDate: string): string {
  const instant = prayerTimeInstant(city, localDate, minute);
  return new Intl.DateTimeFormat(undefined, {
    timeZone: city.timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(instant);
}

export function nextPrayerAt(
  times: PrayerTimes,
  now: Date,
  timeZone: string,
): { name: PrayerName; minutesUntil: number } {
  const currentMinute = localMinuteAt(now, timeZone);
  const nextName = (['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const).find(
    (name) => times[name] >= currentMinute,
  );

  if (nextName) {
    return { name: nextName, minutesUntil: times[nextName] - currentMinute };
  }
  return {
    name: 'Fajr',
    minutesUntil: times.Fajr + 1440 - currentMinute,
  };
}
