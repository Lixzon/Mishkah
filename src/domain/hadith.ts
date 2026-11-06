export type HadithCollection = 'nawawi40' | 'bukhari' | 'muslim';

export interface HadithEntry {
  id: string;
  collection: HadithCollection;
  title: string;
  summary: string;
  reference: string;
  chapter: string;
}

const NAWAWI_SUMMARIES: readonly [string, string, string, string][] = [
  ['Actions and intentions', 'Deeds are judged by the intentions behind them.', 'Bukhari 1; Muslim 1907', 'Intention'],
  ['The foundations of faith', 'Faith, Islam, and excellence are explained through the questions of Jibril.', 'Muslim 8', 'Faith'],
  ['The pillars of Islam', 'Islam is built upon testimony, prayer, zakat, fasting, and pilgrimage.', 'Bukhari 8; Muslim 16', 'Worship'],
  ['Creation and decree', 'The hadith describes human development and the importance of a faithful ending.', 'Bukhari 3208; Muslim 2643', 'Faith'],
  ['Accepted worship', 'An introduced act of worship that has no basis in the religion is rejected.', 'Muslim 1718', 'Worship'],
  ['Clear and doubtful matters', 'Lawful and unlawful matters are clear, while doubtful matters deserve care.', 'Bukhari 52; Muslim 1599', 'Character'],
  ['Sincere counsel', 'Religion includes sincere counsel to God, revelation, messengers, leaders, and the community.', 'Muslim 55', 'Community'],
  ['The sanctity of Muslim life', 'The testimony of faith, prayer, and zakat establish protected rights in this narration.', 'Bukhari 25; Muslim 22', 'Community'],
  ['Avoid what is forbidden', 'Avoid prohibitions and fulfill obligations; do not burden faith with needless questioning.', 'Bukhari 7288; Muslim 1337', 'Worship'],
  ['Allah accepts what is good', 'Allah is good and accepts what is good; believers are called to seek wholesome provision.', 'Muslim 1015', 'Character'],
  ['Leave what causes doubt', 'Leave what troubles your certainty for what you can recognize as sound.', 'Tirmidhi 2518; Nasa’i 5711', 'Character'],
  ['Leave what does not concern you', 'A sign of good Islam is leaving matters that do not concern a person.', 'Tirmidhi 2318', 'Character'],
  ['Love for others', 'Faith is incomplete until one wishes good for others as one wishes it for oneself.', 'Bukhari 13; Muslim 45', 'Community'],
  ['The inviolability of life', 'A person’s life is protected except under the specific legal cases named in the narration.', 'Bukhari 6878; Muslim 1676', 'Community'],
  ['Speak well or keep silent', 'Honor neighbors and guests, and choose good speech or silence.', 'Bukhari 6018; Muslim 47', 'Character'],
  ['Do not give in to anger', 'When asked for advice, the Prophet repeatedly counseled against anger.', 'Bukhari 6116', 'Character'],
  ['Excellence in every action', 'Allah prescribed excellence in all things, including the treatment of animals.', 'Muslim 1955', 'Character'],
  ['Mindfulness and good character', 'Be mindful of Allah wherever you are, follow wrong with good, and treat people well.', 'Tirmidhi 1987', 'Character'],
  ['Remember Allah', 'Guard your duties to Allah and seek His help; what reaches a person is within His knowledge.', 'Tirmidhi 2516', 'Faith'],
  ['Modesty', 'Modesty is a branch of faith and supports a person’s moral life.', 'Bukhari 24; Muslim 36', 'Character'],
  ['Steadfast belief', 'Believe in Allah and then remain upright.', 'Muslim 38', 'Faith'],
  ['A path to Paradise', 'Fulfilling obligatory worship and avoiding what is forbidden is a path to Paradise.', 'Muslim 15', 'Worship'],
  ['Purification and remembrance', 'Purification is part of faith; prayer, charity, patience, and remembrance illuminate a believer’s life.', 'Muslim 223', 'Worship'],
  ['Divine prohibition of injustice', 'Allah forbids injustice and calls people to seek His guidance, provision, and forgiveness.', 'Muslim 2577', 'Faith'],
  ['Many forms of charity', 'Remembrance, good counsel, and lawful intimacy can all be acts of charity.', 'Muslim 1006', 'Worship'],
  ['Every good deed is charity', 'Each joint owes charity daily, including reconciliation, kind words, and walking to prayer.', 'Bukhari 2989; Muslim 1009', 'Character'],
  ['Righteousness and wrongdoing', 'Righteousness brings reassurance, while wrongdoing unsettles the heart.', 'Muslim 2553', 'Character'],
  ['Hold to the Prophetic way', 'When disagreements arise, hold to the Prophetic way and the way of the rightly guided successors.', 'Abu Dawud 4607; Tirmidhi 2676', 'Faith'],
  ['The road to goodness', 'Prayer, fasting, and charity are among the gates of goodness; guarding the tongue is essential.', 'Tirmidhi 2616', 'Worship'],
  ['Respect the limits', 'Observe obligations, avoid prohibitions, and do not overstep the limits set by Allah.', 'Daraqutni 4:183', 'Worship'],
  ['Renunciation and contentment', 'Do not be consumed by worldly competition, and do not envy what others possess.', 'Tirmidhi 2317', 'Character'],
  ['No harm or retaliation', 'Do not cause harm or answer harm with harm.', 'Ibn Majah 2340', 'Community'],
  ['Evidence and claims', 'Evidence is required from the claimant, while an oath is required from the one who denies.', 'Bukhari 4552; Muslim 1711', 'Justice'],
  ['Changing wrongdoing', 'Respond to wrongdoing according to ability, beginning with action, then speech, then rejection in the heart.', 'Muslim 49', 'Community'],
  ['Brotherhood and justice', 'Do not wrong, abandon, or demean one another; God-consciousness is in the heart.', 'Muslim 2564', 'Community'],
  ['Easing another’s hardship', 'Whoever eases a believer’s hardship will find that Allah eases hardship for them.', 'Muslim 2699', 'Community'],
  ['The value of intention', 'Allah records good intentions and deeds generously, while wrongdoing is not multiplied.', 'Bukhari 6491; Muslim 131', 'Faith'],
  ['The friends of Allah', 'Those who uphold faith and devotion are described as beloved to Allah.', 'Bukhari 6502', 'Faith'],
  ['Mercy for mistakes', 'Mistakes, forgetfulness, and coercion are treated with mercy by Allah.', 'Ibn Majah 2045', 'Faith'],
  ['Live as a traveler', 'Treat worldly life as a traveler would treat a temporary stop.', 'Bukhari 6416', 'Character'],
];

