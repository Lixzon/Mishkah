export interface Reciter {
  id: string;
  label: string;
  arabicName: string;
  edition: string;
}

export const QURAN_RECITERS: readonly Reciter[] = [
  { id: 'ar.alafasy', label: 'Mishary Rashid Alafasy', arabicName: 'مشاري راشد العفاسي', edition: 'ar.alafasy' },
  { id: 'ar.abdulbasitmurattal', label: 'Abdul Basit · Murattal', arabicName: 'عبد الباسط عبد الصمد', edition: 'ar.abdulbasitmurattal' },
  { id: 'ar.abdurrahmaansudais', label: 'Abdur-Rahman As-Sudais', arabicName: 'عبد الرحمن السديس', edition: 'ar.abdurrahmaansudais' },
  { id: 'ar.saudalshuraym', label: 'Saud Ash-Shuraym', arabicName: 'سعود الشريم', edition: 'ar.saudalshuraym' },
  { id: 'ar.saadghamdi', label: 'Saad Al-Ghamdi', arabicName: 'سعد الغامدي', edition: 'ar.saadghamdi' },
  { id: 'ar.mahermuaiqly', label: 'Maher Al-Muaiqly', arabicName: 'ماهر المعيقلي', edition: 'ar.mahermuaiqly' },
  { id: 'ar.husary', label: 'Mahmoud Khalil Al-Husary', arabicName: 'محمود خليل الحصري', edition: 'ar.husary' },
  { id: 'ar.minshawi', label: 'Muhammad Siddiq Al-Minshawi', arabicName: 'محمد صديق المنشاوي', edition: 'ar.minshawi' },
  { id: 'ar.muhammadayyoub', label: 'Muhammad Ayyub', arabicName: 'محمد أيوب', edition: 'ar.muhammadayyoub' },
  { id: 'ar.hanirifai', label: 'Hani Ar-Rifai', arabicName: 'هاني الرفاعي', edition: 'ar.hanirifai' },
  { id: 'ar.muhammadjibreel', label: 'Muhammad Jibreel', arabicName: 'محمد جبريل', edition: 'ar.muhammadjibreel' },
];

export function getReciterAudioUrl(reciter: Reciter, surah = 1): string {
  const safeSurah = Math.max(1, Math.min(114, Math.floor(surah)));
  return `https://cdn.islamic.network/quran/audio-surah/128/${reciter.edition}/${safeSurah}.mp3`;
}