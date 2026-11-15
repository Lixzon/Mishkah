import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getDailyQuranSchedule,
  getQuranReference,
  getQuranScheduleRange,
  getQuranYearSchedule,
} from '../src/data/quranSchedule';

describe('daily Quran schedule', () => {
  it('creates a repeat-free year with Friday readings from Al-Kahf', () => {
    const schedule = getQuranYearSchedule(2027);

    assert.equal(schedule.length, 365);
    assert.equal(new Set(schedule.map((day) => day.globalAyah)).size, schedule.length);
    for (const day of schedule) {
      const weekday = new Date(`${day.dateKey}T12:00:00.000Z`).getUTCDay();
      assert.equal(day.surah === 18, weekday === 5, `${day.dateKey} should follow the Friday rule`);
    }
  });

  it('keeps every verse unique across a rolling leap-year-sized window', () => {
    const schedule = getQuranScheduleRange(new Date('2026-11-15T00:00:00.000Z'), 366);
    assert.equal(new Set(schedule.map((day) => day.globalAyah)).size, 366);
  });

  it('uses UTC dates and resolves global ayah numbers to the Quran reference', () => {
    const lateUtc = getDailyQuranSchedule(new Date('2026-11-15T23:30:00.000Z'));
    const earlyUtc = getDailyQuranSchedule(new Date('2026-11-15T00:30:00.000Z'));

    assert.equal(lateUtc.globalAyah, earlyUtc.globalAyah);
    assert.deepEqual(getQuranReference(2141), { surah: 18, ayah: 1 });
    assert.deepEqual(getQuranReference(6236), { surah: 114, ayah: 6 });
  });
});
