import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ISLAMIC_ARCHIVE, searchIslamicArchive } from '../src/domain/archives';

describe('source-linked Islamic archive', () => {
  it('has unique entries with secure primary-source links', () => {
    assert.equal(new Set(ISLAMIC_ARCHIVE.map((entry) => entry.id)).size, ISLAMIC_ARCHIVE.length);
    for (const entry of ISLAMIC_ARCHIVE) {
      assert.ok(entry.summary.length > 30);
      assert.ok(entry.sources.length > 0);
      for (const source of entry.sources) {
        assert.equal(new URL(source.url).protocol, 'https:');
      }
    }
  });

  it('filters entries by topic and category', () => {
    assert.deepEqual(searchIslamicArchive('cave', 'Stories').map((entry) => entry.id), ['people-of-cave']);
    assert.deepEqual(searchIslamicArchive('Abu Bakr', 'Companions').map((entry) => entry.id), ['abu-bakr-cave']);
    assert.deepEqual(searchIslamicArchive('not a matching topic'), []);
  });
});
