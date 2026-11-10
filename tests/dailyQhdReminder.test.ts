import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DAILY_QHD_THEMES,
  getDailyQhdReminder,
  getDailyQhdTheme,
} from '../src/domain/dailyQhdReminder';

describe('daily themed QHD reminders', () => {
  it('uses the same UTC calendar date for paired daily verses', () => {
    const lateUtcDay = new Date('2026-01-01T23:30:00.000Z');
    const nextUtcDay = new Date('2026-01-02T00:30:00.000Z');

    assert.equal(getDailyQhdTheme(lateUtcDay).id, DAILY_QHD_THEMES[0].id);
    assert.equal(getDailyQhdTheme(nextUtcDay).id, DAILY_QHD_THEMES[1].id);
  });

  it('rotates through seven distinct themes in order', () => {
    const dates = Array.from({ length: 7 }, (_, day) => new Date(Date.UTC(2026, 0, day + 1, 12)));
    const selected = dates.map((date) => getDailyQhdTheme(date).id);

    assert.deepEqual(selected, DAILY_QHD_THEMES.map((theme) => theme.id));
    assert.equal(new Set(selected).size, 7);
    assert.equal(getDailyQhdTheme(new Date(Date.UTC(2026, 0, 8, 12))).id, selected[0]);
  });

  it('provides a matching referenced Hadith and du’a for every theme', () => {
    const checked = DAILY_QHD_THEMES.map((theme, index) => {
      const { hadith, dua } = getDailyQhdReminder(new Date(Date.UTC(2026, 0, index + 1, 12)));
      return { theme, hadith, dua };
    });

    for (const { theme, hadith, dua } of checked) {
      assert.equal(hadith.id, theme.hadithId);
      assert.ok(hadith.reference.trim().length > 0);
      assert.equal(dua.id, theme.duaId);
      assert.ok(dua.reference.trim().length > 0);
      assert.ok(theme.globalAyah > 0);
      assert.ok(theme.surah > 0);
      assert.ok(theme.ayah > 0);
    }
  });
});
