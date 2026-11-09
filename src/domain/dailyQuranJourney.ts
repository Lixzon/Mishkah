import { STORIES, type Story } from './stories';

const JOURNEY_STORY_IDS = [
  'adam',
  'nuh',
  'ibrahim',
  'yusuf',
  'musa',
  'muhammad',
  'abu-bakr',
  'umar',
  'people-of-the-cave',
  'ashab-al-ukhdud',
  'dajjal',
  'yajuj-majuj',
] as const;

const REFLECTIONS: Record<(typeof JOURNEY_STORY_IDS)[number], string> = {
  adam: 'Adam’s story pairs a human mistake with sincere repentance. A wrong turn need not be your final direction; return to Allah and take the next right step.',
  nuh: 'Nuh called his people with patience over many years, but guidance is not ours to control. Keep doing good with care and leave the outcome to Allah.',
  ibrahim: 'Ibrahim questioned what could not bring lasting guidance and turned toward the Creator. Let revelation help you examine what you rely on.',
  yusuf: 'Yusuf’s long hardship did not erase his trust or his capacity to forgive. Patience can protect the heart without denying the pain.',
  musa: 'Musa faced fear while carrying a difficult responsibility. Trust in Allah can move alongside preparation and courageous action.',
  muhammad: 'The Qur’an describes the Prophet ﷺ as a mercy to the worlds. Let one act of gentle, fair treatment carry that mercy into today.',
  'abu-bakr': 'Abu Bakr is remembered as the companion who stayed beside the Prophet ﷺ in the cave. Generosity and loyalty can be quiet acts that strengthen others.',
  umar: 'The Qur’an calls believers to look ahead to what they send forward. Use today to make one fair choice and take responsibility for its effects.',
  'people-of-the-cave': 'The young people of the cave sought refuge to protect their faith. Courage can mean choosing good company and taking a wise step away from pressure.',
  'ashab-al-ukhdud': 'The Qur’an remembers believers who faced persecution and affirms that Allah witnessed what happened. When others suffer, choose solidarity and speak against cruelty.',
  dajjal: 'The Dajjal is a serious trial described in authentic reports, while the Qur’an offers no timeline or identity speculation. Hold close to sound knowledge and seek protection through worship.',
  'yajuj-majuj': 'The Qur’an tells of a barrier, an appointed release, and Allah’s promise, but does not name a modern location or date. Faith is strengthened by restraint as well as certainty.',
};

function dayIndex(date: Date): number {
  const utcDay = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
  return ((utcDay % JOURNEY_STORY_IDS.length) + JOURNEY_STORY_IDS.length) % JOURNEY_STORY_IDS.length;
}

export function getDailyQuranJourney(date = new Date()): { story: Story; reflection: string } {
  const id = JOURNEY_STORY_IDS[dayIndex(date)];
  const story = STORIES.find((entry) => entry.id === id);
  if (!story) throw new Error(`Daily Quran journey story "${id}" is missing from the story archive.`);
  return { story, reflection: REFLECTIONS[id] };
}
