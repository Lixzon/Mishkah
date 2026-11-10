export interface GuidanceSource {
  label: string;
  url: string;
}

export interface PracticalGuidance {
  id: string;
  title: string;
  summary: string;
  practice: string;
  sources: readonly GuidanceSource[];
}

export const PRACTICAL_GUIDANCE: readonly PracticalGuidance[] = [
  {
    id: 'eating-with-good-manners',
    title: 'Eat with gratitude and good manners',
    summary: 'The Prophet ﷺ taught a child to mention Allah’s name, eat with the right hand, and take food from what is near.',
    practice: 'Begin with Bismillah, eat without waste, and give thanks. The manners are Prophetic; the Qur’an also tells believers not to be excessive.',
    sources: [
      { label: 'Sahih al-Bukhari 5376', url: 'https://sunnah.com/bukhari:5376' },
      { label: 'Qur’an 7:31', url: 'https://quran.com/7/31' },
    ],
  },
  {
    id: 'fruit-and-black-seed',
    title: 'Food, remedies, and careful use',
    summary: 'The Qur’an mentions honey in connection with healing, and hadith reports mention honey and black seed in particular contexts.',
    practice: 'These texts are not a diagnosis or a universal prescription. Check safety with a qualified health professional, and do not replace prescribed care with a remedy.',
    sources: [
      { label: 'Qur’an 16:69', url: 'https://quran.com/16/69' },
      { label: 'Sahih al-Bukhari 5684', url: 'https://sunnah.com/bukhari:5684' },
      { label: 'Sahih al-Bukhari 5688', url: 'https://sunnah.com/bukhari:5688' },
    ],
  },
  {
    id: 'lawful-food',
    title: 'Choose food within the lawful bounds',
    summary: 'The Qur’an tells people to eat what is lawful and good, and identifies specific prohibited foods.',
    practice: 'Check ingredients and preparation when needed. This is general guidance, not a ruling on disputed products or individual circumstances.',
    sources: [
      { label: 'Qur’an 2:168–173', url: 'https://quran.com/2/168-173' },
      { label: 'Qur’an 5:3', url: 'https://quran.com/5/3' },
    ],
  },
  {
    id: 'lawful-boundaries',
    title: 'Be careful when calling an action halal or haram',
    summary: 'The Qur’an warns against forbidding good things Allah has made lawful and against making claims about what is lawful without knowledge.',
    practice: 'For a specific action, look for its evidence and recognize where scholars differ. Ask a qualified scholar instead of turning a short summary into a personal ruling.',
    sources: [
      { label: 'Qur’an 5:87', url: 'https://quran.com/5/87' },
      { label: 'Qur’an 16:116', url: 'https://quran.com/16/116' },
    ],
  },
  {
    id: 'beneficial-movement',
    title: 'Strength, archery, and safe movement',
    summary: 'The Prophet ﷺ praised the strong believer and encouraged archery practice among a group of his Companions.',
    practice: 'These reports are not a prescribed modern workout. Choose safe, regular movement that suits your health; archery requires proper equipment, training, and a safe setting.',
    sources: [
      { label: 'Sahih Muslim 2664', url: 'https://sunnah.com/muslim:2664' },
      { label: 'Sahih al-Bukhari 3373', url: 'https://sunnah.com/bukhari:3373' },
    ],
  },
  {
    id: 'modest-dress',
    title: 'Dress with modesty and dignity',
    summary: 'The Qur’an gives guidance on modesty, and the Prophet ﷺ distinguished appreciation of good appearance from pride.',
    practice: 'Choose clean, dignified clothing and avoid arrogance. Detailed dress rulings can differ by school and circumstance; ask a trusted scholar about personal questions.',
    sources: [
      { label: 'Qur’an 24:30–31', url: 'https://quran.com/24/30-31' },
      { label: 'Sahih Muslim 91a', url: 'https://sunnah.com/muslim:91a' },
    ],
  },
  {
    id: 'guard-the-tongue',
    title: 'Leave mockery, suspicion, and backbiting',
    summary: 'The Qur’an warns against ridicule, offensive nicknames, suspicion, spying, and speaking ill of people behind their backs.',
    practice: 'If a conversation turns to humiliating someone, redirect it. The Prophet ﷺ taught believers to speak good or remain silent.',
    sources: [
      { label: 'Qur’an 49:11–12', url: 'https://quran.com/49/11-12' },
      { label: 'Sahih al-Bukhari 6018', url: 'https://sunnah.com/bukhari:6018' },
    ],
  },
  {
    id: 'listen-before-speaking',
    title: 'Listen carefully, then speak for good',
    summary: 'The Qur’an praises those who listen attentively and follow what is best.',
    practice: 'A reflection exercise—not a quoted hadith: pause, listen without interrupting, and answer only when you can do so fairly and helpfully.',
    sources: [{ label: 'Qur’an 39:18', url: 'https://quran.com/39/18' }],
  },
  {
    id: 'serve-at-home',
    title: 'Let kindness begin at home',
    summary: 'When asked about the Prophet’s conduct at home, ʿA’ishah described him helping his family and going to prayer when its time came.',
    practice: 'Take one useful household task off someone else’s hands, while keeping the prayer obligations in their proper place.',
    sources: [{ label: 'Sahih al-Bukhari 6039', url: 'https://sunnah.com/bukhari:6039' }],
  },
  {
    id: 'rest-and-sleep',
    title: 'Make rest part of a balanced day',
    summary: 'A Prophetic report describes making ablution before sleep and lying on the right side.',
    practice: 'These are reported bedtime etiquettes. Keep rest balanced with responsibilities, and do not let a voluntary practice delay needed sleep or care.',
    sources: [{ label: 'Sahih al-Bukhari 6311', url: 'https://sunnah.com/bukhari:6311' }],
  },
  {
    id: 'kindness-of-anas',
    title: 'Anas ibn Malik: kindness in daily dealings',
    summary: 'Anas reported serving the Prophet ﷺ for ten years and that he was never spoken to harshly or blamed for what he did or did not do.',
    practice: 'Use this report as an example of gentleness, especially with those in your care. It does not mean avoiding kind, necessary guidance.',
    sources: [{ label: 'Sahih Muslim 2309a', url: 'https://sunnah.com/muslim:2309a' }],
  },
  {
    id: 'lawful-recreation',
    title: 'Leave room for wholesome recreation',
    summary: 'Aisha described watching Abyssinians display with spears while the Prophet ﷺ screened her.',
    practice: 'The report offers an example of recreation and consideration within that setting; it is not a blanket ruling for every activity or circumstance.',
    sources: [{ label: 'Sahih al-Bukhari 454', url: 'https://sunnah.com/bukhari:454' }],
  },
  {
    id: 'care-for-teeth',
    title: 'Care for cleanliness before worship',
    summary: 'The Prophet ﷺ strongly encouraged cleaning the teeth with siwak, especially in connection with prayer.',
    practice: 'Keep up good oral hygiene. Siwak is a Prophetic practice; ordinary dental care remains useful and is not replaced by this reminder.',
    sources: [{ label: 'Sahih al-Bukhari 887', url: 'https://sunnah.com/bukhari:887' }],
  },
  {
    id: 'learn-from-early-generations',
    title: 'Learn the Prophets’ and Companions’ example carefully',
    summary: 'The Qur’an praises the earliest believers, and authentic reports describe the excellence of the Prophet’s generation.',
    practice: 'Study a specific action through its Qur’anic passage or a checked narration. Do not treat unsourced viral quotes or invented stories as history.',
    sources: [
      { label: 'Qur’an 9:100', url: 'https://quran.com/9/100' },
      { label: 'Sahih al-Bukhari 2652', url: 'https://sunnah.com/bukhari:2652' },
    ],
  },
  {
    id: 'small-consistent-deeds',
    title: 'Keep doing small good deeds',
    summary: 'The Prophet ﷺ taught that the deeds most beloved to Allah are those done consistently, even if they are small.',
    practice: 'Choose one sustainable act—prayer on time, charity, helping someone, or a few verses—and keep returning to it.',
    sources: [
      { label: 'Sahih al-Bukhari 6464', url: 'https://sunnah.com/bukhari:6464' },
      { label: 'Sahih Muslim 783', url: 'https://sunnah.com/muslim:783' },
    ],
  },
];

