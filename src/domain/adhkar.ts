export type AdhkarPeriod = 'morning' | 'evening';

export interface AdhkarEntry {
  id: string;
  title: string;
  arabic: string;
  transliteration: string;
  meaning: string;
  count: number;
  reference: string;
}

export const MORNING_ADHKAR: readonly AdhkarEntry[] = [
  {
    id: 'morning-opening',
    title: 'Beginning the day with remembrance',
    arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ',
    transliteration: 'Allahumma bika asbahna, wa bika amsayna, wa bika nahya, wa bika namut, wa ilayka-n-nushur.',
    meaning: 'By You we enter the morning and evening, live and die, and to You is the resurrection.',
    count: 1,
    reference: 'Abu Dawud 5068; Jami‘ at-Tirmidhi 3391',
  },
  {
    id: 'morning-afiyah',
    title: 'Asking for well-being',
    arabic: 'اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ',
    transliteration: 'Allahumma inni as’aluka al-‘afwa wa al-‘afiyata fi-d-dunya wa-l-akhirah.',
    meaning: 'O Allah, I ask You for pardon and well-being in this life and the next.',
    count: 1,
    reference: 'Abu Dawud 5074; Sunan Ibn Majah 3871',
  },
  {
    id: 'morning-ikhlas',
    title: 'Surah Al-Ikhlas',
    arabic: 'قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ',
    transliteration: 'Qul huwa Allahu ahad. Allahu-s-samad. Lam yalid wa lam yulad. Wa lam yakun lahu kufuwan ahad.',
    meaning: 'Say: He is Allah, the One; Allah, the One sought by all. He neither begets nor is born, and none is comparable to Him.',
    count: 3,
    reference: 'Qur’an 112; Abu Dawud 5082',
  },
  {
    id: 'morning-falaq',
    title: 'Surah Al-Falaq',
    arabic: 'قُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِنْ شَرِّ مَا خَلَقَ ۝ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ',
    transliteration: 'Qul a‘udhu bi-rabbi-l-falaq. Min sharri ma khalaq. Wa min sharri ghasiqin idha waqab. Wa min sharri-n-naffathati fi-l-‘uqad. Wa min sharri hasidin idha hasad.',
    meaning: 'Seek refuge in the Lord of daybreak from the harm of creation, darkness, harmful practices, and envy.',
    count: 3,
    reference: 'Qur’an 113; Abu Dawud 5082',
  },
  {
    id: 'morning-nas',
    title: 'Surah An-Nas',
    arabic: 'قُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَٰهِ النَّاسِ ۝ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ',
    transliteration: 'Qul a‘udhu bi-rabbi-n-nas. Maliki-n-nas. Ilahi-n-nas. Min sharri-l-waswasi-l-khannas. Alladhi yuwaswisu fi suduri-n-nas. Mina-l-jinnati wa-n-nas.',
    meaning: 'Seek refuge in the Lord, King, and God of humanity from the whispering that withdraws, from jinn and people.',
    count: 3,
    reference: 'Qur’an 114; Abu Dawud 5082',
  },
  {
    id: 'morning-ayat-kursi',
    title: 'Ayat al-Kursi',
    arabic: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ',
    transliteration: 'Allahu la ilaha illa huwa-l-hayyu-l-qayyum. La ta’khudhuhu sinatun wa la nawm. Lahu ma fi-s-samawati wa ma fi-l-ard... wa huwa-l-‘aliyyu-l-‘azim.',
    meaning: 'Allah is the Ever-Living, Sustainer of all. His knowledge and authority encompass the heavens and earth, and preserving them does not tire Him.',
    count: 1,
    reference: 'Qur’an 2:255; Abu Dawud 5074',
  },
  {
    id: 'morning-sayyid-istighfar',
    title: 'The master supplication for forgiveness',
    arabic: 'اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَىٰ عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي، فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ',
    transliteration: 'Allahumma anta Rabbi la ilaha illa anta, khalaqtani wa ana ‘abduka, wa ana ‘ala ‘ahdika wa wa‘dika ma istata‘tu, a‘udhu bika min sharri ma sana‘tu, abu’u laka bini‘matika ‘alayya, wa abu’u bidhanbi faghfir li, fa innahu la yaghfiru-dh-dhunuba illa anta.',
    meaning: 'A prayer affirming Allah’s lordship, acknowledging blessings and shortcomings, and asking for forgiveness.',
    count: 1,
    reference: 'Sahih al-Bukhari 6306',
  },
  {
    id: 'morning-protection',
    title: 'Seeking protection by Allah’s name',
    arabic: 'بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ',
    transliteration: 'Bismi-llahi-lladhi la yadurru ma‘a-smihi shay’un fi-l-ardi wa la fi-s-sama’, wa huwa-s-sami‘u-l-‘alim.',
    meaning: 'In Allah’s name, with whose name nothing on earth or in heaven can cause harm; He is the All-Hearing, All-Knowing.',
    count: 3,
    reference: 'Abu Dawud 5088; Jami‘ at-Tirmidhi 3388',
  },
  {
    id: 'morning-contentment',
    title: 'Contentment with faith',
    arabic: 'رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ نَبِيًّا',
    transliteration: 'Raditu billahi Rabban, wa bil-Islami dinan, wa bi-Muhammadin nabiyyan.',
    meaning: 'I am content with Allah as Lord, Islam as a way of life, and Muhammad as Prophet.',
    count: 3,
    reference: 'Abu Dawud 5072; Jami‘ at-Tirmidhi 3389',
  },
  {
    id: 'morning-praise',
    title: 'Glory and praise',
    arabic: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
    transliteration: 'SubhanAllahi wa bihamdihi.',
    meaning: 'Glory and praise be to Allah.',
    count: 100,
    reference: 'Sahih al-Bukhari 6405; Sahih Muslim 2692',
  },
];

