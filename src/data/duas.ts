export type DuaTheme = 'daily' | 'home' | 'food' | 'travel' | 'worship' | 'distress';

export interface DuaEntry {
  id: string;
  title: string;
  theme: DuaTheme;
  arabic: string;
  transliteration: string;
  translation: string;
  source: string;
}

export const DUA_THEME_LABELS: Record<DuaTheme, string> = {
  daily: 'Daily life',
  home: 'At home',
  food: 'Meals',
  travel: 'Travel',
  worship: 'Worship',
  distress: 'Distress',
};

export const DUA_THEMES: DuaTheme[] = ['daily', 'home', 'food', 'travel', 'worship', 'distress'];

export const DUAS: DuaEntry[] = [
  {
    id: 'waking',
    title: 'Upon waking',
    theme: 'daily',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ',
    transliteration: 'Alhamdu lillahil-ladhi ahyana ba‘da ma amatana wa ilayhin-nushur.',
    translation: 'Praise is to Allah, who gave us life after causing us to die, and to Him is the resurrection.',
    source: 'Sahih al-Bukhari 6312',
  },
  {
    id: 'sleeping',
    title: 'Before sleeping',
    theme: 'daily',
    arabic: 'بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا',
    transliteration: 'Bismika Allahumma amutu wa ahya.',
    translation: 'In Your name, O Allah, I die and I live.',
    source: 'Sahih al-Bukhari 6324',
  },
  {
    id: 'enter-home',
    title: 'Entering the home',
    theme: 'home',
    arabic: 'بِسْمِ اللَّهِ وَلَجْنَا، وَبِسْمِ اللَّهِ خَرَجْنَا، وَعَلَى اللَّهِ رَبِّنَا تَوَكَّلْنَا',
    transliteration: 'Bismillahi walajna, wa bismillahi kharajna, wa ‘ala rabbina tawakkalna.',
    translation: 'In the name of Allah we enter, and in the name of Allah we leave, and upon our Lord we place our trust.',
    source: 'Sunan Abi Dawud 5096',
  },
  {
    id: 'leave-home',
    title: 'Leaving the home',
    theme: 'home',
    arabic: 'بِسْمِ اللَّهِ، تَوَكَّلْتُ عَلَى اللَّهِ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ',
    transliteration: 'Bismillahi, tawakkaltu ‘alallah, wa la hawla wa la quwwata illa billah.',
    translation: 'In the name of Allah; I place my trust in Allah. There is no might or power except through Allah.',
    source: 'Sunan Abi Dawud 5095',
  },
  {
    id: 'before-eating',
    title: 'Before eating',
    theme: 'food',
    arabic: 'بِسْمِ اللَّهِ',
    transliteration: 'Bismillah.',
    translation: 'In the name of Allah.',
    source: 'Sahih al-Bukhari 5376 · Sahih Muslim 2022',
  },
  {
    id: 'after-eating',
    title: 'After eating',
    theme: 'food',
    arabic: 'الْحَمْدُ لِلَّهِ الَّذِي أَطْعَمَنِي هَذَا وَرَزَقَنِيهِ مِنْ غَيْرِ حَوْلٍ مِنِّي وَلَا قُوَّةٍ',
    transliteration: 'Alhamdu lillahil-ladhi at‘amani hadha wa razaqanihi min ghayri hawlin minni wa la quwwah.',
    translation: 'Praise is to Allah, who fed me this and provided it for me without any power or strength on my part.',
    source: 'Sunan Abi Dawud 4023 · Jami‘ at-Tirmidhi 3458',
  },
  {
    id: 'travel',
    title: 'Beginning a journey',
    theme: 'travel',
    arabic: 'سُبْحَانَ الَّذِي سَخَّرَ لَنَا هَذَا وَمَا كُنَّا لَهُ مُقْرِنِينَ ۝ وَإِنَّا إِلَى رَبِّنَا لَمُنْقَلِبُونَ',
    transliteration: 'Subhanalladhi sakhkhara lana hadha wa ma kunna lahu muqrinin, wa inna ila rabbina lamunqalibun.',
    translation: 'Glory be to Him who has subjected this to us, for we could not have done so by ourselves. And surely to our Lord we will return.',
    source: 'Qur’an 43:13–14',
  },
  {
    id: 'enter-masjid',
    title: 'Entering the masjid',
    theme: 'worship',
    arabic: 'اللَّهُمَّ افْتَحْ لِي أَبْوَابَ رَحْمَتِكَ',
    transliteration: 'Allahumma iftah li abwaba rahmatik.',
    translation: 'O Allah, open for me the gates of Your mercy.',
    source: 'Sahih Muslim 713',
  },
  {
    id: 'distress',
    title: 'In times of distress',
    theme: 'distress',
    arabic: 'لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ',
    transliteration: 'La ilaha illa anta, subhanaka inni kuntu minaz-zalimin.',
    translation: 'There is no god but You; glory be to You. Indeed, I have been among the wrongdoers.',
    source: 'Qur’an 21:87',
  },
];