import { getDailyQuranSchedule } from './quranSchedule';

export interface JourneyPassage {
  surah: number;
  from: number;
  to?: number;
}

export interface DailyQuranJourney {
  id: string;
  title: string;
  passages: readonly JourneyPassage[];
  reflection: string;
}

export const DAILY_QURAN_JOURNEY: readonly DailyQuranJourney[] = [
  {
    id: 'adam',
    title: 'Adam',
    passages: [{ surah: 2, from: 30, to: 39 }, { surah: 7, from: 19, to: 27 }, { surah: 20, from: 115, to: 123 }],
    reflection: 'Adam’s story pairs a human mistake with sincere repentance. A wrong turn need not be your final direction; return to Allah and take the next right step.',
  },
  {
    id: 'nuh',
    title: 'Nuh',
    passages: [{ surah: 11, from: 25, to: 48 }, { surah: 71, from: 1, to: 28 }, { surah: 23, from: 23, to: 30 }],
    reflection: 'Nuh called his people with patience over many years, but guidance is not ours to control. Keep doing good with care and leave the outcome to Allah.',
  },
  {
    id: 'ibrahim',
    title: 'Ibrahim',
    passages: [{ surah: 21, from: 51, to: 70 }, { surah: 6, from: 74, to: 83 }, { surah: 37, from: 99, to: 113 }],
    reflection: 'Ibrahim questioned what could not bring lasting guidance and turned toward the Creator. Let revelation help you examine what you rely on.',
  },
  {
    id: 'yusuf',
    title: 'Yusuf',
    passages: [{ surah: 12, from: 1, to: 111 }],
    reflection: 'Yusuf’s long hardship did not erase his trust or his capacity to forgive. Patience can protect the heart without denying the pain.',
  },
  {
    id: 'musa',
    title: 'Musa',
    passages: [{ surah: 20, from: 1, to: 98 }, { surah: 28, from: 3, to: 43 }, { surah: 26, from: 10, to: 68 }],
    reflection: 'Musa faced fear while carrying a difficult responsibility. Trust in Allah can move alongside preparation and courageous action.',
  },
  {
    id: 'muhammad',
    title: 'Muhammad ﷺ',
    passages: [{ surah: 33, from: 40, to: 46 }, { surah: 21, from: 107 }, { surah: 68, from: 1, to: 7 }],
    reflection: 'The Qur’an describes the Prophet ﷺ as a mercy to the worlds. Let one act of gentle, fair treatment carry that mercy into today.',
  },
  {
    id: 'abu-bakr',
    title: 'Abu Bakr as-Siddiq',
    passages: [{ surah: 9, from: 40 }, { surah: 92, from: 5, to: 21 }],
    reflection: 'Abu Bakr is remembered as the companion who stayed beside the Prophet ﷺ in the cave. Generosity and loyalty can be quiet acts that strengthen others.',
  },
  {
    id: 'umar',
    title: '‘Umar ibn al-Khattab',
    passages: [{ surah: 59, from: 18 }],
    reflection: 'The Qur’an calls believers to look ahead to what they send forward. Use today to make one fair choice and take responsibility for its effects.',
  },
  {
    id: 'people-of-the-cave',
    title: 'The people of the cave',
    passages: [{ surah: 18, from: 9, to: 26 }],
    reflection: 'The young people of the cave sought refuge to protect their faith. Courage can mean choosing good company and taking a wise step away from pressure.',
  },
  {
    id: 'ashab-al-ukhdud',
    title: 'The people of the trench',
    passages: [{ surah: 85, from: 4, to: 11 }],
    reflection: 'The Qur’an remembers believers who faced persecution and affirms that Allah witnessed what happened. When others suffer, choose solidarity and speak against cruelty.',
  },
  {
    id: 'dajjal',
    title: 'The Dajjal',
    passages: [{ surah: 18, from: 83, to: 98 }],
    reflection: 'The Dajjal is a serious trial described in authentic reports, while the Qur’an offers no timeline or identity speculation. Hold close to sound knowledge and seek protection through worship.',
  },
  {
    id: 'yajuj-majuj',
    title: 'Ya’juj and Ma’juj',
    passages: [{ surah: 18, from: 92, to: 98 }, { surah: 21, from: 96, to: 97 }],
    reflection: 'The Qur’an tells of a barrier, an appointed release, and Allah’s promise, but does not name a modern location or date. Faith is strengthened by restraint as well as certainty.',
  },
];

export function getDailyQuranJourney(date = new Date()): DailyQuranJourney {
  const journey = DAILY_QURAN_JOURNEY.find((entry) => entry.id === getDailyQuranSchedule(date).journeyId);
  if (!journey) throw new Error('The selected daily Quran journey is missing.');
  return journey;
}
