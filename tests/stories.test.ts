import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STORIES,
  STORY_SECTIONS,
  searchStories,
  storiesInSection,
} from '../src/domain/stories';

describe('story library', () => {
  it('keeps ids unique and every section populated', () => {
    assert.equal(new Set(STORIES.map((story) => story.id)).size, STORIES.length);
    for (const section of STORY_SECTIONS) {
      assert.ok(storiesInSection(section.id).length > 0, `${section.id} should have stories`);
    }
  });

  it('orders the twenty-five prophets from Adam to Muhammad', () => {
    const prophets = storiesInSection('prophets');
    assert.equal(prophets.length, 25);
    assert.deepEqual(prophets.map((story) => story.order), Array.from({ length: 25 }, (_, index) => index + 1));
    assert.equal(prophets[0].id, 'adam');
    assert.equal(prophets[24].id, 'muhammad');
  });

  it('gives every story a short and a long reading', () => {
    for (const story of STORIES) {
      assert.ok(story.short.length >= 80, `${story.id} short version is too thin`);
      assert.ok(story.long.length >= 1, `${story.id} needs a long version`);
      assert.ok(story.long.join(' ').length > story.short.length, `${story.id} long version should exceed the short`);
    }
  });

  it('only links to secure video URLs', () => {
    for (const story of STORIES.filter((entry) => entry.video)) {
      assert.equal(new URL(story.video!.url).protocol, 'https:');
    }
  });

  it('finds stories by name and by section', () => {
    assert.ok(searchStories('yusuf').some((story) => story.id === 'yusuf'));
    assert.deepEqual(searchStories('bilal').map((story) => story.id), ['bilal']);
    assert.deepEqual(searchStories('dajjal', 'signs').map((story) => story.id), ['dajjal']);
    assert.deepEqual(searchStories('nothing matches this'), []);
  });
});
