export interface WellnessGuidance {
  id: string;
  title: string;
  summary: string;
  tradition: string;
  practicalNote: string;
}

export const WELLNESS_GUIDANCE: readonly WellnessGuidance[] = [
  {
    id: 'honey',
    title: 'Honey',
    summary: 'Honey is mentioned in the Qur’an (16:69) as having healing potential.',
    tradition: 'Qur’an 16:69',
    practicalNote: 'Honey is food, not a substitute for medical care. It must not be given to infants under 12 months.',
  },
  {
    id: 'black-seed',
    title: 'Black seed',
    summary: 'A narration in Sahih al-Bukhari mentions black seed in the context of healing.',
    tradition: 'Sahih al-Bukhari 5688',
    practicalNote: 'This devotional reference is not a treatment plan or a claim that one remedy cures every illness. Ask a clinician about supplements and interactions.',
  },
  {
    id: 'olive',
    title: 'Olive and olive oil',
    summary: 'Olives are named among the wholesome provisions described in the Qur’an.',
    tradition: 'Qur’an 16:11',
    practicalNote: 'Use olive oil as food according to your needs; it does not replace prescribed medicine.',
  },
  {
    id: 'dates',
    title: 'Dates',
    summary: 'Dates are a familiar wholesome food in the Prophetic tradition.',
    tradition: 'Sahih al-Bukhari 5445',
    practicalNote: 'Choose portions that suit your health needs, especially if you manage blood glucose.',
  },
];
