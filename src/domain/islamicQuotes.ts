export interface IslamicQuote {
  id: string;
  text: string;
  by: string;
  source: string;
  attributed?: boolean;
}

export const ISLAMIC_QUOTES: readonly IslamicQuote[] = [
  { id: 'intentions', text: 'Actions are only by intentions, and every person will have only what they intended.', by: 'Prophet Muhammad ﷺ', source: 'Sahih al-Bukhari 1 · Sahih Muslim 1907' },
  { id: 'mercy', text: 'Those who show mercy will be shown mercy by the Most Merciful.', by: 'Prophet Muhammad ﷺ', source: 'Jamiʿ at-Tirmidhi 1924' },
  { id: 'gentleness', text: 'Allah loves gentleness in all matters.', by: 'Prophet Muhammad ﷺ', source: 'Sahih Muslim 2593' },
  { id: 'good-speech', text: 'Whoever believes in Allah and the Last Day should speak good or remain silent.', by: 'Prophet Muhammad ﷺ', source: 'Sahih al-Bukhari 6018 · Sahih Muslim 47' },
  { id: 'knowledge', text: 'The best of you are those who learn the Qur’an and teach it.', by: 'Prophet Muhammad ﷺ', source: 'Sahih al-Bukhari 5027' },
  { id: 'consistent-deeds', text: 'The most beloved deeds to Allah are those done consistently, even if they are small.', by: 'Prophet Muhammad ﷺ', source: 'Sahih al-Bukhari 6464 · Sahih Muslim 783' },
  { id: 'self-accounting', text: 'Take account of yourselves before you are taken to account.', by: 'ʿUmar ibn al-Khaṭṭāb (attributed)', source: 'Islamic sayings literature', attributed: true },
  { id: 'quran-heart', text: 'If your hearts were truly pure, you would never grow weary of the words of your Lord.', by: 'ʿUthmān ibn ʿAffān (attributed)', source: 'Islamic sayings literature', attributed: true },
  { id: 'awakening', text: 'People are asleep; when they die, they awaken.', by: 'ʿAlī ibn Abī Ṭālib (attributed)', source: 'Islamic sayings literature', attributed: true },
  { id: 'days', text: 'Son of Adam, you are but days; whenever a day passes, a part of you passes with it.', by: 'Ḥasan al-Baṣrī (attributed)', source: 'Islamic sayings literature', attributed: true },
  { id: 'good-character', text: 'A person can reach the rank of one who fasts and prays at night through good character.', by: 'Companions of the Prophet ﷺ (attributed)', source: 'Adab literature', attributed: true },
];

export function getQuoteOfTheDay(date = new Date()): IslamicQuote {
  const startOfYear = Date.UTC(date.getFullYear(), 0, 1);
  const dayOfYear = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - startOfYear) / 86_400_000,
  );
  return ISLAMIC_QUOTES[((dayOfYear % ISLAMIC_QUOTES.length) + ISLAMIC_QUOTES.length) % ISLAMIC_QUOTES.length];
}