export interface MomentGuidance {
  id: string;
  moment: string;
  arabic?: string;
  transliteration?: string;
  meaning: string;
  practice?: string;
  sources: readonly GuidanceSource[];
}

export const EVERYDAY_MOMENTS: readonly MomentGuidance[] = [
  {
    id: 'rain-begins',
    moment: 'When rain begins',
    arabic: 'اللَّهُمَّ صَيِّبًا نَافِعًا',
    transliteration: 'Allahumma ṣayyiban nāfiʿan.',
    meaning: 'O Allah, make it a beneficial rain.',
    sources: [{ label: 'Sahih al-Bukhari 1032', url: 'https://sunnah.com/bukhari:1032' }],
  },
  {
    id: 'after-rain',
    moment: 'After rainfall',
    arabic: 'مُطِرْنَا بِفَضْلِ اللَّهِ وَرَحْمَتِهِ',
    transliteration: 'Muṭirnā bi-faḍlillāhi wa-raḥmatih.',
    meaning: 'We have been given rain by Allah’s bounty and mercy.',
    practice: 'This is a remembrance of gratitude reported after rain, rather than a forecast or weather explanation.',
    sources: [{ label: 'Sahih al-Bukhari 846', url: 'https://sunnah.com/bukhari:846' }],
  },
  {
    id: 'bad-dream',
    moment: 'After a disturbing dream',
    meaning: 'Seek Allah’s protection from its evil and from Satan, lightly blow to the left three times, turn to the other side, and do not recount it.',
    practice: 'These steps are from the narration; a frightening dream is not a prediction. Seek personal support if distress continues.',
    sources: [
      { label: 'Sahih Muslim 2261a', url: 'https://sunnah.com/muslim:2261a' },
      { label: 'Sahih al-Bukhari 7044', url: 'https://sunnah.com/bukhari:7044' },
    ],
  },
  {
    id: 'waking-up',
    moment: 'When waking up',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    transliteration: 'Al-ḥamdu lillāhi alladhī aḥyānā baʿda mā amātanā wa ilayhi an-nushūr.',
    meaning: 'All praise is for Allah, who gave us life after causing us to die, and to Him is the resurrection.',
    sources: [{ label: 'Sahih al-Bukhari 6312', url: 'https://sunnah.com/bukhari:6312' }],
  },
  {
    id: 'going-to-sleep',
    moment: 'Before going to sleep',
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    transliteration: 'Bismika Allahumma amūtu wa-aḥyā.',
    meaning: 'In Your name, O Allah, I die and I live.',
    sources: [{ label: 'Sahih al-Bukhari 6324', url: 'https://sunnah.com/bukhari:6324' }],
  },
];

