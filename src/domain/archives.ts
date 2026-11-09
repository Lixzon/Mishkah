export type ArchiveCategory = 'Stories' | 'Companions' | 'Signs' | 'Adab' | 'Food';

export interface ArchiveSource {
  label: string;
  url: string;
}

export interface ArchiveEntry {
  id: string;
  category: ArchiveCategory;
  title: string;
  summary: string;
  sources: readonly ArchiveSource[];
}

export const ARCHIVE_CATEGORIES: readonly ('All' | ArchiveCategory)[] = [
  'All',
  'Stories',
  'Companions',
  'Signs',
  'Adab',
  'Food',
];

export const ISLAMIC_ARCHIVE: readonly ArchiveEntry[] = [
  {
    id: 'prophet-adam',
    category: 'Stories',
    title: 'Adam: the first human and the first repentance',
    summary: 'The Qur’an tells how Adam was honoured, how he and his wife were tested by the tree, and how they turned back to Allah in repentance. Read the account from Al-Baqarah, Al-A’raf, and Ta-Ha to see it told in its revealed order.',
    sources: [
      { label: 'Qur’an 2:30–39', url: 'https://quran.com/2/30' },
      { label: 'Qur’an 7:19–27', url: 'https://quran.com/7/19' },
      { label: 'Qur’an 20:115–123', url: 'https://quran.com/20/115' },
    ],
  },
  {
    id: 'prophet-nuh',
    category: 'Stories',
    title: 'Nuh: calling his people for centuries',
    summary: 'The Qur’an describes Nuh’s long call to his people, their refusal, and the ark that carried the believers. Surah Hud and Surah Nuh give the fullest narration.',
    sources: [
      { label: 'Qur’an 11:25–48', url: 'https://quran.com/11/25' },
      { label: 'Qur’an 71', url: 'https://quran.com/71' },
    ],
  },
  {
    id: 'prophet-ibrahim',
    category: 'Stories',
    title: 'Ibrahim: seeking the truth and trusting Allah',
    summary: 'The Qur’an follows Ibrahim from his rejection of idolatry to the trial with his son, and to the house of worship at Makkah. Al-Anbiya and As-Saffat carry the key scenes.',
    sources: [
      { label: 'Qur’an 21:51–70', url: 'https://quran.com/21/51' },
      { label: 'Qur’an 37:99–113', url: 'https://quran.com/37/99' },
      { label: 'Qur’an 2:124–129', url: 'https://quran.com/2/124' },
    ],
  },
  {
    id: 'prophet-yusuf',
    category: 'Stories',
    title: 'Yusuf: patience, integrity, and forgiveness',
    summary: 'Surah Yusuf tells one complete story: envy, the well, slavery, accusation, prison, interpretation, and finally reconciliation. It is the Qur’an’s most detailed single narrative.',
    sources: [{ label: 'Qur’an 12', url: 'https://quran.com/12' }],
  },
  {
    id: 'prophet-musa',
    category: 'Stories',
    title: 'Musa: confronting Pharaoh',
    summary: 'The Qur’an recounts Musa’s early life, his prophethood, the confrontation with Pharaoh, the parting of the sea, and the guidance given at Sinai across several surahs.',
    sources: [
      { label: 'Qur’an 20', url: 'https://quran.com/20' },
      { label: 'Qur’an 28', url: 'https://quran.com/28' },
      { label: 'Qur’an 26:10–68', url: 'https://quran.com/26/10' },
    ],
  },
  {
    id: 'prophet-isa',
    category: 'Stories',
    title: 'Isa: the son of Maryam',
    summary: 'The Qur’an presents Isa as a messenger of Allah, born of Maryam by His command, given the Injil and supported by clear signs. Surah Maryam and Al-Imran give the main account.',
    sources: [
      { label: 'Qur’an 19:16–36', url: 'https://quran.com/19/16' },
      { label: 'Qur’an 3:45–59', url: 'https://quran.com/3/45' },
    ],
  },
  {
    id: 'prophet-muhammad',
    category: 'Stories',
    title: 'Muhammad ﷺ: the final messenger',
    summary: 'The Qur’an speaks of the Prophet’s mission, character, and the revelation he received. Read Al-Ahzab and Al-Qalam for descriptions of his standing and conduct.',
    sources: [
      { label: 'Qur’an 33:40–46', url: 'https://quran.com/33/40' },
      { label: 'Qur’an 68:1–7', url: 'https://quran.com/68/1' },
      { label: 'Sahih al-Bukhari 3', url: 'https://sunnah.com/bukhari:3' },
    ],
  },
  {
    id: 'yusuf-patience',
    category: 'Stories',
    title: 'Yusuf: patience through hardship',
    summary: 'The Qur’anic account of Yusuf moves through loss, patience, integrity, and reconciliation. Read the full surah rather than treating a short summary as the whole lesson.',
    sources: [{ label: 'Qur’an 12', url: 'https://quran.com/12' }],
  },
  {
    id: 'musa-courage',
    category: 'Stories',
    title: 'Musa: speaking truth with courage',
    summary: 'The Qur’an recounts Musa’s mission to Pharaoh and his reliance on Allah. The account appears across several surahs and should be read in its revealed context.',
    sources: [
      { label: 'Qur’an 20', url: 'https://quran.com/20' },
      { label: 'Qur’an 28', url: 'https://quran.com/28' },
    ],
  },
  {
    id: 'maryam-devotion',
    category: 'Stories',
    title: 'Maryam: devotion and trust',
    summary: 'The Qur’an honors Maryam and describes her devotion and the birth of Isa. This summary is a pointer to the source, not a substitute for reading it.',
    sources: [{ label: 'Qur’an 19', url: 'https://quran.com/19' }],
  },
  {
    id: 'people-of-cave',
    category: 'Stories',
    title: 'The people of the cave',
    summary: 'Surah al-Kahf tells of young people who sought refuge in faith. The Qur’an cautions readers against arguing over details that revelation does not establish.',
    sources: [{ label: 'Qur’an 18:9–26', url: 'https://quran.com/18/9-26' }],
  },
  {
    id: 'abu-bakr-cave',
    category: 'Companions',
    title: 'Abu Bakr: the companion in the cave',
    summary: 'Qur’an 9:40 recalls the Prophet’s companion during the migration and the reassurance, “Do not grieve; indeed Allah is with us.”',
    sources: [{ label: 'Qur’an 9:40', url: 'https://quran.com/9/40' }],
  },
  {
    id: 'khadijah-revelation',
    category: 'Companions',
    title: 'Khadijah: reassurance at the first revelation',
    summary: 'The opening report of revelation describes Khadijah comforting the Prophet and affirming his care for others. This is a brief paraphrase of the narration.',
    sources: [{ label: 'Sahih al-Bukhari 3', url: 'https://sunnah.com/bukhari:3' }],
  },
  {
    id: 'dajjal-trial',
    category: 'Signs',
    title: 'The Dajjal: learn from reviewed sources',
    summary: 'Prophetic narrations describe the Dajjal as a severe trial. Approach end-times material with care, avoid sensational claims, and rely on authenticated scholarship.',
    sources: [{ label: 'Sahih Muslim 2937', url: 'https://sunnah.com/muslim:2937' }],
  },
  {
    id: 'major-signs',
    category: 'Signs',
    title: 'Major signs of the Hour',
    summary: 'A narration lists major signs of the Hour. The report is not a timeline for predicting dates; consult qualified scholarship for explanation.',
    sources: [{ label: 'Sahih Muslim 2901', url: 'https://sunnah.com/muslim:2901' }],
  },
  {
    id: 'kind-speech',
    category: 'Adab',
    title: 'Choose words that are best',
    summary: 'The Qur’an instructs believers to speak in the best manner, a reminder to practice care and dignity in daily conversation.',
    sources: [{ label: 'Qur’an 17:53', url: 'https://quran.com/17/53' }],
  },
  {
    id: 'gentle-volume',
    category: 'Adab',
    title: 'Keep a gentle voice',
    summary: 'Luqman’s counsel includes lowering the voice. The passage presents humility as part of good character.',
    sources: [{ label: 'Qur’an 31:19', url: 'https://quran.com/31/19' }],
  },
  {
    id: 'wholesome-food',
    category: 'Food',
    title: 'Choose wholesome provision',
    summary: 'The Qur’an encourages people to eat what is lawful and good. Specific dietary rulings can depend on ingredients and scholarly guidance.',
    sources: [{ label: 'Qur’an 2:168', url: 'https://quran.com/2/168' }],
  },
  {
    id: 'food-moderation',
    category: 'Food',
    title: 'Avoid excess',
    summary: 'The Qur’an teaches moderation in eating and drinking. Personal nutrition needs vary; this spiritual reminder is not medical advice.',
    sources: [{ label: 'Qur’an 7:31', url: 'https://quran.com/7/31' }],
  },
];

export function searchIslamicArchive(
  query: string,
  category: 'All' | ArchiveCategory = 'All',
): ArchiveEntry[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return ISLAMIC_ARCHIVE.filter((entry) => {
    if (category !== 'All' && entry.category !== category) return false;
    const searchable = `${entry.title} ${entry.summary} ${entry.category} ${entry.sources.map((source) => source.label).join(' ')}`.toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}