export const EVENING_ADHKAR: readonly AdhkarEntry[] = MORNING_ADHKAR.map((entry) => {
  if (entry.id === 'morning-opening') {
    return {
      ...entry,
      id: 'evening-opening',
      title: 'Beginning the evening with remembrance',
      arabic: 'اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ',
      transliteration: 'Allahumma bika amsayna, wa bika asbahna, wa bika nahya, wa bika namut, wa ilayka-l-masir.',
      meaning: 'By You we enter the evening and morning, live and die, and to You is the return.',
    };
  }
  if (entry.id === 'morning-sayyid-istighfar') {
    return { ...entry, id: 'evening-sayyid-istighfar', title: 'The master supplication for forgiveness' };
  }
  return {
    ...entry,
    id: entry.id.replace('morning-', 'evening-'),
    title: entry.title.replace('Morning', 'Evening'),
  };
});

export interface DuaEntry extends AdhkarEntry {
  category: 'travel' | 'anxiety' | 'sleep' | 'morning' | 'home' | 'food' | 'forgiveness';
  context: string;
}

export const HISN_AL_MUSLIM_DUAS: readonly DuaEntry[] = [
  {
    id: 'dua-travel', category: 'travel', context: 'journey trip vehicle', title: 'When beginning a journey',
    arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ ۝ وَإِنَّا إِلَىٰ رَبِّنَا لَمُنْقَلِبُونَ',
    transliteration: 'Subhana-lladhi sakhkhara lana hadha wa ma kunna lahu muqrinin. Wa inna ila Rabbina lamunqalibun.',
    meaning: 'Glory be to the One who made this available to us; to our Lord we will return.', count: 1, reference: 'Qur’an 43:13–14; Sahih Muslim 1342',
  },
  {
    id: 'dua-anxiety', category: 'anxiety', context: 'worry distress sadness debt', title: 'Seeking refuge from worry and grief',
    arabic: 'اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَالْعَجْزِ وَالْكَسَلِ، وَالْجُبْنِ وَالْبُخْلِ، وَضَلَعِ الدَّيْنِ وَغَلَبَةِ الرِّجَالِ',
    transliteration: 'Allahumma inni a‘udhu bika mina-l-hammi wa-l-hazan, wa-l-‘ajzi wa-l-kasal, wa-l-jubni wa-l-bukhl, wa dala‘i-d-dayni wa ghalabati-r-rijal.',
    meaning: 'A prayer seeking refuge from worry, grief, helplessness, laziness, fear, miserliness, debt, and oppression.', count: 1, reference: 'Sahih al-Bukhari 6369',
  },
  {
    id: 'dua-sleep', category: 'sleep', context: 'bed rest night', title: 'Before sleeping',
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا', transliteration: 'Bismika Allahumma amutu wa ahya.',
    meaning: 'In Your name, O Allah, I die and I live.', count: 1, reference: 'Sahih al-Bukhari 6324',
  },
  {
    id: 'dua-waking', category: 'sleep', context: 'wake waking morning', title: 'Upon waking',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    transliteration: 'Alhamdu lillahi-lladhi ahyana ba‘da ma amatana wa ilayhi-n-nushur.',
    meaning: 'Praise be to Allah who gave us life after sleep; to Him is the resurrection.', count: 1, reference: 'Sahih al-Bukhari 6312',
  },
  {
    id: 'dua-leave-home', category: 'home', context: 'leave leaving house protection', title: 'When leaving home',
    arabic: 'بِسْمِ اللَّهِ، تَوَكَّلْتُ عَلَى اللَّهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    transliteration: 'Bismi-llah, tawakkaltu ‘ala-llah, wa la hawla wa la quwwata illa billah.',
    meaning: 'In Allah’s name; I rely on Allah. There is no power or strength except through Allah.', count: 1, reference: 'Abu Dawud 5095; Jami‘ at-Tirmidhi 3426',
  },
  {
    id: 'dua-enter-home', category: 'home', context: 'enter entering house', title: 'When entering home',
    arabic: 'بِسْمِ اللَّهِ وَلَجْنَا، وَبِسْمِ اللَّهِ خَرَجْنَا، وَعَلَىٰ رَبِّنَا تَوَكَّلْنَا',
    transliteration: 'Bismi-llahi walajna, wa bismi-llahi kharajna, wa ‘ala Rabbina tawakkalna.',
    meaning: 'In Allah’s name we enter and leave, and upon our Lord we rely.', count: 1, reference: 'Abu Dawud 5096',
  },
  {
    id: 'dua-food', category: 'food', context: 'eat eating meal', title: 'Before eating',
    arabic: 'بِسْمِ اللَّهِ', transliteration: 'Bismi-llah.', meaning: 'In the name of Allah.', count: 1, reference: 'Abu Dawud 3767; Jami‘ at-Tirmidhi 1858',
  },
  {
    id: 'dua-forgiveness', category: 'forgiveness', context: 'repent repentance sin', title: 'A concise prayer for forgiveness',
    arabic: 'رَبِّ اغْفِرْ لِي وَتُبْ عَلَيَّ، إِنَّكَ أَنْتَ التَّوَّابُ الرَّحِيمُ',
    transliteration: 'Rabbi-ghfir li wa tub ‘alayya, innaka anta-t-tawwabu-r-rahim.',
    meaning: 'My Lord, forgive me and accept my repentance; You are the Accepter of repentance, the Merciful.', count: 100, reference: 'Abu Dawud 1516; Jami‘ at-Tirmidhi 3434',
  },
  {
    id: 'dua-morning', category: 'morning', context: 'morning day protection', title: 'At the beginning of the day',
    arabic: 'اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ',
    transliteration: 'Allahumma bika asbahna, wa bika amsayna, wa bika nahya, wa bika namut, wa ilayka-n-nushur.',
    meaning: 'By You we enter the morning and evening, live and die, and to You is the resurrection.', count: 1, reference: 'Abu Dawud 5068; Jami‘ at-Tirmidhi 3391',
  },
];

export function searchDuas(query: string, category?: DuaEntry['category'] | 'all'): DuaEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searchTerms = normalizedQuery
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 2 && !['dua', 'duas', 'for', 'the', 'when', 'from', 'about'].includes(term));
  return HISN_AL_MUSLIM_DUAS.filter((dua) => {
    if (category && category !== 'all' && dua.category !== category) return false;
    if (!searchTerms.length) return !normalizedQuery || normalizedQuery === 'dua' || normalizedQuery === 'duas';
    const searchable = `${dua.title} ${dua.category} ${dua.context} ${dua.meaning} ${dua.transliteration}`.toLocaleLowerCase();
    return searchTerms.every((term) => searchable.includes(term));
  });
}