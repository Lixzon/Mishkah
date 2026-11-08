import { addCalendarDays } from './prayer';

export interface IslamicDate {
  year: number;
  month: number;
  day: number;
  calendar: 'islamic-umalqura' | 'islamic-civil';
}

export interface IslamicEvent {
  id: string;
  title: string;
  hijriMonth: number;
  hijriDay: number;
}

export interface UpcomingIslamicEvent extends IslamicEvent {
  date: string;
  daysUntil: number;
  hijriYear: number;
}

export const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  'Rabi al-Awwal',
  'Rabi al-Thani',
  'Jumada al-Awwal',
  'Jumada al-Thani',
  'Rajab',
  'Sha’ban',
  'Ramadan',
  'Shawwal',
  'Dhu al-Qi’dah',
  'Dhu al-Hijjah',
] as const;

export const ISLAMIC_EVENTS: readonly IslamicEvent[] = [
  { id: 'islamic-new-year', title: 'Islamic New Year', hijriMonth: 1, hijriDay: 1 },
  { id: 'ashura', title: 'Day of Ashura', hijriMonth: 1, hijriDay: 10 },
  { id: 'ramadan', title: 'Ramadan begins', hijriMonth: 9, hijriDay: 1 },
  { id: 'eid-al-fitr', title: 'Eid al-Fitr', hijriMonth: 10, hijriDay: 1 },
  { id: 'day-of-arafah', title: 'Day of Arafah', hijriMonth: 12, hijriDay: 9 },
  { id: 'eid-al-adha', title: 'Eid al-Adha', hijriMonth: 12, hijriDay: 10 },
];

const FORMATTERS = (['islamic-umalqura', 'islamic-civil'] as const)
  .flatMap((calendar) => {
    try {
      return [[calendar, new Intl.DateTimeFormat(`en-u-ca-${calendar}-nu-latn`, {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
      })] as const];
    } catch {
      return [];
    }
  });

function hijriParts(localDate: string, calendar: IslamicDate['calendar']): IslamicDate {
  const formatter = FORMATTERS.find(([id]) => id === calendar)?.[1];
  if (!formatter) throw new Error(`The ${calendar} calendar is not available in this runtime.`);
  const [year, month, day] = localDate.split('-').map(Number);
  const parts = formatter.formatToParts(new Date(Date.UTC(year, month - 1, day, 12)));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const hijriYear = Number(values.year);
  const hijriMonth = Number(values.month);
  const hijriDay = Number(values.day);
  if (![hijriYear, hijriMonth, hijriDay].every(Number.isInteger) || hijriMonth < 1 || hijriMonth > 12) {
    throw new Error('The runtime returned an invalid Hijri date.');
  }
  return { year: hijriYear, month: hijriMonth, day: hijriDay, calendar };
}

export function getIslamicDate(localDate: string): IslamicDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) throw new RangeError('A valid Gregorian date in YYYY-MM-DD format is required.');
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    !year ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new RangeError('A valid Gregorian date in YYYY-MM-DD format is required.');
  }
  for (const [calendar] of FORMATTERS) {
    try {
      return hijriParts(localDate, calendar);
    } catch {
      continue;
    }
  }
  throw new Error('No supported Islamic calendar is available in this runtime.');
}

export function getUpcomingIslamicEvents(localDate: string, limit = 4): UpcomingIslamicEvent[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > ISLAMIC_EVENTS.length) {
    throw new RangeError(`The event limit must be between 1 and ${ISLAMIC_EVENTS.length}.`);
  }
  const upcoming: UpcomingIslamicEvent[] = [];
  const seen = new Set<string>();
  const currentYear = getIslamicDate(localDate).year;

  for (let daysUntil = 0; daysUntil <= 370 && upcoming.length < limit; daysUntil += 1) {
    const date = addCalendarDays(localDate, daysUntil);
    const hijri = getIslamicDate(date);
    const event = ISLAMIC_EVENTS.find(
      (candidate) => candidate.hijriMonth === hijri.month && candidate.hijriDay === hijri.day,
    );
    if (!event) continue;
    const eventKey = `${event.id}:${hijri.year}`;
    if (seen.has(eventKey)) continue;
    seen.add(eventKey);
    upcoming.push({ ...event, hijriYear: hijri.year, date, daysUntil });
  }

  if (upcoming.length < limit) {
    throw new Error(`Could only find ${upcoming.length} upcoming Islamic calendar events from Hijri year ${currentYear}.`);
  }
  return upcoming;
}