export const LESSER_KNOWN_DUAS: readonly MomentGuidance[] = [
  {
    id: 'dua-of-yunus',
    moment: 'The supplication of Prophet Yunus, in distress',
    arabic: 'لَا إِلَٰهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ',
    transliteration: 'Lā ilāha illā anta, subḥānaka, innī kuntu minaẓ-ẓālimīn.',
    meaning: 'There is no deity except You; glory be to You. Indeed, I was among the wrongdoers.',
    practice: 'A Qur’anic supplication from the account of Prophet Yunus. Read it with reflection, not as a guaranteed formula for a particular result.',
    sources: [{ label: 'Qur’an 21:87', url: 'https://quran.com/21/87' }],
  },
  {
    id: 'dua-for-anxiety-and-debt',
    moment: 'Seeking refuge from worry and debt',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْجُبْنِ وَالْبُخْلِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ',
    transliteration: 'Allāhumma innī aʿūdhu bika mina-l-hammi wa-l-ḥazan, wa-l-ʿajzi wa-l-kasal, wa-l-jubni wa-l-bukhli, wa-ḍalaʿi-d-dayni wa-ghalabati-r-rijāl.',
    meaning: 'O Allah, I seek refuge in You from anxiety and sorrow, incapacity and laziness, miserliness and cowardice, the burden of debt, and being overpowered by people.',
    practice: 'This supplication is reported from the Prophet ﷺ. It can accompany practical steps and support; it does not replace help for financial, emotional, or health difficulties.',
    sources: [{ label: 'Sahih al-Bukhari 6369', url: 'https://sunnah.com/bukhari:6369' }],
  },
  {
    id: 'dua-of-adam-and-hawwa',
    moment: 'Asking Allah for forgiveness',
    arabic: 'رَبَّنَا ظَلَمْنَا أَنْفُسَنَا وَإِنْ لَمْ تَغْفِرْ لَنَا وَتَرْحَمْنَا لَنَكُونَنَّ مِنَ الْخَاسِرِينَ',
    transliteration: 'Rabbanā ẓalamnā anfusanā wa-in lam taghfir lanā wa-tarḥamnā lanakūnanna mina-l-khāsirīn.',
    meaning: 'Our Lord, we have wronged ourselves. If You do not forgive us and have mercy upon us, we will surely be among the losers.',
    practice: 'A Qur’anic supplication in the account of Adam and his wife; its wording is found in the passage cited below.',
    sources: [{ label: 'Qur’an 7:23', url: 'https://quran.com/7/23' }],
  },
];
