import assert from 'node:assert/strict';
import test from 'node:test';
import { getQiblaBearing, normalizeHeading, relativeQiblaHeading } from '../src/domain/qibla';

test('Qibla bearing', async (t) => {
  await t.test('calculates the initial bearing from London toward the Kaaba', () => {
    const bearing = getQiblaBearing(51.5072, -0.1276);
    assert.ok(bearing > 118 && bearing < 121, `Expected a London bearing near 119°, received ${bearing}°`);
  });

  await t.test('normalizes compass angles and relative headings across north', () => {
    assert.equal(normalizeHeading(-10), 350);
    assert.equal(relativeQiblaHeading(10, 350), 20);
    assert.equal(relativeQiblaHeading(350, 10), 340);
  });

  await t.test('rejects invalid coordinates', () => {
    assert.throws(() => getQiblaBearing(91, 0), RangeError);
    assert.throws(() => getQiblaBearing(0, Number.NaN), RangeError);
  });
});