const SAHIH_SELECTIONS: readonly HadithEntry[] = [
  { id: 'bukhari-mercy', collection: 'bukhari', title: 'Mercy to others', summary: 'Those who show mercy to others are shown mercy by the Most Merciful.', reference: 'Sahih al-Bukhari 6013', chapter: 'Good manners' },
  { id: 'bukhari-neighbor', collection: 'bukhari', title: 'Care for the neighbor', summary: 'Faith calls a person to honor their neighbor and avoid causing harm.', reference: 'Sahih al-Bukhari 6018', chapter: 'Good manners' },
  { id: 'bukhari-gentleness', collection: 'bukhari', title: 'Gentleness adorns', summary: 'Gentleness beautifies what it enters, while its absence leaves matters diminished.', reference: 'Sahih al-Bukhari 6024', chapter: 'Good manners' },
  { id: 'bukhari-repentance', collection: 'bukhari', title: 'The door of repentance', summary: 'The Prophet described turning back to Allah with a joy greater than a traveler recovering a lost mount.', reference: 'Sahih al-Bukhari 6309', chapter: 'Supplications' },
  { id: 'bukhari-patience', collection: 'bukhari', title: 'Patience and restraint', summary: 'Patience is a gift that Allah grants to those who seek it.', reference: 'Sahih al-Bukhari 1469', chapter: 'Zakat' },
  { id: 'muslim-gentleness', collection: 'muslim', title: 'Gentleness in all matters', summary: 'Allah loves gentleness and grants through it what is not granted through harshness.', reference: 'Sahih Muslim 2593', chapter: 'Good manners' },
  { id: 'muslim-knowledge', collection: 'muslim', title: 'A path to knowledge', summary: 'Whoever follows a path seeking knowledge is given a path toward Paradise.', reference: 'Sahih Muslim 2699', chapter: 'Remembrance and knowledge' },
  { id: 'muslim-patience', collection: 'muslim', title: 'Patience is light', summary: 'Patience is a light that helps a person keep going through difficulty.', reference: 'Sahih Muslim 223', chapter: 'Purification' },
];

export const NAWAWI_FORTY: readonly HadithEntry[] = NAWAWI_SUMMARIES.map(
  ([title, summary, source, chapter], index) => ({
    id: `nawawi-${index + 1}`,
    collection: 'nawawi40',
    title,
    summary,
    reference: `Al-Nawawi 40, no. ${index + 1} · ${source}`,
    chapter,
  }),
);

export const HADITH_COLLECTIONS: readonly HadithEntry[] = [
  ...NAWAWI_FORTY,
  ...SAHIH_SELECTIONS,
];

export function getDailyHadith(date = new Date(), includeExtended = false): HadithEntry {
  const dailyEntries = includeExtended ? HADITH_COLLECTIONS : NAWAWI_FORTY;
  const dayNumber = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  return dailyEntries[((dayNumber % dailyEntries.length) + dailyEntries.length) % dailyEntries.length];
}

export function searchHadiths(query: string, collection: HadithCollection | 'all' = 'all'): HadithEntry[] {
  const stopWords = new Set(['about', 'and', 'for', 'from', 'hadith', 'into', 'the', 'this', 'with']);
  const terms = query
    .toLocaleLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));
  const entries = HADITH_COLLECTIONS.filter((entry) => collection === 'all' || entry.collection === collection);
  if (!terms.length) return entries;

  return entries
    .map((entry, index) => {
      const titleWords = entry.title.toLocaleLowerCase().split(/[^a-z0-9]+/);
      const chapterWords = entry.chapter.toLocaleLowerCase().split(/[^a-z0-9]+/);
      const searchableWords = `${entry.summary} ${entry.reference}`.toLocaleLowerCase().split(/[^a-z0-9]+/);
      const hasTerm = (words: string[], term: string) =>
        words.some((word) => word === term || word.startsWith(term) || term.startsWith(word));
      const matchedTerms = terms.filter((term) =>
        hasTerm(titleWords, term) || hasTerm(chapterWords, term) || hasTerm(searchableWords, term),
      );
      const score = matchedTerms.length === terms.length
        ? terms.reduce((total, term) => total + (hasTerm(titleWords, term) ? 3 : hasTerm(chapterWords, term) ? 2 : 1), 0)
        : 0;
      return { entry, index, score };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((result) => result.entry);
}