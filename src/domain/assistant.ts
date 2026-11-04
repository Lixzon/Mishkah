type LocalAnswer = {
  title: string;
  answer: string;
};

const FAQS: readonly LocalAnswer[] = [
  {
    title: 'How are prayer times calculated?',
    answer:
      'Mishkah uses your city’s latitude, longitude, local time zone, and solar position. Fajr and Isha twilight angles follow your selected calculation method. Times are calculated on this device.',
  },
  {
    title: 'What should I prepare for suhoor?',
    answer:
      'A simple Sunnah-inspired routine: wake gently, drink water, eat a nourishing suhoor before Fajr, and make your intention. Your personal practice and health needs come first.',
  },
  {
    title: 'What is a gentle iftar routine?',
    answer:
      'Break your fast at Maghrib with water and dates if available, make dua, pray, then enjoy a balanced meal. The order is a gentle reminder—not a ruling.',
  },
  {
    title: 'What if I am unsure about a fasting rule?',
    answer:
      'Fasting guidance can depend on personal circumstances and scholarly tradition. Mishkah offers general reminders, not a ruling; ask a trusted local scholar, and seek qualified medical advice for health concerns.',
  },
  {
    title: 'Can I rely on this as a religious ruling?',
    answer:
      'No. Mishkah offers general educational reminders, not a fatwa. Local timetables and scholarly guidance can differ; follow a trusted local authority for matters of worship.',
  },
  {
    title: 'Does Mishkah work offline?',
    answer:
      'Yes. Prayer calculations, pinned city data, fasting checklists, and these answers work offline. Prayer reminders are scheduled locally on your device.',
  },
];

const COMMON_WORDS = new Set([
  'about',
  'also',
  'and',
  'are',
  'can',
  'could',
  'does',
  'from',
  'have',
  'help',
  'how',
  'into',
  'just',
  'maybe',
  'more',
  'much',
  'only',
  'please',
  'should',
  'some',
  'tell',
  'than',
  'that',
  'the',
  'then',
  'there',
  'this',
  'through',
  'what',
  'when',
  'where',
  'which',
  'while',
  'with',
  'would',
  'your',
]);

function meaningfulWords(value: string): Set<string> {
  return new Set(
    value
      .toLocaleLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 3 && !COMMON_WORDS.has(word)),
  );
}

export function getLocalAnswer(query: string): LocalAnswer {
  const queryWords = meaningfulWords(query);
  if (queryWords.size === 0) {
    return FAQS[0];
  }

  const ranked = FAQS.map((faq) => ({
    faq,
    score: [...meaningfulWords(`${faq.title} ${faq.answer}`)].filter((word) =>
      queryWords.has(word),
    ).length,
  })).sort((left, right) => right.score - left.score);
  return ranked[0].score > 0 ? ranked[0].faq : FAQS[0];
}

export function getLocalFaqs(): readonly LocalAnswer[] {
  return FAQS;
}
