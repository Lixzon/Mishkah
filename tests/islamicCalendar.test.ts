import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  getIslamicDate,
  getUpcomingIslamicEvents,
  HIJRI_MONTHS,
} from '../src/domain/islamicCalendar';

describe('offline Islamic calendar', () => {
  it('returns a valid Hijri date and calendar source', () => {
    const date = getIslamicDate('2026-03-20');
    assert.ok(date.year > 1400);
    assert.ok(date.month >= 1 && date.month <= 12);
    assert.ok(date.day >= 1 && date.day <= 30);
    assert.ok(date.calendar === 'islamic-umalqura' || date.calendar === 'islamic-civil');
    assert.equal(HIJRI_MONTHS.length, 12);
  });

  it('returns ordered, unique upcoming observances including today when applicable', () => {
    const first = getUpcomingIslamicEvents('2026-03-20');
    const second = getUpcomingIslamicEvents('2026-03-20');
    assert.deepEqual(first, second);
    assert.equal(first.length, 4);
    assert.ok(first.every((event) => event.daysUntil >= 0));
    assert.ok(first.every((event, index) => index === 0 || event.daysUntil > first[index - 1].daysUntil));
    assert.equal(new Set(first.map((event) => `${event.id}:${event.hijriYear}`)).size, first.length);
  });

  it('rejects invalid limits and malformed input dates', () => {
    assert.throws(() => getIslamicDate('not-a-date'), RangeError);
    assert.throws(() => getUpcomingIslamicEvents('2026-01-01', 0), RangeError);
  });
});
