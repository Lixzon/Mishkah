import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLocalAnswer } from '../src/domain/assistant';
import {
  DEFAULT_CITY_ID,
  DEFAULT_CITY_IDS,
  getCity,
  normalizePinnedCityIds,
  pinCity,
  searchCities,
  unpinCity,
} from '../src/domain/cities';
import {
  dateInTimeZone,
  getPrayerTimesForDate,
  isValidJumuahTime,
  localMinuteAt,
  nextPrayerAt,
  prayerTimeHasArrived,
  prayerTimeInstant,
  timeZoneOffsetAt,
} from '../src/domain/prayer';

describe('offline prayer calculations', () => {
  it('keeps Makkah prayer times in solar order', () => {
    const city = getCity('makkah');
    assert.ok(city);
    const times = getPrayerTimesForDate(city, '2026-03-20', 'MWL');

    assert.ok(times.Fajr < times.Sunrise);
    assert.ok(times.Sunrise < times.Dhuhr);
    assert.ok(times.Dhuhr < times.Asr);
    assert.ok(times.Asr < times.Maghrib);
    assert.ok(times.Maghrib < times.Isha);
    for (const minute of Object.values(times)) {
      assert.ok(Number.isInteger(minute) && minute >= 0 && minute < 1440);
    }
  });

  it('uses the correct London daylight-saving offsets', () => {
    const city = getCity('london');
    assert.ok(city);
    assert.equal(timeZoneOffsetAt('2026-01-15', city.timeZone), 0);
    assert.equal(timeZoneOffsetAt('2026-07-15', city.timeZone), 60);
  });

  it('formats an event using the city’s local clock and date', () => {
    const city = getCity('london');
    assert.ok(city);
    const localDate = '2026-07-15';
    const event = prayerTimeInstant(city, localDate, 13 * 60 + 15);
    assert.equal(dateInTimeZone(event, city.timeZone), localDate);
    assert.equal(localMinuteAt(event, city.timeZone), 13 * 60 + 15);
  });

  it('only unlocks a prayer checklist item once its local prayer time has arrived', () => {
    const beforePrayer = new Date('2026-03-20T05:59:00.000Z');
    const atPrayer = new Date('2026-03-20T06:00:00.000Z');

    assert.equal(prayerTimeHasArrived(360, beforePrayer, 'Europe/London'), false);
    assert.equal(prayerTimeHasArrived(360, atPrayer, 'Europe/London'), true);
    assert.equal(prayerTimeHasArrived(1445, atPrayer, 'Europe/London'), false);
  });

  it('preserves next-day prayer times during the midnight sun', () => {
    const city = getCity('reykjavik');
    assert.ok(city);
    const times = getPrayerTimesForDate(city, '2026-06-21');
    assert.ok(times.Fajr >= 0 && times.Fajr < times.Sunrise);
    assert.ok(times.Sunrise < times.Dhuhr);
    assert.ok(times.Dhuhr < times.Asr);
    assert.ok(times.Asr < times.Maghrib);
    assert.ok(times.Maghrib < times.Isha);
    assert.ok(times.Isha > 1440);
    assert.equal(
      dateInTimeZone(prayerTimeInstant(city, '2026-06-21', times.Maghrib), city.timeZone),
      '2026-06-22',
    );
  });

  it('uses a fixed Isha interval for Umm al-Qura', () => {
    const city = getCity('makkah');
    assert.ok(city);
    const times = getPrayerTimesForDate(city, '2026-03-20', 'Umm al-Qura');
    assert.equal(times.Isha - times.Maghrib, 90);
  });

  it('selects the next prayer today and carries Fajr into tomorrow', () => {
    const times = {
      Fajr: 360,
      Sunrise: 420,
      Dhuhr: 720,
      Asr: 900,
      Maghrib: 1080,
      Isha: 1200,
    };
    const afternoon = nextPrayerAt(
      times,
      new Date('2026-01-15T12:15:00.000Z'),
      'Europe/London',
    );
    assert.deepEqual(afternoon, { name: 'Asr', minutesUntil: 165 });

    const lateNight = nextPrayerAt(
      times,
      new Date('2026-01-15T23:00:00.000Z'),
      'Europe/London',
    );
    assert.deepEqual(lateNight, { name: 'Fajr', minutesUntil: 420 });
  });
});

describe('local Jumu\'ah time input', () => {
  it('accepts 24-hour times and rejects incomplete or out-of-range values', () => {
    assert.equal(isValidJumuahTime('00:00'), true);
    assert.equal(isValidJumuahTime('13:30'), true);
    assert.equal(isValidJumuahTime('23:59'), true);
    assert.equal(isValidJumuahTime('1:30'), false);
    assert.equal(isValidJumuahTime('24:00'), false);
    assert.equal(isValidJumuahTime('13:60'), false);
  });
});

describe('lazy city registry and pinned slots', () => {
  it('keeps Nigeria as the fixed first place and reserves four optional slots', () => {
    assert.equal(DEFAULT_CITY_ID, 'lagos');
    assert.deepEqual(DEFAULT_CITY_IDS, ['lagos']);
    assert.deepEqual(normalizePinnedCityIds(['makkah', 'lagos', 'london']), ['lagos', 'makkah', 'london']);
    assert.deepEqual(unpinCity(['lagos', 'makkah'], 'lagos'), ['lagos', 'makkah']);
    assert.deepEqual(unpinCity(['lagos', 'makkah'], 'makkah'), ['lagos']);
    const added = pinCity(['lagos'], 'cairo');
    assert.deepEqual(added, { status: 'added', cityIds: ['lagos', 'cairo'] });
  });

  it('looks up and searches the compressed city index on demand', () => {
    assert.equal(getCity('kuala-lumpur')?.timeZone, 'Asia/Kuala_Lumpur');
    assert.equal(searchCities('ghana')[0]?.id, 'accra');
    assert.deepEqual(searchCities('not-a-city'), []);
  });

  it('enforces the five-city capacity without changing existing pins', () => {
    const fourPins = ['lagos', 'london', 'jakarta', 'cairo'];
    const fifth = pinCity(fourPins, 'paris');
    assert.equal(fifth.status, 'added');
    if (fifth.status !== 'added') {
      return;
    }
    assert.equal(fifth.cityIds.length, 5);
    const overflow = pinCity(fifth.cityIds, 'tokyo');
    assert.equal(overflow.status, 'capacity-reached');
    assert.deepEqual(overflow.cityIds, fifth.cityIds);
    assert.deepEqual(unpinCity(overflow.cityIds, 'cairo'), [
      'lagos',
      'london',
      'jakarta',
      'paris',
    ]);
  });

  it('does not duplicate a pinned city', () => {
    const result = pinCity(['lagos', 'london'], 'london');
    assert.equal(result.status, 'already-pinned');
    assert.deepEqual(result.cityIds, ['lagos', 'london']);
  });
});

describe('offline spiritual guide', () => {
  it('answers from its local FAQ without a remote lookup', () => {
    assert.match(getLocalAnswer('How are my prayer times calculated?').answer, /on this device/);
    assert.match(getLocalAnswer('What if I am unsure about a fasting rule?').answer, /trusted local scholar/);
    assert.match(getLocalAnswer('Can I rely on this as a religious ruling?').answer, /not a fatwa/i);
    assert.match(getLocalAnswer('an unfamiliar question').answer, /on this device/);
  });
});
