import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EVENING_ADHKAR, HISN_AL_MUSLIM_DUAS, MORNING_ADHKAR, searchDuas } from '../src/domain/adhkar';
import { getDailyHadith, NAWAWI_FORTY, searchHadiths } from '../src/domain/hadith';
import {
  incrementDhikrCount,
  makeCustomDhikr,
  nextTasbeehCount,
  POST_SALAH_COUNTERS,
  resetPostSalahCounts,
  TASBEEH_PRESETS,
} from '../src/domain/tasbeeh';
import { computeUnlockedFeatures } from '../src/domain/streakRewards';
import { getContextualAnswer } from '../src/domain/assistant';

describe('offline worship library', () => {
  it('contains forty uniquely identified Nawawi teaching summaries', () => {
    assert.equal(NAWAWI_FORTY.length, 40);
    assert.equal(new Set(NAWAWI_FORTY.map((entry) => entry.id)).size, 40);
    assert.ok(NAWAWI_FORTY.every((entry) => entry.reference.includes('Al-Nawawi 40')));
  });

  it('searches hadith by teaching, chapter, and collection', () => {
    assert.ok(searchHadiths('intentions', 'nawawi40').some((entry) => entry.id === 'nawawi-1'));
    assert.ok(searchHadiths('gentleness', 'muslim').some((entry) => entry.id === 'muslim-gentleness'));
    assert.equal(searchHadiths('care for neighbors', 'bukhari')[0]?.id, 'bukhari-neighbor');
    assert.equal(searchHadiths('mercy others')[0]?.id, 'bukhari-mercy');
    assert.deepEqual(searchHadiths('no matching hadith'), []);
  });

  it('selects one stable daily card for a given date', () => {
    const date = new Date('2026-11-06T09:00:00.000Z');
    assert.deepEqual(getDailyHadith(date), getDailyHadith(date));
    assert.ok(getDailyHadith(date).reference.length > 0);
  });

  it('keeps the free daily Hadith rotation in Nawawi and unlocks Sahih selections at seven days', () => {
    const date = new Date('2026-11-06T09:00:00.000Z');
    assert.equal(getDailyHadith(date).collection, 'nawawi40');
    const extendedRotation = Array.from({ length: 48 }, (_, day) =>
      getDailyHadith(new Date(date.getTime() + day * 86_400_000), true),
    );
    assert.ok(extendedRotation.some((entry) => entry.collection !== 'nawawi40'));
    assert.equal(computeUnlockedFeatures(6).includes('extended-hadith'), false);
    assert.equal(computeUnlockedFeatures(7).includes('extended-hadith'), true);
    assert.equal(computeUnlockedFeatures(14).includes('premium-theme-collection'), true);
    assert.equal(computeUnlockedFeatures(21).includes('reciter-library'), true);
  });

  it('provides complete matching morning and evening routine entries', () => {
    assert.ok(MORNING_ADHKAR.length >= 8);
    assert.equal(EVENING_ADHKAR.length, MORNING_ADHKAR.length);
    assert.ok(MORNING_ADHKAR.every((entry) => entry.arabic && entry.transliteration && entry.meaning && entry.count > 0));
  });

  it('finds supplications by context and category', () => {
    assert.equal(searchDuas('journey')[0]?.id, 'dua-travel');
    assert.equal(searchDuas('', 'sleep').length, 2);
    assert.ok(HISN_AL_MUSLIM_DUAS.every((dua) => dua.reference && dua.context));
  });

  it('uses the requested tasbeeh targets and clamps progress', () => {
    assert.ok(TASBEEH_PRESETS.some((preset) => preset.category === 'post-salah' && preset.target === 33));
    assert.ok(TASBEEH_PRESETS.some((preset) => preset.category === 'forgiveness' && preset.target === 100));
    assert.equal(nextTasbeehCount(32, 33), 33);
    assert.equal(nextTasbeehCount(33, 33), 33);
    assert.equal(makeCustomDhikr('  Personal dhikr  ', 100, 1)?.label, 'Personal dhikr');
    assert.equal(makeCustomDhikr('', 100, 1), null);
  });

  it('keeps the five post-salah counters independent and preserves Astaghfirullah on prayer reset', () => {
    assert.deepEqual(POST_SALAH_COUNTERS.slice(0, 3).map((counter) => counter.target), [33, 33, 34]);
    assert.equal(incrementDhikrCount(33, 33), 33);
    assert.equal(incrementDhikrCount(1, null), 2);
    assert.deepEqual(
      resetPostSalahCounts({
        'post-salah-subhanallah': 33,
        'post-salah-alhamdulillah': 33,
        'post-salah-allahu-akbar': 34,
        'post-salah-astaghfirullah': 18,
        'post-salah-la-ilaha-illallah': 5,
      }),
      {
        'post-salah-subhanallah': 0,
        'post-salah-alhamdulillah': 0,
        'post-salah-allahu-akbar': 0,
        'post-salah-astaghfirullah': 18,
        'post-salah-la-ilaha-illallah': 0,
      },
    );
  });

  it('answers worship questions from the offline catalog and routes reciter help', () => {
    assert.match(getContextualAnswer('dua for travel').answer, /journey|return/i);
    assert.match(getContextualAnswer('open reciter library').answer, /21-day Furqan reading streak/);
    assert.match(getContextualAnswer('qibla direction').answer, /Guidance → Qibla/);
  });
});