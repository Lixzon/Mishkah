import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STORIES,
  STORY_SECTIONS,
  searchStories,
  storiesInSection,
} from '../src/domain/stories';
import { getDailyQuranJourney } from '../src/domain/dailyQuranJourney';

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

  it('keeps the guided journey stable per UTC day and rotates through Quran-linked stories', () => {
    const first = new Date('2026-11-09T00:15:00Z');
    const sameUtcDay = new Date('2026-11-09T23:45:00Z');
    assert.equal(getDailyQuranJourney(first).story.id, getDailyQuranJourney(sameUtcDay).story.id);

    const journeys = Array.from({ length: 12 }, (_, day) =>
      getDailyQuranJourney(new Date(first.getTime() + day * 86_400_000)),
    );
    assert.equal(new Set(journeys.map(({ story }) => story.id)).size, 12);
    for (const { story, reflection } of journeys) {
      assert.ok(story.quranRefs.length > 0, `${story.id} should link to Qur’an passages`);
      assert.ok(story.long.length > 0, `${story.id} should have a long reading`);
      assert.ok(reflection.length > 80, `${story.id} should include a short reflection reading`);
    }
  });
});
