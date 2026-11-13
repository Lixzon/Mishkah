import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  Alert,
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getContextualAnswer, getLocalAnswer, getLocalFaqs } from './src/domain/assistant';
import {
  DEFAULT_CITY_ID,
  getCity,
  MAX_PINNED_CITIES,
  pinCity,
  searchCities,
  unpinCity,
  type City,
} from './src/domain/cities';
import {
  CALCULATION_METHODS,
  dateInTimeZone,
  formatPrayerTime,
  getPrayerTimes,
  localMinuteAt,
  nextPrayerAt,
  prayerTimeHasArrived,
  isValidJumuahTime,
  type PrayerName,
} from './src/domain/prayer';
import {
  getIslamicDate,
  getUpcomingIslamicEvents,
  ISLAMIC_EVENTS,
} from './src/domain/islamicCalendar';
import {
  installUnhandledExceptionRecorder,
} from './src/services/diagnostics';
import { installBatteryGovernor } from './src/services/batteryGovernor';
import {
  DEFAULT_PREFERENCES,
  checkPreferencesStorage,
  loadPreferences,
  savePreferences,
  type AppPreferences,
} from './src/services/preferences';
import { schedulePrayerReminders } from './src/services/notifications';
import { VoiceSearchButton } from './src/components/VoiceSearchButton';
import { WorshipHub, type WorshipTab } from './src/components/WorshipHub';
import { StoryReader } from './src/components/StoryReader';
import { GuidanceHub } from './src/components/GuidanceHub';
import { IslamicCalendarCard } from './src/components/IslamicCalendarCard';
import { getDailyQuranJourney } from './src/domain/dailyQuranJourney';
import { getDailyQhdReminder, type DailyQhdTheme } from './src/domain/dailyQhdReminder';
import { getQuoteOfTheDay } from './src/domain/islamicQuotes';
import { STORIES } from './src/domain/stories';
import { resetPostSalahCounts } from './src/domain/tasbeeh';
import { getDailyVerse, type DailyVerse } from './src/services/dailyVerse';
import { searchRafiqOnline, type RafiqOnlineAnswer } from './src/services/rafiq';
import {
  readSyncState,
  type SyncState,
} from './src/services/syncEngine';
import {
  createSystemReport,
  discardStoredSystemReport,
  type SystemReport,
} from './src/services/systemReport';

type Screen = 'Prayer' | 'PrayerDetails' | 'Global' | 'Fasting' | 'Guide' | 'More' | 'Worship' | 'Settings' | 'Community';
type PrimaryScreen = 'Prayer' | 'Worship' | 'Community' | 'Guide' | 'More';
const PRIMARY_TABS: readonly { screen: PrimaryScreen; label: string; icon: string }[] = [
  { screen: 'Prayer', label: 'Home', icon: '⌂' },
  { screen: 'Worship', label: 'Library', icon: '▤' },
  { screen: 'Community', label: 'Community Hub', icon: '◎' },
  { screen: 'Guide', label: 'Guidance', icon: '✦' },
  { screen: 'More', label: 'Profile', icon: '◉' },
];

const FASTING_GUIDANCE = [
  {
    title: 'Ramadan',
    type: 'Obligatory',
    detail: 'Fasting is obligatory for eligible Muslims. Exemptions and make-up fasts depend on personal circumstances.',
    source: 'Qur’an 2:183–185',
  },
  {
    title: 'Mondays and Thursdays',
    type: 'Voluntary',
    detail: 'Regularly observed voluntary fast days in the Sunnah.',
    source: 'Sahih Muslim 1162 · Jami‘ at-Tirmidhi 747',
  },
  {
    title: 'The white days · 13th–15th',
    type: 'Voluntary',
    detail: 'Three middle days of each Hijri month, except the 13th of Dhul-Hijjah, which is a day of Tashreeq.',
    source: 'Sunan Abi Dawud 2449',
  },
  {
    title: 'Six days of Shawwal',
    type: 'Voluntary',
    detail: 'Fast six days during Shawwal after Ramadan; do not fast on Eid al-Fitr.',
    source: 'Sahih Muslim 1164',
  },
  {
    title: 'Day of Arafah · 9 Dhul-Hijjah',
    type: 'Voluntary',
    detail: 'A recommended fast for those not performing Hajj.',
    source: 'Sahih Muslim 1162',
  },
  {
    title: 'Ashura · 10 Muharram',
    type: 'Voluntary',
    detail: 'A voluntary fast; some scholars recommend also fasting the 9th or 11th.',
    source: 'Sahih al-Bukhari 2004 · Sahih Muslim 1132',
  },
  {
    title: 'Every other day',
    type: 'Voluntary',
    detail: 'Known as the fast of Dawud; an optional pattern for those able to maintain it.',
    source: 'Sahih al-Bukhari 1976 · Sahih Muslim 1159',
  },
] as const;

function isPrimaryTabActive(tab: PrimaryScreen, screen: Screen): boolean {
  switch (tab) {
    case 'Prayer':
      return screen === 'Prayer' || screen === 'PrayerDetails' || screen === 'Global' || screen === 'Fasting';
    case 'Worship':
      return screen === 'Worship';
    case 'Community':
      return screen === 'Community';
    case 'Guide':
      return screen === 'Guide';
    case 'More':
      return screen === 'More' || screen === 'Settings';
  }
}
type Palette = {
  background: string;
  surface: string;
  surfaceRaised: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentInk: string;
  gold: string;
  goldTint: string;
  danger: string;
};

const PALETTES: Record<'light' | 'dark' | 'oled' | 'sepia' | 'midnight', Palette> = {
  light: {
    background: '#F3F5F1',
    surface: '#FFFFFF',
    surfaceRaised: '#E9EFEB',
    ink: '#162D2C',
    muted: '#71817D',
    line: '#E2E9E4',
    accent: '#145B50',
    accentInk: '#FFFFFF',
    gold: '#C59143',
    goldTint: '#F8F1E5',
    danger: '#A44343',
  },
  dark: {
    background: '#101B1D',
    surface: '#192729',
    surfaceRaised: '#233436',
    ink: '#EAF1EC',
    muted: '#A0B1AC',
    line: '#2A3A3B',
    accent: '#7CC5A7',
    accentInk: '#10221E',
    gold: '#E3B66F',
    goldTint: '#302D25',
    danger: '#F2A5A5',
  },
  midnight: {
    background: '#121925',
    surface: '#1C2634',
    surfaceRaised: '#273544',
    ink: '#E8F0F2',
    muted: '#A2B3BC',
    line: '#344555',
    accent: '#7BC5D0',
    accentInk: '#10242A',
    gold: '#E1B96E',
    goldTint: '#343126',
    danger: '#F2A5A5',
  },
  oled: {
    background: '#000000',
    surface: '#050505',
    surfaceRaised: '#161616',
    ink: '#F4F7F5',
    muted: '#909A95',
    line: '#242424',
    accent: '#7CC5A7',
    accentInk: '#04120E',
    gold: '#E3C15A',
    goldTint: '#2A2618',
    danger: '#F2605F',
  },
  sepia: {
    background: '#EFE5D1',
    surface: '#F8F0DF',
    surfaceRaised: '#E8DCC3',
    ink: '#33291E',
    muted: '#796B56',
    line: '#D8C9AC',
    accent: '#145B50',
    accentInk: '#FFFFFF',
    gold: '#99712B',
    goldTint: '#EFE2C6',
    danger: '#B42318',
  },
};

const PRAYER_ORDER: readonly PrayerName[] = [
  'Fajr',
  'Sunrise',
  'Dhuhr',
  'Asr',
  'Maghrib',
  'Isha',
];
const OBLIGATORY_PRAYERS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const;
const PRAYER_REMINDER_DETAILS: Record<(typeof OBLIGATORY_PRAYERS)[number], string> = {
  Fajr: 'A local reminder at the calculated Fajr time.',
  Dhuhr: 'A local reminder at the calculated Dhuhr time.',
  Asr: 'A local reminder at the calculated Asr time.',
  Maghrib: 'A local reminder at the calculated Maghrib time.',
  Isha: 'A local reminder at the calculated Isha time.',
};

const FASTING_CHECKLIST = [
  { id: 'water', title: 'Drink water and prepare gently', detail: 'Keep hydration within your own needs.' },
  { id: 'suhoor', title: 'Have suhoor before Fajr', detail: 'Choose a nourishing meal that suits you.' },
  { id: 'intention', title: 'Set your intention', detail: 'A quiet moment for a sincere niyyah.' },
  { id: 'iftar', title: 'Break your fast at Maghrib', detail: 'Dates and water are a gentle Sunnah reminder.' },
  { id: 'dua', title: 'Make dua and pause', detail: 'Leave room for gratitude and reflection.' },
] as const;

const BRAND_TAGLINE = 'The Seeker who carries the Light of Guidance across horizons.';
const DEFAULT_FURQAN_BASE_URL = 'https://furqan-quran-app.vercel.app';

void SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  console.error('Mishkah could not hold the native splash screen.', error);
});

function countdownLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) {
    return `${remainder} min`;
  }
  return `${hours} hr ${String(remainder).padStart(2, '0')} min`;
}

function friendlyDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function friendlyError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const HOME_PHOTO_SOURCES = [
  require('./assets/share-backgrounds/ocean.jpg'),
  require('./assets/share-backgrounds/sky.jpg'),
  require('./assets/share-backgrounds/skyline.jpg'),
  require('./assets/share-backgrounds/snow.jpg'),
  require('./assets/share-backgrounds/mountain-starry.jpg'),
  require('./assets/share-backgrounds/mountain-valley.jpg'),
  require('./assets/share-backgrounds/alpine-range.jpg'),
  require('./assets/share-backgrounds/forest-sunrise.jpg'),
  require('./assets/share-backgrounds/lakeshore.jpg'),
] as const;
const HOME_PHOTO_STORAGE_KEY = 'mishkah-home-photo-index';
const HOME_REFLECTIONS: Record<DailyQhdTheme['id'], { question: string; action: string }> = {
  remembrance: {
    question: 'What moment today could you meet with remembrance of Allah?',
    action: 'Pause for a minute of dhikr or a sincere du’a.',
  },
  mercy: {
    question: 'Who around you might need patience, mercy, or practical help?',
    action: 'Offer one specific kindness without expecting anything back.',
  },
  prayer: {
    question: 'How can you make space for the next salah in your day?',
    action: 'Check its time now and prepare a calm place to pray.',
  },
  forgiveness: {
    question: 'What would you like to turn back to Allah about, without losing hope?',
    action: 'Make tawbah and take one small step toward a better choice.',
  },
  charity: {
    question: 'What time, skill, or resource could you share for good?',
    action: 'Plan one manageable act of charity or service.',
  },
  character: {
    question: 'Where could you choose fairness, excellence, or care today?',
    action: 'Make one conversation more patient and considerate.',
  },
  gratitude: {
    question: 'Which blessing in your life have you not paused to notice?',
    action: 'Thank Allah for it, then use it in a good way.',
  },
};
const WEEKLY_SURAH_SPOTLIGHTS = [
  { surah: 1, name: 'Al-Fatiha', range: '1–7', note: 'A short opening prayer asking Allah for guidance.' },
  { surah: 18, name: 'Al-Kahf', range: '1–10', note: 'Begin with verses about revelation, faith, and steadfastness.' },
  { surah: 55, name: 'Ar-Rahman', range: '1–16', note: 'Reflect on signs of creation and the blessings named in these verses.' },
  { surah: 67, name: 'Al-Mulk', range: '1–5', note: 'Read about creation and the signs in the heavens.' },
  { surah: 93, name: 'Ad-Duha', range: '1–11', note: 'A reminder of care, gratitude, and kindness to others.' },
  { surah: 94, name: 'Ash-Sharh', range: '1–8', note: 'Reflect on ease, perseverance, and turning to Allah.' },
  { surah: 103, name: 'Al-Asr', range: '1–3', note: 'A concise reminder of faith, good deeds, truth, and patience.' },
] as const;

function chooseHomePhotoIndex(previousIndex?: number): number {
  if (previousIndex !== undefined) {
    const offset = 1 + Math.floor(Math.random() * (HOME_PHOTO_SOURCES.length - 1));
    return (previousIndex + offset) % HOME_PHOTO_SOURCES.length;
  }
  return Math.floor(Math.random() * HOME_PHOTO_SOURCES.length);
}

function initialHomePhotoIndex(): number {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const previousIndex = Number.parseInt(
        window.localStorage.getItem(HOME_PHOTO_STORAGE_KEY) ?? '',
        10,
      );
      if (
        Number.isInteger(previousIndex) &&
        previousIndex >= 0 &&
        previousIndex < HOME_PHOTO_SOURCES.length
      ) {
        return chooseHomePhotoIndex(previousIndex);
      }
    } catch (error) {
      console.error('Mishkah could not read its Home photo shuffle state.', error);
    }
  }
  return chooseHomePhotoIndex();
}

function weeklySpotlightIndex(date = new Date()): number {
  const dayMs = 86_400_000;
  const utcDate = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const mondayOffset = (new Date(utcDate).getUTCDay() + 6) % 7;
  const monday = utcDate - mondayOffset * dayMs;
  return Math.floor(monday / (7 * dayMs)) % WEEKLY_SURAH_SPOTLIGHTS.length;
}

export default function App() {
  const { width: windowWidth } = useWindowDimensions();
  const isWideLayout = Platform.OS === 'web' && windowWidth >= 768;
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const preferencesRef = useRef(preferences);
  const [isReady, setIsReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('Prayer');
  const [now, setNow] = useState(new Date());
  const contentScrollRef = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const screenMotion = useRef(new Animated.Value(1)).current;
  const screenRise = useRef(screenMotion.interpolate({ inputRange: [0, 1], outputRange: [10, 0] })).current;
  const [appState, setAppState] = useState(
    AppState.currentState == null || AppState.currentState === 'active' ? 'active' : 'background',
  );
  const [notice, setNotice] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [capacityModalVisible, setCapacityModalVisible] = useState(false);
  const [prayerCelebrationVisible, setPrayerCelebrationVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [streakModalVisible, setStreakModalVisible] = useState(false);
  const [universalSearchVisible, setUniversalSearchVisible] = useState(false);
  const [universalSearchQuery, setUniversalSearchQuery] = useState('');
  const [universalSearchStatus, setUniversalSearchStatus] = useState('');
  const [worshipTab, setWorshipTab] = useState<WorshipTab>('Hadith');
  const [guidanceSection, setGuidanceSection] = useState<'overview' | 'qibla' | 'wellness'>('overview');
  const [guideQuery, setGuideQuery] = useState('');
  const [guideAnswer, setGuideAnswer] = useState({
    title: 'Ready to help',
    answer: 'Ask about prayer, Qur’an, Hadith, du’a, remembrance, or a Mishkah feature.',
  });
  const [guideOnlineAnswer, setGuideOnlineAnswer] = useState<RafiqOnlineAnswer | null>(null);
  const [guideOnlineError, setGuideOnlineError] = useState('');
  const [guideOnlineLoading, setGuideOnlineLoading] = useState(false);
  const [systemReport, setSystemReport] = useState<SystemReport | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [dailyVerse, setDailyVerse] = useState<DailyVerse | null>(null);
  const [dailyVerseError, setDailyVerseError] = useState('');
  const [refreshingHome, setRefreshingHome] = useState(false);
  const [homePhotoIndex, setHomePhotoIndex] = useState(initialHomePhotoIndex);
  const [journeyStory, setJourneyStory] = useState<(typeof STORIES)[number] | null>(null);
  const rafiqApiUrl = String(Constants.expoConfig?.extra?.rafiqApiUrl ?? '').trim();

  const theme = preferences.theme;
  const palette = PALETTES[theme];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const city =
    getCity(preferences.selectedCityId) ??
    getCity(DEFAULT_PREFERENCES.selectedCityId);

  useEffect(() => {
    let active = true;
    void discardStoredSystemReport().catch((error: unknown) => {
      console.error('Mishkah could not remove a previously stored system report.', error);
    });
    Promise.all([
      loadPreferences().then(async (loadedPreferences) => {
        await savePreferences(loadedPreferences);
        if (active) {
          preferencesRef.current = loadedPreferences;
          setPreferences(loadedPreferences);
        }
      }),
      readSyncState().then((next) => {
        if (active) setSyncState(next);
      }),
    ])
      .catch((error: unknown) => {
        if (active) {
          setNotice(`Your saved settings could not be loaded: ${friendlyError(error, 'storage is unavailable')}`);
        }
      })
      .finally(() => {
        if (active) setIsReady(true);
      });

    const uninstallBatteryGovernor = installBatteryGovernor((active) => {
      setAppState(active ? 'active' : 'background');
    });
    const uninstallExceptionRecorder =
      Platform.OS === 'web' ? undefined : installUnhandledExceptionRecorder();

    return () => {
      active = false;
      uninstallBatteryGovernor();
      uninstallExceptionRecorder?.();
    };
  }, []);

  useEffect(() => {
    if (appState !== 'active') {
      return;
    }
    const interval = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(interval);
  }, [appState]);

  useEffect(() => {
    contentScrollRef.current?.scrollTo({ y: 0, animated: false });
    const reduceMotion = Platform.OS === 'web'
      && typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      screenMotion.setValue(1);
      return;
    }
    screenMotion.setValue(0);
    Animated.timing(screenMotion, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [screen, screenMotion]);

  useEffect(() => {
    if (
      !isReady ||
      appState !== 'active' ||
      !city ||
      (!Object.values(preferences.prayerAlarms).some(Boolean) &&
        !preferences.fajrAlarm &&
        !preferences.iftarAlarm)
    ) {
      return;
    }
    schedulePrayerReminders(city, {
      prayerAlarms: preferences.prayerAlarms,
      fajrEnabled: preferences.fajrAlarm,
      iftarEnabled: preferences.iftarAlarm,
      fajrLeadMinutes: preferences.alarmLeadMinutes,
      method: preferences.calculationMethod,
    }).catch((error: unknown) => {
      setNotice(`Reminder schedule could not be refreshed: ${friendlyError(error, 'please check notification settings')}`);
    });
  }, [
    appState,
    city?.id,
    isReady,
    preferences.alarmLeadMinutes,
    preferences.calculationMethod,
    preferences.fajrAlarm,
    preferences.iftarAlarm,
    preferences.prayerAlarms,
  ]);

  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync().catch((error: unknown) => {
        console.error('Mishkah could not dismiss the native splash screen.', error);
      });
    }
  }, [isReady]);

  const localDate = city ? dateInTimeZone(now, city.timeZone) : '';
  const islamicCalendar = useMemo(() => {
    if (!localDate) return null;
    try {
      return {
        date: getIslamicDate(localDate),
        events: getUpcomingIslamicEvents(localDate, ISLAMIC_EVENTS.length),
        error: '',
      };
    } catch (error) {
      return {
        date: null,
        events: [],
        error: friendlyError(error, 'The Islamic calendar is unavailable in this runtime.'),
      };
    }
  }, [localDate]);
  const dailyQhd = getDailyQhdReminder(now);
  const dailyReflection = HOME_REFLECTIONS[dailyQhd.theme.id];
  const weeklySurah = WEEKLY_SURAH_SPOTLIGHTS[weeklySpotlightIndex(now)];
  const quoteOfTheDay = getQuoteOfTheDay(now);
  const dailyJourney = getDailyQuranJourney(now);
  const isHomeScreen = screen === 'Prayer';
  const furqanBaseUrl = String(Constants.expoConfig?.extra?.furqanBaseUrl ?? '')
    .trim()
    .replace(/\/$/, '') || DEFAULT_FURQAN_BASE_URL;

  useEffect(() => {
    const handleJourneyUrl = (url: string | null | undefined) => {
      if (!url) return;
      const match = /[?&]journeyStory=([^&#]*)/.exec(url);
      if (!match) return;
      let storyId: string;
      try {
        storyId = decodeURIComponent(match[1]);
      } catch {
        setNotice('That daily journey link is malformed.');
        return;
      }
      const story = STORIES.find((entry) => entry.id === storyId);
      if (!story) {
        setNotice('That daily journey story is not available in this version of Mishkah.');
        return;
      }
      setJourneyStory(story);
      setScreen('Prayer');
    };

    if (Platform.OS === 'web') {
      handleJourneyUrl(window.location.href);
    } else {
      void Linking.getInitialURL()
        .then(handleJourneyUrl)
        .catch((error: unknown) => setNotice(`The daily journey link could not be opened: ${friendlyError(error, 'link handling is unavailable')}`));
    }

    const subscription = Linking.addEventListener('url', ({ url }) => handleJourneyUrl(url));
    return () => subscription.remove();
  }, []);

  const refreshDailyVerse = useCallback(async (forceRefresh = false) => {
    try {
      setDailyVerse(await getDailyVerse(new Date(), forceRefresh));
      setDailyVerseError('');
    } catch (error) {
      setDailyVerseError(friendlyError(error, 'The verse of the day could not be loaded.'));
    }
  }, []);

  const refreshHome = useCallback(async () => {
    setRefreshingHome(true);
    setHomePhotoIndex((current) => chooseHomePhotoIndex(current));
    await new Promise<void>((resolve) => setTimeout(resolve, 300));
    setRefreshingHome(false);
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(HOME_PHOTO_STORAGE_KEY, String(homePhotoIndex));
    } catch (error) {
      console.error('Mishkah could not save its Home photo shuffle state.', error);
    }
  }, [homePhotoIndex]);

  useEffect(() => {
    if (isReady) void refreshDailyVerse(false);
  }, [isReady, localDate, refreshDailyVerse]);

  const prayerTimes = city
    ? getPrayerTimes(city, now, preferences.calculationMethod)
    : undefined;
  const nextPrayer = city && prayerTimes ? nextPrayerAt(prayerTimes, now, city.timeZone) : undefined;
  const jumuahTime = city ? preferences.jumuahTimesByCity[city.id] : undefined;
  const jumuahMinute = jumuahTime && isValidJumuahTime(jumuahTime)
    ? Number(jumuahTime.slice(0, 2)) * 60 + Number(jumuahTime.slice(3, 5))
    : undefined;
  const isFridayInCity = city
    ? new Intl.DateTimeFormat('en-US', { timeZone: city.timeZone, weekday: 'long' }).format(now) === 'Friday'
    : false;
  const pinnedCities = preferences.pinnedCityIds
    .map((id) => getCity(id))
    .filter((pinnedCity): pinnedCity is City => pinnedCity !== undefined);
  const availableCities = cityQuery.trim()
    ? searchCities(cityQuery)
    : ['cairo', 'istanbul', 'new-york', 'kuala-lumpur', 'sydney']
        .map((id) => getCity(id))
        .filter((popularCity): popularCity is City => popularCity !== undefined);

  const changePreferences = (update: (current: AppPreferences) => AppPreferences) => {
    const next = update(preferencesRef.current);
    preferencesRef.current = next;
    setPreferences(next);
    void savePreferences(next).catch((error: unknown) => {
      setNotice(`Your settings could not be saved: ${friendlyError(error, 'local storage is unavailable')}`);
    });
  };

  const openCity = (selectedCity: City) => {
    const result = pinCity(preferencesRef.current.pinnedCityIds, selectedCity.id);
    if (result.status === 'capacity-reached') {
      setCapacityModalVisible(true);
      return;
    }
    changePreferences((current) => ({
      ...current,
      pinnedCityIds: result.cityIds,
      selectedCityId: result.status === 'added' ? current.selectedCityId : selectedCity.id,
    }));
    if (result.status !== 'added') setScreen('Prayer');
    setCityQuery('');
  };

  const removeCity = (cityId: string) => {
    if (cityId === DEFAULT_CITY_ID) {
      setNotice('Nigeria is the fixed first place and cannot be removed.');
      return;
    }
    changePreferences((current) => {
      const pinnedCityIds = unpinCity(current.pinnedCityIds, cityId);
      return {
        ...current,
        pinnedCityIds,
        selectedCityId:
          current.selectedCityId === cityId ? pinnedCityIds[0] : current.selectedCityId,
      };
    });
  };

  const setPrayerAlarm = async (
    prayer: (typeof OBLIGATORY_PRAYERS)[number],
    enabled: boolean,
  ) => {
    if (!city) {
      return;
    }
    const current = preferencesRef.current;
    const prayerAlarms = { ...current.prayerAlarms, [prayer]: enabled };
    const next = { ...current, prayerAlarms };
    try {
      const count = await schedulePrayerReminders(city, {
        prayerAlarms: next.prayerAlarms,
        fajrEnabled: next.fajrAlarm,
        iftarEnabled: next.iftarAlarm,
        fajrLeadMinutes: next.alarmLeadMinutes,
        method: next.calculationMethod,
        requestPermission: enabled,
      });
      changePreferences((currentPreferences) => ({
        ...currentPreferences,
        prayerAlarms: { ...currentPreferences.prayerAlarms, [prayer]: enabled },
      }));
      setNotice(
        enabled
          ? `${count} local reminders are set for the next 14 days. Open Mishkah to refresh them.`
          : 'This reminder has been turned off.',
      );
    } catch (error) {
      setNotice(friendlyError(error, 'The reminder could not be scheduled.'));
    }
  };

  const setFastingReminder = async (alarm: 'fajrAlarm' | 'iftarAlarm', enabled: boolean) => {
    if (!city) return;
    const next = { ...preferencesRef.current, [alarm]: enabled };
    try {
      const count = await schedulePrayerReminders(city, {
        prayerAlarms: next.prayerAlarms,
        fajrEnabled: next.fajrAlarm,
        iftarEnabled: next.iftarAlarm,
        fajrLeadMinutes: next.alarmLeadMinutes,
        method: next.calculationMethod,
        requestPermission: enabled,
      });
      changePreferences((current) => ({ ...current, [alarm]: enabled }));
      setNotice(
        enabled
          ? `${count} local reminders are set for the next 14 days. Open Mishkah to refresh them.`
          : 'This reminder has been turned off.',
      );
    } catch (error) {
      setNotice(friendlyError(error, 'The reminder could not be scheduled.'));
    }
  };

  const runSystemReport = async () => {
    setReportBusy(true);
    try {
      const report = await createSystemReport();
      setSystemReport(report);
      const reportLines = [
        'Mishkah private health report',
        '',
        `Started (UTC): ${new Date(report.startedAt).toISOString()}`,
        `Finished (UTC): ${new Date(report.finishedAt).toISOString()}`,
        `Duration: ${(report.durationMs / 1000).toFixed(2)} seconds`,
        '',
        ...report.items.map((item) => `${item.ok ? 'PASS' : 'CHECK'} — ${item.label}: ${item.detail}`),
        '',
        'Only check summaries are included. The report contains no crash-log contents, questions, or account details.',
      ];
      const subject = `Mishkah health report · ${new Date(report.startedAt).toISOString().slice(0, 10)}`;
      const mailto = `mailto:lixdeji@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(reportLines.join('\n'))}`;
      try {
        await Linking.openURL(mailto);
        setNotice('A report draft is open in your email app. Review it and tap Send to deliver it to Lixzon.');
      } catch (error) {
        console.error('Mishkah could not open the email composer for its private report.', error);
        setNotice('The check finished, but no email app could be opened. Its results are visible below for this session.');
      }
    } catch (error) {
      console.error('Mishkah could not create its private health report.', error);
      setNotice(friendlyError(error, 'The private health report could not be completed.'));
    } finally {
      setReportBusy(false);
    }
  };

  const openSupportLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setNotice('This support link could not be opened on your device.');
    }
  };

  const openFurqan = async () => {
    await openSupportLink(furqanBaseUrl);
  };

  const toggleChecklistItem = (itemId: string) => {
    const completed =
      preferences.checklistDate === localDate ? preferences.completedChecklistItems : [];
    const completedChecklistItems = completed.includes(itemId)
      ? completed.filter((id) => id !== itemId)
      : [...completed, itemId];
    changePreferences((current) => ({
      ...current,
      checklistDate: localDate,
      completedChecklistItems,
    }));
  };

  const togglePrayer = (prayerName: PrayerName) => {
    if (prayerName === 'Sunrise' || !city || !prayerTimes) return;
    const completed = preferences.prayerChecklistDate === localDate
      ? preferences.completedPrayers
      : [];
    const alreadyCompleted = completed.includes(prayerName);
    const checklistPrayerTime =
      prayerName === 'Dhuhr' && isFridayInCity && jumuahMinute !== undefined
        ? jumuahMinute
        : prayerTimes[prayerName];
    if (!alreadyCompleted && !prayerTimeHasArrived(checklistPrayerTime, now, city.timeZone)) {
      setNotice(`${prayerName} can be marked after its scheduled time.`);
      return;
    }
    const completedPrayers = alreadyCompleted
      ? completed.filter((name) => name !== prayerName)
      : [...completed, prayerName];
    changePreferences((current) => ({
      ...current,
      prayerChecklistDate: localDate,
      completedPrayers,
    }));

    if (!alreadyCompleted && preferences.autoResetTasbeehAfterPrayer) {
      changePreferences((current) => ({
        ...current,
        tasbeehDate: localDate,
        tasbeehCounts: resetPostSalahCounts(
          current.tasbeehDate === localDate ? current.tasbeehCounts : {},
        ),
      }));
    }

    if (
      !alreadyCompleted &&
      OBLIGATORY_PRAYERS.every((name) => completedPrayers.includes(name))
    ) {
      setPrayerCelebrationVisible(true);
    }
  };

  const askGuide = (query: string) => {
    const cleanQuery = query.trim();
    setGuideQuery(query);
    setGuideOnlineAnswer(null);
    setGuideOnlineError('');
    if (!cleanQuery) {
      setGuideAnswer({
        title: 'Ask a question',
        answer: 'Type a question or choose an offline topic below to get a focused answer.',
      });
      return;
    }
    setGuideAnswer(getContextualAnswer(cleanQuery));
  };

  const searchGuideOnline = async (query: string) => {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      askGuide('');
      setGuideOnlineError('Enter a question before searching.');
      return;
    }
    setGuideQuery(cleanQuery);
    setGuideAnswer(getContextualAnswer(cleanQuery));
    setGuideOnlineAnswer(null);
    setGuideOnlineError('');
    if (!rafiqApiUrl) {
      setGuideOnlineError('Online answers are not configured in this build. Offline guidance is still available.');
      return;
    }
    setGuideOnlineLoading(true);
    try {
      const locale = Platform.OS === 'web' && typeof navigator !== 'undefined'
        ? navigator.language
        : 'en';
      setGuideOnlineAnswer(await searchRafiqOnline(rafiqApiUrl, cleanQuery, locale));
    } catch (error) {
      setGuideOnlineError(error instanceof Error ? error.message : 'Rafiq could not complete the online search.');
    } finally {
      setGuideOnlineLoading(false);
    }
  };

  const submitUniversalSearch = (searchQuery = universalSearchQuery) => {
    const query = searchQuery.trim();
    if (!query) return;
    const normalized = query.toLocaleLowerCase().replace(/[\u2018\u2019\u02bc]/g, "'");
    const opensStories = /prophet|companion|sahab|story|stories|dajjal|yajuj|mahdi|sign of the hour/.test(normalized);
    const destination: Screen = /community|project idea|event idea/.test(normalized)
      ? 'Community'
      : opensStories
        ? 'Worship'
      : /qibla|qiblah|at.?tibb|remedy|health|wellness/.test(normalized)
        ? 'Guide'
        : /hadith|dua|du'a|adhkar|tasbeeh|tasbih|library|archive/.test(normalized)
          ? 'Worship'
          : /fast|suhoor|iftar|ramadan/.test(normalized)
            ? 'Fasting'
            : /city|location|time zone|global/.test(normalized)
              ? 'Global'
              : /profile|account|settings|theme/.test(normalized)
                ? 'More'
                : /prayer|salah|fajr|dhuhr|asr|maghrib|isha/.test(normalized)
                  ? 'Prayer'
                  : 'Guide';
    if (opensStories) setWorshipTab('Archives');
    setScreen(destination);
    if (destination === 'Guide') {
      setGuidanceSection(/qibla|qiblah/.test(normalized) ? 'qibla' : 'overview');
      askGuide(query);
    }
    if (destination === 'Worship') {
      setWorshipTab(/tasbeeh|tasbih|dhikr/.test(normalized)
        ? 'Tasbeeh'
        : /dua|du'a|supplication/.test(normalized)
          ? 'Duas'
          : /adhkar|remembrance/.test(normalized)
            ? 'Adhkar'
            : 'Hadith');
    }
    setUniversalSearchVisible(false);
    setUniversalSearchStatus('');
  };

  if (!isReady || !city || !prayerTimes || !nextPrayer) {
    return (
      <SafeAreaView style={styles.splashPage}>
        <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
        <View />
        <View style={styles.splashCenter}>
          <View style={styles.splashMark}>
            <Image
              source={require('./assets/brand-mark.png')}
              resizeMode="contain"
              style={styles.splashBrandImage}
            />
          </View>
          <Text style={styles.splashName}>Mishkah</Text>
          <Text style={styles.splashTagline}>{BRAND_TAGLINE}</Text>
          <ActivityIndicator color={palette.accent} size="small" style={styles.splashSpinner} />
        </View>
        <Text style={styles.splashFooter}>by LIXZON</Text>
      </SafeAreaView>
    );
  }

  const completedChecklist =
    preferences.checklistDate === localDate ? preferences.completedChecklistItems : [];
  const completedPrayers =
    preferences.prayerChecklistDate === localDate ? preferences.completedPrayers : [];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
      <View style={[styles.screen, isWideLayout && styles.wideScreen]}>
        {isWideLayout ? (
          <View style={styles.desktopSidebar}>
            {PRIMARY_TABS.map((tab) => {
              const active = isPrimaryTabActive(tab.screen, screen);
              return (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  key={tab.screen}
                  onPress={() => setScreen(tab.screen)}
                  style={[styles.desktopNavButton, active && styles.desktopNavButtonActive]}
                >
                  <Text style={[styles.desktopNavIcon, active && styles.desktopNavLabelActive]}>{tab.icon}</Text>
                  <Text style={[styles.desktopNavLabel, active && styles.desktopNavLabelActive]}>{tab.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <View style={[styles.mainColumn, isWideLayout && styles.mainColumnWide]}>
        <View style={styles.topBar}>
          {screen === 'Prayer' ? (
            <View style={styles.homeHeader}>
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Mishkah streak, ${syncState?.streak ?? 0} days`}
                  onPress={() => setStreakModalVisible(true)}
                  style={styles.headerActionButton}
                >
                  <Text style={[styles.headerActionGlyph, styles.streakGlyph]}>🔥</Text>
                  <Text style={styles.headerActionLabel}>{syncState?.streak ?? 0} day streak</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open prayer schedule and places"
                  onPress={() => setScreen('PrayerDetails')}
                  style={styles.headerActionButton}
                >
                  <Text style={[styles.headerActionGlyph, styles.prayerGlyph]}>☾</Text>
                  <Text style={styles.headerActionLabel}>Prayer</Text>
                </Pressable>
              </View>
              <View style={styles.headerSpacer} />
              <View style={styles.headerActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Search Mishkah"
                  onPress={() => {
                    setUniversalSearchStatus('');
                    setUniversalSearchVisible(true);
                  }}
                  style={styles.headerActionButton}
                >
                  <Text style={styles.headerActionGlyph}>⌕</Text>
                  <Text style={styles.headerActionLabel}>Search</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Open Rafiq AI"
                  onPress={() => {
                    setGuidanceSection('overview');
                    setScreen('Guide');
                  }}
                  style={styles.headerActionButton}
                >
                  <Text style={styles.headerActionGlyph}>✦</Text>
                  <Text style={styles.headerActionLabel}>Rafiq</Text>
                </Pressable>
              </View>
            </View>
          ) : screen === 'PrayerDetails' ? (
            <>
              <View style={styles.contextHeader}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to Home"
                  onPress={() => setScreen('Prayer')}
                  style={styles.headerBackButton}
                >
                  <Text style={styles.headerBackGlyph}>‹</Text>
                </Pressable>
                <View>
                  <Text style={styles.contextHeaderTitle}>Prayer schedule</Text>
                  <Text style={styles.contextHeaderSubtitle}>{city.name} · {city.country}</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open global prayer places"
                onPress={() => setScreen('Global')}
                style={styles.headerActionButton}
              >
                <Text style={styles.headerActionGlyph}>◎</Text>
                <Text style={styles.headerActionLabel}>Places</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.contextHeader}>
                <Text style={styles.contextHeaderGlyph}>
                  {screen === 'Worship' ? '▤' :
                  screen === 'Community' ? '◎' :
                      screen === 'Guide' ? '✦' :
                        screen === 'More' ? '◉' :
                          screen === 'Global' ? '☾' :
                            screen === 'Fasting' ? '☽' : '⚙'}
                </Text>
                <View>
                  <Text style={styles.contextHeaderTitle}>
                    {screen === 'Worship' ? 'Library' :
                      screen === 'Community' ? 'Community Hub' :
                        screen === 'Guide' ? 'Guidance' :
                          screen === 'More' ? 'Profile' :
                            screen === 'Global' ? 'Prayer & places' :
                              screen === 'Fasting' ? 'Fasting' : 'Settings'}
                  </Text>
                  <Text style={styles.contextHeaderSubtitle}>
                    {screen === 'Worship' ? 'Qur’an, worship and remembrance' :
                      screen === 'Community' ? 'Ideas and community updates' :
                        screen === 'Guide' ? 'Rafiq · offline and online guidance' :
                          screen === 'More' ? 'Account, progress and preferences' :
                            screen === 'Global' ? 'Times across your places' :
                              screen === 'Fasting' ? 'Suhoor, iftar and your routine' : 'Make Mishkah yours'}
                  </Text>
                </View>
              </View>
              <View style={styles.headerActions}>
                {screen === 'Worship' || screen === 'Community' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Search Mishkah"
                    onPress={() => {
                      setUniversalSearchStatus('');
                      setUniversalSearchVisible(true);
                    }}
                    style={styles.headerActionButton}
                  >
                    <Text style={styles.headerActionGlyph}>⌕</Text>
                    <Text style={styles.headerActionLabel}>Search</Text>
                  </Pressable>
                ) : null}
                {screen === 'More' ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Account and sync"
                      onPress={() => setProfileModalVisible(true)}
                      style={styles.headerActionButton}
                    >
                      <Text style={styles.headerActionGlyph}>◎</Text>
                      <Text style={styles.headerActionLabel}>Account</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Open settings"
                      onPress={() => setScreen('Settings')}
                      style={styles.headerActionButton}
                    >
                      <Text style={styles.headerActionGlyph}>⚙</Text>
                      <Text style={styles.headerActionLabel}>Settings</Text>
                    </Pressable>
                  </>
                ) : null}
                {screen === 'Settings' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to profile"
                    onPress={() => setScreen('More')}
                    style={styles.headerActionButton}
                  >
                    <Text style={styles.headerActionGlyph}>‹</Text>
                    <Text style={styles.headerActionLabel}>Profile</Text>
                  </Pressable>
                ) : null}
                {screen === 'Global' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to prayer schedule"
                    onPress={() => setScreen('PrayerDetails')}
                    style={styles.headerActionButton}
                  >
                    <Text style={styles.headerActionGlyph}>‹</Text>
                    <Text style={styles.headerActionLabel}>Prayer</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          )}
        </View>

        <ScrollView
          ref={contentScrollRef}
          style={styles.contentScroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={screen === 'Prayer' ? (
            <RefreshControl
              onRefresh={() => void refreshHome()}
              refreshing={refreshingHome}
              tintColor={palette.accent}
            />
          ) : undefined}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.contentMotion, { opacity: screenMotion, transform: [{ translateY: screenRise }] }]}>
          {notice ? (
            <Pressable accessibilityRole="button" onPress={() => setNotice('')} style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
              <Text style={styles.noticeDismiss}>×</Text>
            </Pressable>
          ) : null}

          {screen === 'Prayer' ? (
            <>
              <View style={styles.introBlock}>
                <Text style={styles.eyebrow}>YOUR DAY IN READING</Text>
                <Text style={styles.pageTitle}>A little closer, each day.</Text>
                <Text style={styles.dateText}>{friendlyDate(now, city.timeZone)}</Text>
              </View>

              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.sectionTitle}>Today’s QHD reminder</Text>
                  <Text style={styles.sectionCaption}>{dailyQhd.theme.title} · seven-day theme rotation</Text>
                </View>
              </View>
              <View style={styles.qhdPhotoCard}>
                <Image
                  source={HOME_PHOTO_SOURCES[homePhotoIndex]}
                  resizeMode="cover"
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.qhdPhotoScrim} />
                <View style={styles.qhdPhotoContent}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={dailyVerse
                      ? `Open ${dailyVerse.surahName} ${dailyVerse.surahNumber}, verse ${dailyVerse.ayahNumber} in Furqan`
                      : 'Open the Quran verse of the day in Furqan'}
                    disabled={!dailyVerse}
                    onPress={() => {
                      if (dailyVerse) {
                        void openSupportLink(`${furqanBaseUrl}/surah/${dailyVerse.surahNumber}?ayah=${dailyVerse.ayahNumber}`);
                      }
                    }}
                    style={styles.qhdVerse}
                  >
                    <Text style={styles.photoCardEyebrow}>QUR’AN VERSE OF THE DAY · {dailyQhd.theme.title.toUpperCase()}</Text>
                    {dailyVerse ? (
                      <>
                        <Text numberOfLines={3} style={styles.photoCardArabic}>{dailyVerse.arabic}</Text>
                        <Text numberOfLines={5} style={styles.photoCardBody}>{dailyVerse.translation}</Text>
                        <Text style={styles.photoCardLink}>{dailyVerse.surahName} · {dailyVerse.surahNumber}:{dailyVerse.ayahNumber} · Open in Furqan ›</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.photoCardBody}>{dailyVerseError || 'Loading today’s shared verse…'}</Text>
                        {dailyVerseError ? (
                          <Pressable accessibilityRole="button" onPress={() => void refreshDailyVerse(true)} style={styles.retryVerseButton}>
                            <Text style={styles.photoCardLink}>Try again</Text>
                          </Pressable>
                        ) : null}
                      </>
                    )}
                  </Pressable>
                  <View style={styles.qhdDivider} />
                  <View style={styles.qhdLowerRow}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setWorshipTab('Hadith');
                        setScreen('Worship');
                      }}
                      style={styles.qhdLowerItem}
                    >
                      <Text style={styles.photoCardEyebrow}>HADITH · {dailyQhd.hadith.reference}</Text>
                      <Text numberOfLines={2} style={styles.photoCardTitle}>{dailyQhd.hadith.title}</Text>
                      <Text numberOfLines={3} style={styles.photoCardBody}>{dailyQhd.hadith.summary}</Text>
                      <Text style={styles.photoCardLink}>Read in Library ›</Text>
                    </Pressable>
                    <View style={styles.qhdVerticalDivider} />
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setWorshipTab('Duas');
                        setScreen('Worship');
                      }}
                      style={styles.qhdLowerItem}
                    >
                      <Text style={styles.photoCardEyebrow}>DU’A</Text>
                      <Text numberOfLines={2} style={styles.photoCardTitle}>{dailyQhd.dua.title}</Text>
                      <Text numberOfLines={2} style={styles.photoCardArabic}>{dailyQhd.dua.arabic}</Text>
                      <Text numberOfLines={3} style={styles.photoCardBody}>{dailyQhd.dua.meaning}</Text>
                      <Text style={styles.photoCardLink}>Read in Library ›</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.sectionTitle}>Quote of the day</Text>
                  <Text style={styles.sectionCaption}>A sourced reminder from the Prophetic tradition and Islamic sayings</Text>
                </View>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setWorshipTab('Sayings');
                  setScreen('Worship');
                }}
                style={styles.quotePhotoCard}
              >
                <Image
                  source={HOME_PHOTO_SOURCES[(homePhotoIndex + 3) % HOME_PHOTO_SOURCES.length]}
                  resizeMode="cover"
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.qhdPhotoScrim} />
                <View style={styles.qhdPhotoContent}>
                  <Text style={styles.photoCardEyebrow}>QUOTE OF THE DAY</Text>
                  <Text style={styles.quotePhotoText}>“{quoteOfTheDay.text}”</Text>
                  <Text style={styles.photoCardTitle}>{quoteOfTheDay.by}</Text>
                  <Text style={styles.photoCardLink}>{quoteOfTheDay.source}{quoteOfTheDay.attributed ? ' · attributed' : ''}</Text>
                  <Text style={styles.photoCardLink}>Browse sayings in Library ›</Text>
                </View>
              </Pressable>

              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.sectionTitle}>A daily Quran journey</Text>
                  <Text style={styles.sectionCaption}>Shared with Furqan · story, related verses, and reflection</Text>
                </View>
              </View>
              <View style={styles.quotePhotoCard}>
                <Image
                  source={HOME_PHOTO_SOURCES[(homePhotoIndex + 6) % HOME_PHOTO_SOURCES.length]}
                  resizeMode="cover"
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.qhdPhotoScrim} />
                <View style={styles.qhdPhotoContent}>
                  <Text style={styles.photoCardEyebrow}>DAILY QUR’AN JOURNEY · SHARED WITH FURQAN</Text>
                  <Text style={styles.photoCardTitle}>The story of {dailyJourney.story.title}</Text>
                  <Text style={styles.photoCardBody}>Read related Qur’an passages in Furqan, the long story here, then pause for a short reflection.</Text>
                  <View style={styles.choiceRow}>
                    {dailyJourney.story.quranRefs.map((reference) => (
                      <Pressable
                        accessibilityRole="link"
                        key={`${reference.surah}:${reference.from}`}
                        onPress={() => {
                          if (!furqanBaseUrl) {
                            setNotice('The Furqan reader is not configured for this build.');
                            return;
                          }
                          void openSupportLink(`${furqanBaseUrl}/surah/${reference.surah}?ayah=${reference.from}`);
                        }}
                        style={styles.photoCardChip}
                      >
                        <Text style={styles.photoCardChipText}>
                          {reference.surah}:{reference.from}{reference.to && reference.to !== reference.from ? `–${reference.to}` : ''} ›
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.photoCardEyebrow}>A SHORT REFLECTION</Text>
                  <Text style={styles.photoCardBody}>{dailyJourney.reflection}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Read the long story of ${dailyJourney.story.title}`}
                    onPress={() => setJourneyStory(dailyJourney.story)}
                    style={styles.retryVerseButton}
                  >
                    <Text style={styles.photoCardLink}>Read the long story ›</Text>
                  </Pressable>
                </View>
              </View>

              <View style={styles.quotePhotoCard}>
                <Image
                  source={HOME_PHOTO_SOURCES[(homePhotoIndex + 2) % HOME_PHOTO_SOURCES.length]}
                  resizeMode="cover"
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.qhdPhotoScrim} />
                <View style={styles.qhdPhotoContent}>
                  <Text style={styles.photoCardEyebrow}>REFLECT &amp; ACT · {dailyQhd.theme.title.toUpperCase()}</Text>
                  <Text style={styles.photoCardTitle}>{dailyReflection.question}</Text>
                  <Text style={styles.photoCardBody}>
                    <Text style={styles.photoCardEyebrow}>ONE SMALL STEP · </Text>
                    {dailyReflection.action}
                  </Text>
                  <Text style={styles.photoCardLink}>
                    A reflection prompt inspired by Qur’an {dailyQhd.theme.surah}:{dailyQhd.theme.ayah}; not a quoted tafsir.
                  </Text>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`Read Qur’an ${dailyQhd.theme.surah}, verse ${dailyQhd.theme.ayah} in Furqan`}
                    onPress={() => {
                      void openSupportLink(`${furqanBaseUrl}/surah/${dailyQhd.theme.surah}?ayah=${dailyQhd.theme.ayah}`);
                    }}
                    style={styles.retryVerseButton}
                  >
                    <Text style={styles.photoCardLink}>Read the verse in Furqan ›</Text>
                  </Pressable>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Read this week’s surah spotlight, ${weeklySurah.name}`}
                onPress={() => {
                  void openSupportLink(`${furqanBaseUrl}/surah/${weeklySurah.surah}?ayah=1`);
                }}
                style={styles.quotePhotoCard}
              >
                <Image
                  source={HOME_PHOTO_SOURCES[(homePhotoIndex + 5) % HOME_PHOTO_SOURCES.length]}
                  resizeMode="cover"
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.qhdPhotoScrim} />
                <View style={styles.qhdPhotoContent}>
                  <Text style={styles.photoCardEyebrow}>THIS WEEK’S SURAH SPOTLIGHT</Text>
                  <Text style={styles.photoCardTitle}>{weeklySurah.name}</Text>
                  <Text style={styles.photoCardBody}>{weeklySurah.note}</Text>
                  <Text style={styles.photoCardLink}>Qur’an {weeklySurah.surah}:{weeklySurah.range} · Read in Furqan ›</Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open the Friday Qur’an reading, Surah Al-Kahf, in Furqan"
                onPress={() => {
                  void openSupportLink(`${furqanBaseUrl}/surah/18?ayah=1`);
                }}
                style={styles.quotePhotoCard}
              >
                <Image
                  source={HOME_PHOTO_SOURCES[(homePhotoIndex + 4) % HOME_PHOTO_SOURCES.length]}
                  resizeMode="cover"
                  style={StyleSheet.absoluteFill}
                />
                <View style={styles.qhdPhotoScrim} />
                <View style={styles.qhdPhotoContent}>
                  <Text style={styles.photoCardEyebrow}>FRIDAY QUR’AN READING</Text>
                  <Text style={styles.photoCardTitle}>Surah Al-Kahf</Text>
                  <Text style={styles.photoCardBody}>Set aside time to read and reflect on the Qur’an’s account of faith, trials, and humility.</Text>
                  <Text style={styles.photoCardLink}>Qur’an 18 · Read in Furqan ›</Text>
                </View>
              </Pressable>

              {isHomeScreen ? (
                <>
                  <IslamicCalendarCard
                    cityName={city.name}
                    currentDate={islamicCalendar?.date ?? null}
                    error={islamicCalendar?.error ?? ''}
                    events={islamicCalendar?.events ?? []}
                    onNotice={setNotice}
                  />
                  <View style={styles.sectionHeading}>
                    <View>
                      <Text style={styles.sectionTitle}>Fasting through the year</Text>
                      <Text style={styles.sectionCaption}>Obligatory and voluntary days</Text>
                    </View>
                  </View>
                  <View style={styles.fastingGuidanceCard}>
                    <Text style={styles.fastingGuidanceIntro}>
                      Ramadan is obligatory for eligible Muslims. The other fasts below are voluntary.
                    </Text>
                    {FASTING_GUIDANCE.map((item, index) => (
                      <View
                        key={item.title}
                        style={[
                          styles.fastingGuidanceRow,
                          index === FASTING_GUIDANCE.length - 1 && styles.fastingGuidanceLastRow,
                        ]}
                      >
                        <View style={styles.fastingGuidanceCopy}>
                          <View style={styles.fastingGuidanceTitleRow}>
                            <Text style={styles.fastingGuidanceTitle}>{item.title}</Text>
                            <Text
                              style={[
                                styles.fastingGuidanceTag,
                                item.type === 'Obligatory'
                                  ? styles.fastingGuidanceObligatoryTag
                                  : styles.fastingGuidanceVoluntaryTag,
                              ]}
                            >
                              {item.type.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.fastingGuidanceDetail}>{item.detail}</Text>
                          <Text style={styles.fastingGuidanceSource}>{item.source}</Text>
                        </View>
                      </View>
                    ))}
                    <Text style={styles.fastingGuidanceNote}>
                      Hijri dates can vary with local moon sighting. Do not fast on Eid al-Fitr, Eid al-Adha, or the days of Tashreeq (11th–13th Dhul-Hijjah), except for the specific Hajj concession. This is general information, not a personal ruling; ask a trusted scholar about your circumstances. (Sahih Muslim 1141)
                    </Text>
                  </View>
                  <View style={styles.sectionHeading}>
                    <View>
                      <Text style={styles.sectionTitle}>Suhoor and iftar</Text>
                      <Text style={styles.sectionCaption}>Build a mindful fasting routine</Text>
                    </View>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open mindful fasting routine"
                    onPress={() => setScreen('Fasting')}
                    style={[styles.softCard, styles.photoSoftCard]}
                  >
                    <Image
                      source={HOME_PHOTO_SOURCES[(homePhotoIndex + 1) % HOME_PHOTO_SOURCES.length]}
                      resizeMode="cover"
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.softCardScrim} />
                    <View style={styles.photoSoftCardContent}>
                      <Text style={styles.photoSoftCardSymbol}>☾</Text>
                      <Text style={styles.photoSoftCardTitle}>A mindful fast</Text>
                      <Text style={styles.photoSoftCardBody}>Open your suhoor, iftar, and checklist routine ›</Text>
                    </View>
                  </Pressable>
                </>
              ) : null}
          </>
          ) : null}

          {screen === 'PrayerDetails' ? (
            <>
              <View style={styles.introBlock}>
                <Text style={styles.eyebrow}>A MOMENT TO RECONNECT</Text>
                <Text style={styles.pageTitle}>Your day, in rhythm.</Text>
                <Text style={styles.dateText}>{friendlyDate(now, city.timeZone)}</Text>
              </View>

              <View style={styles.nextPrayerCard}>
                <View style={styles.heroTopLine}>
                  <Text style={styles.heroEyebrow}>THE NEXT PRAYER</Text>
                  <Text style={styles.heroLocation}>{city.name} · {city.country}</Text>
                </View>
                <Text style={styles.nextPrayerName}>{nextPrayer.name}</Text>
                <View style={styles.heroTimeRow}>
                  <Text style={styles.heroTime}>
                    {formatPrayerTime(prayerTimes[nextPrayer.name], city, localDate)}
                  </Text>
                  <Text style={styles.heroDivider}>·</Text>
                  <Text style={styles.countdown}>{countdownLabel(nextPrayer.minutesUntil)}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(96, Math.max(4, (localMinuteAt(now, city.timeZone) / 1440) * 100))}%` },
                    ]}
                  />
                </View>
                <Text style={styles.heroFootnote}>Calculated on your device · works offline</Text>
              </View>

              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.sectionTitle}>Today’s prayers</Text>
                  <Text style={styles.sectionCaption}>{preferences.calculationMethod} calculation</Text>
                </View>
                <Pressable accessibilityRole="button" onPress={() => setScreen('Settings')}>
                  <Text style={styles.textLink}>Method</Text>
                </Pressable>
              </View>

              <View style={styles.prayerList}>
                {PRAYER_ORDER.map((prayerName, index) => {
                  const isNextPrayer = prayerName === nextPrayer.name;
                  const isObligatory = prayerName !== 'Sunrise';
                  const prayerCompleted = isObligatory && completedPrayers.includes(prayerName);
                  const checklistPrayerTime =
                    prayerName === 'Dhuhr' && isFridayInCity && jumuahMinute !== undefined
                      ? jumuahMinute
                      : prayerTimes[prayerName];
                  const prayerTimeReached =
                    isObligatory && prayerTimeHasArrived(checklistPrayerTime, now, city.timeZone);
                  return (
                    <View key={prayerName}>
                      <View
                        style={[
                          styles.prayerRow,
                          index === PRAYER_ORDER.length - 1 && !isFridayInCity && styles.lastPrayerRow,
                        ]}
                      >
                        <View style={styles.prayerNameGroup}>
                          <View style={[styles.prayerDot, isNextPrayer && styles.activePrayerDot]} />
                          <Text style={[styles.prayerName, isNextPrayer && styles.activePrayerName]}>
                            {prayerName}
                          </Text>
                          {isNextPrayer ? <Text style={styles.nextTag}>NEXT</Text> : null}
                        </View>
                        <View style={styles.prayerRowRight}>
                          <Text style={[styles.prayerTime, isNextPrayer && styles.activePrayerName]}>
                            {formatPrayerTime(prayerTimes[prayerName], city, localDate)}
                          </Text>
                          {isObligatory ? (
                            <Pressable
                              accessibilityRole="checkbox"
                              accessibilityLabel={
                                prayerCompleted
                                  ? `${prayerName} prayer completed`
                                  : `${prayerName} prayer${prayerTimeReached ? '' : ' locked until its scheduled time'}`
                              }
                              accessibilityState={{
                                checked: prayerCompleted,
                                disabled: !prayerCompleted && !prayerTimeReached,
                              }}
                              disabled={!prayerCompleted && !prayerTimeReached}
                              onPress={() => togglePrayer(prayerName)}
                              style={[
                                styles.prayerCheckButton,
                                prayerCompleted && styles.prayerCheckButtonDone,
                                !prayerCompleted && !prayerTimeReached && styles.prayerCheckButtonDisabled,
                              ]}
                            >
                              <Text style={[styles.prayerCheckText, prayerCompleted && styles.prayerCheckTextDone]}>
                                {prayerCompleted ? '✓' : '○'}
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                      {prayerName === 'Dhuhr' && isFridayInCity ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Set or edit Jumu'ah time for ${city.name}`}
                          onPress={() => setScreen('Global')}
                          style={[styles.prayerRow, index === PRAYER_ORDER.length - 1 && styles.lastPrayerRow]}
                        >
                          <View style={styles.prayerNameGroup}>
                            <View style={[styles.prayerDot, styles.jumuahDot]} />
                            <Text style={styles.prayerName}>Jumu'ah</Text>
                            <Text style={styles.nextTag}>FRIDAY</Text>
                          </View>
                          <Text style={styles.prayerTime}>
                            {jumuahTime
                              ? formatPrayerTime(
                                  Number(jumuahTime.slice(0, 2)) * 60 + Number(jumuahTime.slice(3, 5)),
                                  city,
                                  localDate,
                                )
                              : 'Set local time'}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              <View style={styles.settingsCard}>
                <Text style={styles.settingGroupTitle}>Prayer reminders</Text>
                <Text style={styles.settingDescription}>
                  Choose local device reminders for each obligatory prayer. Sunrise is not a prayer reminder.
                </Text>
                {OBLIGATORY_PRAYERS.map((prayer) => (
                  <ToggleRow
                    key={prayer}
                    label={`${prayer} reminder`}
                    detail={PRAYER_REMINDER_DETAILS[prayer]}
                    enabled={preferences.prayerAlarms[prayer] === true}
                    palette={palette}
                    styles={styles}
                    onChange={(enabled) => void setPrayerAlarm(prayer, enabled)}
                  />
                ))}
                <Text style={styles.helperText}>
                  Reminders are calculated offline for the next 14 days. Notification permission is required on iOS and Android.
                </Text>
              </View>
            </>
          ) : null}

          {screen === 'Global' ? (
            <>
              <View style={styles.introBlock}>
                <Text style={styles.eyebrow}>NIGERIA + FOUR PLACES</Text>
                <Text style={styles.pageTitle}>A little closer, everywhere.</Text>
                <Text style={styles.bodyText}>
                  Nigeria stays as your first place. Add up to four more cities to compare local prayer times; the additional places stay on this device.
                </Text>
              </View>
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  accessibilityLabel="Search cities"
                  onChangeText={setCityQuery}
                  placeholder="Search a city or country"
                  placeholderTextColor={palette.muted}
                  returnKeyType="search"
                  style={styles.searchInput}
                  value={cityQuery}
                />
              </View>
              {cityQuery.trim() ? (
                <View style={styles.resultList}>
                  {availableCities.length ? (
                    availableCities.map((resultCity) => (
                      <Pressable
                        key={resultCity.id}
                        onPress={() => openCity(resultCity)}
                        style={styles.cityResult}
                      >
                        <View style={styles.cityResultCopy}>
                          <Text style={styles.cityName}>{resultCity.name}</Text>
                          <Text style={styles.cityCountry}>{resultCity.country}</Text>
                        </View>
                        <Text style={styles.addCityLabel}>
                          {preferences.pinnedCityIds.includes(resultCity.id) ? 'Open' : '+ Add'}
                        </Text>
                      </Pressable>
                    ))
                  ) : (
                    <Text style={styles.emptySearch}>No indexed cities match that search.</Text>
                  )}
                </View>
              ) : (
                <View style={styles.popularChips}>
                  <Text style={styles.sectionCaption}>Popular places</Text>
                  <View style={styles.chipRow}>
                    {availableCities.map((popularCity) => (
                      <Pressable
                        key={popularCity.id}
                        onPress={() => openCity(popularCity)}
                        style={styles.cityChip}
                      >
                        <Text style={styles.cityChipLabel}>{popularCity.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.sectionTitle}>Your pinned places</Text>
                  <Text style={styles.sectionCaption}>{pinnedCities.length} of {MAX_PINNED_CITIES} saved</Text>
                </View>
              </View>
              {pinnedCities.map((pinnedCity) => {
                const cityDate = dateInTimeZone(now, pinnedCity.timeZone);
                const cityTimes = getPrayerTimes(pinnedCity, now, preferences.calculationMethod);
                return (
                  <View key={pinnedCity.id} style={styles.globalCityCard}>
                    <View style={styles.globalCityRow}>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => openCity(pinnedCity)}
                        style={styles.globalCityMain}
                      >
                        <Text style={styles.cityName}>{pinnedCity.name}</Text>
                        <Text style={styles.cityCountry}>{pinnedCity.country} · {pinnedCity.timeZone}</Text>
                        <View style={styles.cityPrayerPreview}>
                          <Text style={styles.cityPrayerLabel}>FAJR</Text>
                          <Text style={styles.cityPrayerValue}>{formatPrayerTime(cityTimes.Fajr, pinnedCity, cityDate)}</Text>
                          <Text style={styles.cityPrayerLabel}>MAGHRIB</Text>
                          <Text style={styles.cityPrayerValue}>{formatPrayerTime(cityTimes.Maghrib, pinnedCity, cityDate)}</Text>
                        </View>
                      </Pressable>
                      {pinnedCity.id === DEFAULT_CITY_ID ? (
                        <Text style={styles.fixedCityBadge}>DEFAULT</Text>
                      ) : (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Unpin ${pinnedCity.name}`}
                          onPress={() => removeCity(pinnedCity.id)}
                          style={styles.removeCityButton}
                        >
                          <Text style={styles.removeCityText}>×</Text>
                        </Pressable>
                      )}
                    </View>
                    <JumuahTimeField
                      cityName={pinnedCity.name}
                      value={preferences.jumuahTimesByCity[pinnedCity.id] ?? ''}
                      styles={styles}
                      onInvalid={() => setNotice('Enter a local time from 00:00 to 23:59.')}
                      onSave={(value) => changePreferences((current) => {
                        const jumuahTimesByCity = { ...current.jumuahTimesByCity };
                        if (value) jumuahTimesByCity[pinnedCity.id] = value;
                        else delete jumuahTimesByCity[pinnedCity.id];
                        return { ...current, jumuahTimesByCity };
                      })}
                    />
                  </View>
                );
              })}
              {pinnedCities.length < MAX_PINNED_CITIES ? (
                <Text style={styles.helperText}>Search above to add a place · {MAX_PINNED_CITIES - pinnedCities.length} {MAX_PINNED_CITIES - pinnedCities.length === 1 ? 'additional slot' : 'additional slots'} left</Text>
              ) : null}
            </>
          ) : null}

          {screen === 'Fasting' ? (
            <>
              <View style={styles.introBlock}>
                <Text style={styles.eyebrow}>A GENTLER DAILY RHYTHM</Text>
                <Text style={styles.pageTitle}>Suhoor to iftar.</Text>
                <Text style={styles.bodyText}>
                  A flexible Sunnah-inspired checklist, kept private and saved on this device.
                </Text>
              </View>
              <View style={styles.routineCard}>
                <View style={styles.routineIcon}>
                  <Text style={styles.routineIconText}>☾</Text>
                </View>
                <Text style={styles.routineEyebrow}>BEFORE FAJR</Text>
                <Text style={styles.routineTitle}>Wake with a little room.</Text>
                <Text style={styles.routineBody}>
                  Your suhoor reminder is set for {preferences.alarmLeadMinutes} minutes before Fajr.
                </Text>
                <View style={styles.leadChoices}>
                  {([45, 50, 60] as const).map((minutes) => (
                    <Pressable
                      key={minutes}
                      onPress={() =>
                        changePreferences((current) => ({ ...current, alarmLeadMinutes: minutes }))
                      }
                      style={[
                        styles.leadChoice,
                        preferences.alarmLeadMinutes === minutes && styles.selectedLeadChoice,
                      ]}
                    >
                      <Text
                        style={[
                          styles.leadChoiceText,
                          preferences.alarmLeadMinutes === minutes && styles.selectedLeadChoiceText,
                        ]}
                      >
                        {minutes} min
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <ToggleRow
                  label="Sahur reminder"
                  detail="A local reminder with water, suhoor, and dua prompts."
                  enabled={preferences.fajrAlarm}
                  palette={palette}
                  styles={styles}
                  onChange={(enabled) => void setFastingReminder('fajrAlarm', enabled)}
                />
              </View>
              <View style={styles.routineCard}>
                <View style={styles.iftarIcon}>
                  <Text style={styles.routineIconText}>✧</Text>
                </View>
                <Text style={styles.routineEyebrow}>AT MAGHRIB</Text>
                <Text style={styles.routineTitle}>Make space for iftar.</Text>
                <Text style={styles.routineBody}>
                  {city.name} · today at {formatPrayerTime(prayerTimes.Maghrib, city, localDate)}
                </Text>
                <ToggleRow
                  label="Iftar reminder"
                  detail="A local Maghrib note with a gentle iftar sequence."
                  enabled={preferences.iftarAlarm}
                  palette={palette}
                  styles={styles}
                  onChange={(enabled) => void setFastingReminder('iftarAlarm', enabled)}
                />
              </View>
              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.sectionTitle}>Today’s little checklist</Text>
                  <Text style={styles.sectionCaption}>{completedChecklist.length} of {FASTING_CHECKLIST.length} complete</Text>
                </View>
              </View>
              <View style={styles.checklistCard}>
                {FASTING_CHECKLIST.map((item, index) => {
                  const complete = completedChecklist.includes(item.id);
                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: complete }}
                      key={item.id}
                      onPress={() => toggleChecklistItem(item.id)}
                      style={[
                        styles.checklistRow,
                        index === FASTING_CHECKLIST.length - 1 && styles.lastPrayerRow,
                      ]}
                    >
                      <View style={[styles.checkbox, complete && styles.checkedBox]}>
                        {complete ? <Text style={styles.checkmark}>✓</Text> : null}
                      </View>
                      <View style={styles.checklistCopy}>
                        <Text style={[styles.checklistTitle, complete && styles.completedText]}>
                          {item.title}
                        </Text>
                        <Text style={styles.checklistDetail}>{item.detail}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {screen === 'Community' ? (
            <>
              <View style={styles.introBlock}>
                <Text style={styles.eyebrow}>COMMUNITY HUB</Text>
                <Text style={styles.pageTitle}>A place for good ideas.</Text>
                <Text style={styles.bodyText}>The community board is planned, but submissions and voting are not active yet.</Text>
              </View>
              <View style={styles.communityPreview}>
                <Text style={styles.communityIcon}>◎</Text>
                <Text style={styles.communityTitle}>Coming in a later phase</Text>
                <Text style={styles.bodyText}>This space is reserved for community project and event proposals, with admin review and upvoting. There will be no open chat.</Text>
              </View>
            </>
          ) : null}

          {screen === 'Guide' ? (
            <>
              <GuidanceHub
                city={city}
                hour={Number(new Intl.DateTimeFormat('en-GB', {
                  timeZone: city.timeZone,
                  hour: '2-digit',
                  hourCycle: 'h23',
                }).format(now))}
                initialSection={guidanceSection}
                palette={palette}
              />
              <View style={styles.introBlock}>
                <Text style={styles.eyebrow}>OPTIONAL AI COMPANION</Text>
                <Text style={styles.pageTitle}>Ask Rafiq.</Text>
                <Text style={styles.bodyText}>
                  Get an instant offline answer, or search for current information and source links when online service is configured.
                </Text>
              </View>
              <View style={styles.assistantCard}>
                <View style={styles.assistantHeader}>
                  <View style={styles.assistantMark}>
                    <Text style={styles.assistantMarkText}>✦</Text>
                  </View>
                  <View>
                    <Text style={styles.assistantTitle}>Rafiq AI</Text>
                    <Text style={styles.localBadge}>
                      {rafiqApiUrl ? 'OFFLINE + ONLINE SOURCES' : 'OFFLINE READY · ONLINE NOT CONFIGURED'}
                    </Text>
                  </View>
                </View>
                <TextInput
                  accessibilityLabel="Ask a spiritual guidance question"
                  onChangeText={setGuideQuery}
                  onSubmitEditing={() => askGuide(guideQuery)}
                  placeholder="Ask about prayer times or routines…"
                  placeholderTextColor={palette.muted}
                  returnKeyType="search"
                  style={styles.guideInput}
                  value={guideQuery}
                />
                <View style={styles.guideActions}>
                  <ActionButton
                    label="Ask offline"
                    onPress={() => askGuide(guideQuery)}
                    palette={palette}
                    styles={styles}
                  />
                  <ActionButton
                    label={guideOnlineLoading ? 'Searching…' : 'Search online'}
                    onPress={() => void searchGuideOnline(guideQuery)}
                    palette={palette}
                    styles={styles}
                    disabled={guideOnlineLoading}
                    busy={guideOnlineLoading}
                  />
                </View>
                <View style={styles.answerCard}>
                  <Text style={styles.answerTitle}>Offline guidance · {guideAnswer.title}</Text>
                  <Text style={styles.answerText}>{guideAnswer.answer}</Text>
                </View>
                {guideOnlineError ? (
                  <Text accessibilityRole="alert" style={styles.healthMessage}>{guideOnlineError}</Text>
                ) : null}
                {guideOnlineAnswer ? (
                  <View style={styles.answerCard}>
                    <Text style={styles.answerTitle}>Online answer · verify the sources</Text>
                    <Text style={styles.answerText}>{guideOnlineAnswer.answer}</Text>
                    <Text style={styles.sectionCaption}>Sources</Text>
                    {guideOnlineAnswer.sources.map((source) => (
                      <Pressable
                        key={source.url}
                        accessibilityRole="link"
                        onPress={() => void openSupportLink(source.url)}
                        style={styles.faqRow}
                      >
                        <Text style={styles.textLink}>{source.title}</Text>
                        <Text style={styles.faqArrow}>↗</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
              <Text style={styles.sectionCaption}>Offline topics</Text>
              {getLocalFaqs().map((faq) => (
                <Pressable key={faq.title} onPress={() => askGuide(faq.title)} style={styles.faqRow}>
                  <Text style={styles.faqText}>{faq.title}</Text>
                  <Text style={styles.faqArrow}>↗</Text>
                </Pressable>
              ))}
              <View style={styles.disclaimerCard}>
                <Text style={styles.disclaimerTitle}>A thoughtful companion, not a fatwa.</Text>
                <Text style={styles.disclaimerText}>
                  Online answers can be incomplete or out of date. Check primary sources; ask a trusted scholar about personal rulings and a qualified professional about health.
                </Text>
              </View>
            </>
          ) : null}

          {screen === 'Worship' ? (
            <WorshipHub
              preferences={preferences}
              palette={palette}
              date={localDate}
              dailyQhd={dailyQhd}
              dailyQuote={quoteOfTheDay}
              initialTab={worshipTab}
              furqanBaseUrl={furqanBaseUrl}
              featuresUnlocked={syncState?.featuresUnlocked ?? ['basic-guidance']}
              onPreferencesChange={changePreferences}
              onNotice={setNotice}
            />
          ) : null}

          {screen === 'More' ? (
            <>
              <View style={styles.introBlock}>
                <Text style={styles.eyebrow}>YOUR MANĀRA</Text>
                <Text style={styles.pageTitle}>Your profile.</Text>
                <Text style={styles.bodyText}>Account, progress, preferences, and your Quran journey.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open the Manāra Quran reader"
                onPress={() => void openFurqan()}
                style={styles.moreAccountRow}
              >
                <View style={styles.moreIcon}><Text style={styles.moreIconText}>۞</Text></View>
                <View style={styles.moreRowCopy}>
                  <Text style={styles.moreRowTitle}>Open Quran reader</Text>
                  <Text style={styles.moreRowDescription}>Continue in the Manāra Quran module</Text>
                </View>
                <Text style={styles.moreArrow}>↗</Text>
              </Pressable>
              <View style={styles.streakPanel}>
                <View style={styles.streakHeading}>
                  <View>
                    <Text style={styles.moreRowTitle}>Mishkah reading streak</Text>
                    <Text style={styles.moreRowDescription}>
                      Your daily practice streak and rewards.
                    </Text>
                  </View>
                  <Text style={styles.streakCount}>{syncState?.streak ?? 0}<Text style={styles.streakUnit}> days</Text></Text>
                </View>
                {([
                  { id: 'extended-hadith', days: 7, label: 'Expanded Hadith collection' },
                  { id: 'premium-theme-collection', days: 14, label: 'Premium theme collection' },
                  { id: 'reciter-library', days: 21, label: 'Audio reciter library' },
                ] as const).map((reward) => {
                  const unlocked = syncState?.featuresUnlocked.includes(reward.id) === true;
                  return (
                    <View key={reward.id} style={styles.rewardRow}>
                      <Text style={[styles.rewardMark, unlocked && styles.rewardMarkUnlocked]}>{unlocked ? '✓' : '·'}</Text>
                      <Text style={styles.rewardLabel}>{reward.label}</Text>
                      <Text style={styles.rewardRequirement}>{unlocked ? 'Unlocked' : `${reward.days} days`}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.moreSectionHeading}>
                <Text style={styles.sectionTitle}>Worship & learning</Text>
                <Text style={styles.sectionCaption}>Offline collections and daily practice</Text>
              </View>
              <View style={styles.moreToolGrid}>
                {([
                  { tab: 'Hadith', icon: '۞', title: 'Hadith', description: 'Daily teaching and collections' },
                  { tab: 'Tasbeeh', icon: '◉', title: 'Tasbeeh', description: 'Dhikr counter and custom phrases' },
                  { tab: 'Adhkar', icon: '☼', title: 'Daily Adhkar', description: 'Morning and evening routine' },
                  { tab: 'Duas', icon: '✧', title: 'Dua library', description: 'Find a prayer by context' },
                  { tab: 'Reciters', icon: '▶', title: 'Reciters', description: 'Stream Qur’an recitations' },
                ] as const).map((tool) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${tool.title}`}
                    key={tool.tab}
                    onPress={() => {
                      setWorshipTab(tool.tab);
                      setScreen('Worship');
                    }}
                    style={styles.moreTool}
                  >
                    <View style={styles.moreIcon}><Text style={styles.moreIconText}>{tool.icon}</Text></View>
                    <Text style={styles.moreRowTitle}>{tool.title}</Text>
                    <Text style={styles.moreRowDescription}>{tool.description}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.moreSectionHeading}>
                <Text style={styles.sectionTitle}>Daily life</Text>
              </View>
              {([
                { title: 'Fasting routine', detail: 'Suhoor, iftar, and your checklist', icon: '☾', target: 'Fasting' },
                { title: 'Prayer cities', detail: 'Browse and pin places around the world', icon: '◎', target: 'Global' },
                { title: 'Rafiq AI', detail: 'Local answers and spiritual reminders', icon: '✦', target: 'Guide' },
                { title: 'Settings', detail: 'Appearance, prayer method, diagnostics', icon: '⚙', target: 'Settings' },
              ] as const).map((item) => (
                <Pressable accessibilityRole="button" key={item.target} onPress={() => setScreen(item.target)} style={styles.moreListRow}>
                  <View style={styles.moreListIcon}><Text style={styles.moreIconText}>{item.icon}</Text></View>
                  <View style={styles.moreRowCopy}>
                    <Text style={styles.moreRowTitle}>{item.title}</Text>
                    <Text style={styles.moreRowDescription}>{item.detail}</Text>
                  </View>
                  <Text style={styles.moreArrow}>›</Text>
                </Pressable>
              ))}
            </>
          ) : null}

          {screen === 'Settings' ? (
            <>
              <View style={styles.introBlock}>
                <Text style={styles.eyebrow}>YOUR SPACE, YOUR WAY</Text>
                <Text style={styles.pageTitle}>A few small settings.</Text>
                <Text style={styles.bodyText}>
                  Your preferences and city pins stay on this device.
                </Text>
              </View>
              <View style={styles.settingsCard}>
                <Text style={styles.settingGroupTitle}>Appearance</Text>
                <Text style={styles.settingDescription}>Choose a calm, easy-on-the-eyes palette.</Text>
                <View style={styles.choiceRow}>
                  {(['light', 'dark', 'oled', 'sepia', 'midnight'] as const).map((appearance) => {
                    const locked = appearance === 'midnight' && !syncState?.featuresUnlocked.includes('premium-theme-collection');
                    const label = appearance === 'light'
                      ? 'Daylight'
                      : appearance === 'dark'
                        ? 'Night'
                        : appearance === 'oled'
                          ? 'OLED'
                          : appearance === 'sepia'
                            ? 'Parchment'
                            : locked ? 'Midnight · 14d' : 'Midnight';
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: theme === appearance, disabled: locked }}
                        disabled={locked}
                        key={appearance}
                        onPress={() => changePreferences((current) => ({ ...current, theme: appearance }))}
                        style={[styles.choice, theme === appearance && styles.selectedChoice, locked && styles.lockedChoice]}
                      >
                        <Text style={[styles.choiceText, theme === appearance && styles.selectedChoiceText]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.helperText}>Midnight unlocks after a 14-day Mishkah reading streak.</Text>
              </View>
              <View style={styles.settingsCard}>
                <Text style={styles.settingGroupTitle}>Prayer calculations</Text>
                <Text style={styles.settingDescription}>
                  Select the twilight convention used for Fajr and Isha.
                </Text>
                <View style={styles.methodGrid}>
                  {CALCULATION_METHODS.map((method) => (
                    <Pressable
                      key={method}
                      onPress={() =>
                        changePreferences((current) => ({ ...current, calculationMethod: method }))
                      }
                      style={[
                        styles.methodChoice,
                        preferences.calculationMethod === method && styles.selectedChoice,
                      ]}
                    >
                      <Text
                        style={[
                          styles.methodChoiceText,
                          preferences.calculationMethod === method && styles.selectedChoiceText,
                        ]}
                      >
                        {method}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.helperText}>
                  Calculated times are estimates. Local mosque timetables may include different adjustments.
                </Text>
              </View>
              <View style={styles.settingsCard}>
                <Text style={styles.settingGroupTitle}>Prayer-time reminders</Text>
                <Text style={styles.settingDescription}>
                  Choose local device reminders for each obligatory prayer. Sunrise is not a prayer reminder.
                </Text>
                {OBLIGATORY_PRAYERS.map((prayer) => (
                  <ToggleRow
                    key={prayer}
                    label={`${prayer} reminder`}
                    detail={PRAYER_REMINDER_DETAILS[prayer]}
                    enabled={preferences.prayerAlarms[prayer] === true}
                    palette={palette}
                    styles={styles}
                    onChange={(enabled) => void setPrayerAlarm(prayer, enabled)}
                  />
                ))}
                <Text style={styles.helperText}>
                  Reminders are calculated offline for the next 14 days. Notification permission is required on iOS and Android.
                </Text>
              </View>
              <View style={styles.settingsCard}>
                <Text style={styles.settingGroupTitle}>Private health report</Text>
                <Text style={styles.settingDescription}>
                  Run a private check of storage, preferences, and today’s verse. The email draft includes start and finish times, duration, and each result. Manāra does not keep report history or send reports in the background.
                </Text>
                <ActionButton
                  label={reportBusy ? 'Checking…' : 'Run check and email report'}
                  onPress={() => void runSystemReport()}
                  palette={palette}
                  styles={styles}
                  disabled={reportBusy}
                  busy={reportBusy}
                />
                <Text style={styles.privacyNote}>
                  A draft addressed to lixdeji@gmail.com opens in your email app; review it and tap Send. No crash-log contents, questions, or account details are included.
                </Text>
                {systemReport ? (
                  <View style={styles.syncCard}>
                    <Text style={styles.syncLabel}>MOST RECENT CHECK · THIS SESSION ONLY</Text>
                    <Text style={styles.syncMeta}>
                      {new Date(systemReport.startedAt).toLocaleString()} → {new Date(systemReport.finishedAt).toLocaleString()}
                    </Text>
                    <Text style={styles.syncMeta}>Duration: {(systemReport.durationMs / 1000).toFixed(2)} seconds</Text>
                    {systemReport.items.map((item) => (
                      <Text key={item.label} style={styles.syncMeta}>
                        {item.ok ? '✓' : '✗'} {item.label} — {item.detail}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
              <View style={styles.settingsCard}>
                <Text style={styles.settingGroupTitle}>A note from Mishkah</Text>
                <Text style={styles.settingDescription}>
                  {BRAND_TAGLINE}
                </Text>
                <View style={styles.supportRow}>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void openSupportLink('https://instagram.com/Lixzon9')}
                    style={styles.supportButton}
                  >
                    <Text style={styles.supportLabel}>Instagram</Text>
                    <Text style={styles.supportHandle}>@Lixzon9</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void openSupportLink('https://discord.com/app')}
                    style={styles.supportButton}
                  >
                    <Text style={styles.supportLabel}>Discord</Text>
                    <Text style={styles.supportHandle}>Lixzon8</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void openSupportLink('mailto:lixdeji@gmail.com')}
                    style={styles.supportButton}
                  >
                    <Text style={styles.supportLabel}>Email</Text>
                    <Text style={styles.supportHandle}>lixdeji@gmail.com</Text>
                  </Pressable>
                </View>
              </View>
            </>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.footerLine} />
            <Text style={styles.footerBrand}>by LIXZON</Text>
          </View>
          </Animated.View>
        </ScrollView>
        <StoryReader
          story={journeyStory}
          palette={palette}
          furqanBaseUrl={furqanBaseUrl}
          initialMode="long"
          onClose={() => setJourneyStory(null)}
          onNotice={setNotice}
        />
        {!isWideLayout ? (
        <View style={styles.bottomNav}>
          {PRIMARY_TABS.map((tab) => {
            const active = isPrimaryTabActive(tab.screen, screen);
            return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={tab.screen}
              onPress={() => setScreen(tab.screen)}
              style={[styles.bottomTab, active && styles.bottomTabActive]}
            >
              <Text style={[styles.bottomTabIcon, active && styles.bottomTabIconActive]}>
                {tab.icon}
              </Text>
              <Text numberOfLines={1} style={[styles.bottomTabLabel, active && styles.bottomTabLabelActive]}>
                {tab.label}
              </Text>
            </Pressable>
            );
          })}
        </View>
        ) : null}
        </View>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => setProfileModalVisible(false)}
        transparent
        visible={profileModalVisible}
      >
        <View style={styles.profileBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close profile"
            onPress={() => setProfileModalVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.profileDrawer}>
            <View style={styles.profileDrawerHandle} />
            <View style={styles.profileDrawerHeading}>
              <View>
                <Text style={styles.settingGroupTitle}>Your account</Text>
                <Text style={styles.settingDescription}>Your Manāra account and saved progress.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close profile"
                onPress={() => setProfileModalVisible(false)}
                style={styles.profileCloseButton}
              >
                <Text style={styles.profileCloseText}>×</Text>
              </Pressable>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setProfileModalVisible(false);
                setScreen('Settings');
              }}
              style={styles.profileSettingsLink}
            >
              <Text style={styles.textLink}>Open all settings</Text>
              <Text style={styles.faqArrow}>↗</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setStreakModalVisible(false)}
        transparent
        visible={streakModalVisible}
      >
        <View style={styles.profileBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close Mishkah streak details"
            onPress={() => setStreakModalVisible(false)}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.detailDrawer}>
            <View style={styles.profileDrawerHandle} />
            <View style={styles.profileDrawerHeading}>
              <View>
                <Text style={styles.settingGroupTitle}>Mishkah reading streak</Text>
                <Text style={styles.settingDescription}>Your progress from daily practice in Mishkah.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close streak details"
                onPress={() => setStreakModalVisible(false)}
                style={styles.profileCloseButton}
              >
                <Text style={styles.profileCloseText}>×</Text>
              </Pressable>
            </View>
            <View style={styles.streakHero}>
              <Text style={styles.streakHeroNumber}>{syncState?.streak ?? 0}</Text>
              <Text style={styles.streakHeroLabel}>day streak</Text>
              <Text style={styles.settingDescription}>
                {syncState?.streak
                  ? 'Keep returning to your daily practice to build your streak.'
                  : 'Start a daily practice in Mishkah to begin your streak.'}
              </Text>
            </View>
            <View style={styles.streakPanel}>
              {([
                { id: 'extended-hadith', days: 7, label: 'Expanded Hadith collection' },
                { id: 'premium-theme-collection', days: 14, label: 'Premium theme collection' },
                { id: 'reciter-library', days: 21, label: 'Audio reciter library' },
              ] as const).map((reward) => {
                const unlocked = syncState?.featuresUnlocked.includes(reward.id) === true;
                return (
                  <View key={reward.id} style={styles.rewardRow}>
                    <Text style={[styles.rewardMark, unlocked && styles.rewardMarkUnlocked]}>{unlocked ? '✓' : '·'}</Text>
                    <Text style={styles.rewardLabel}>{reward.label}</Text>
                    <Text style={styles.rewardRequirement}>{unlocked ? 'Unlocked' : `${reward.days} days`}</Text>
                  </View>
                );
              })}
            </View>
            <ActionButton
              label="Open app settings"
              onPress={() => {
                setStreakModalVisible(false);
                setScreen('Settings');
              }}
              palette={palette}
              styles={styles}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setUniversalSearchVisible(false)}
        transparent
        visible={universalSearchVisible}
      >
        <View style={styles.profileBackdrop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={() => setUniversalSearchVisible(false)} style={StyleSheet.absoluteFill} />
          <View style={styles.searchDrawer}>
            <View style={styles.profileDrawerHandle} />
            <Text style={styles.settingGroupTitle}>Search Mishkah</Text>
            <View style={styles.searchInputRow}>
              <TextInput
                accessibilityLabel="Search Mishkah features"
                autoFocus
                onChangeText={(value) => {
                  setUniversalSearchQuery(value);
                  setUniversalSearchStatus('');
                }}
                onSubmitEditing={() => submitUniversalSearch()}
                placeholder="Try Qibla, Du’a, Tasbeeh, fasting…"
                placeholderTextColor={palette.muted}
                returnKeyType="search"
                style={[styles.guideInput, styles.searchTextInput]}
                value={universalSearchQuery}
              />
              <VoiceSearchButton
                onStatus={setUniversalSearchStatus}
                onTranscript={(transcript) => {
                  setUniversalSearchQuery(transcript);
                  submitUniversalSearch(transcript);
                }}
              />
            </View>
            <Text accessibilityLiveRegion="polite" style={styles.searchHelper}>
              {universalSearchStatus || 'Search a feature by typing or tapping the microphone.'}
            </Text>
            <ActionButton label="Search and open" onPress={() => submitUniversalSearch()} palette={palette} styles={styles} />
            <Text style={styles.settingDescription}>Voice search uses your browser microphone when supported. Rafiq’s online answers are separate and require a configured secure service.</Text>
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setCapacityModalVisible(false)}
        transparent
        visible={capacityModalVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Text style={styles.modalIconText}>◎</Text>
            </View>
            <Text style={styles.modalTitle}>Slot capacity reached</Text>
            <Text style={styles.modalMessage}>
              Slot Capacity Reached (5/5). Unpin a location to add a new one.
            </Text>
            <ActionButton
              label="Understood"
              onPress={() => setCapacityModalVisible(false)}
              palette={palette}
              styles={styles}
            />
          </View>
        </View>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setPrayerCelebrationVisible(false)}
        transparent
        visible={prayerCelebrationVisible}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Text style={styles.modalIconText}>✦</Text>
            </View>
            <Text style={styles.modalTitle}>Hooray — you did it!</Text>
            <Text style={styles.modalMessage}>
              You marked all five daily prayers. May Allah bless your effort, accept your prayers, and keep you steadfast. May He reward you for this good deed.
            </Text>
            <ActionButton
              label="Hooray!"
              onPress={() => setPrayerCelebrationVisible(false)}
              palette={palette}
              styles={styles}
            />
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  detail,
  enabled,
  palette,
  styles,
  onChange,
}: {
  label: string;
  detail: string;
  enabled: boolean;
  palette: Palette;
  styles: ReturnType<typeof createStyles>;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDetail}>{detail}</Text>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled }}
        onPress={() => onChange(!enabled)}
        style={[styles.switchTrack, enabled && styles.switchTrackOn]}
      >
        <View style={[styles.switchThumb, enabled && styles.switchThumbOn]} />
      </Pressable>
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  palette,
  styles,
  disabled = false,
  busy = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  palette: Palette;
  styles: ReturnType<typeof createStyles>;
  disabled?: boolean;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, danger && styles.dangerActionButton, disabled && styles.disabledButton]}
    >
      {busy ? <ActivityIndicator color={palette.accentInk} size="small" /> : null}
      <Text style={[styles.actionButtonText, danger && styles.dangerActionButtonText]}>{label}</Text>
    </Pressable>
  );
}

function JumuahTimeField({
  cityName,
  value,
  styles,
  onSave,
  onInvalid,
}: {
  cityName: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
  onSave: (value: string) => void;
  onInvalid: () => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    const time = draft.trim();
    if (!time || isValidJumuahTime(time)) {
      onSave(time);
      return;
    }
    setDraft(value);
    onInvalid();
  };

  return (
    <View style={styles.jumuahEditor}>
      <View style={styles.jumuahEditorRow}>
        <Text style={styles.jumuahFieldLabel}>Jumu'ah · {cityName} local time</Text>
        <TextInput
          accessibilityLabel={`Jumu'ah time for ${cityName}, 24-hour format`}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
          onChangeText={setDraft}
          onEndEditing={commit}
          onSubmitEditing={commit}
          placeholder="13:30"
          placeholderTextColor="#82908A"
          returnKeyType="done"
          style={styles.jumuahTimeInput}
          value={draft}
        />
        <Pressable
          accessibilityRole="button"
          onPress={commit}
          style={styles.jumuahSaveButton}
        >
          <Text style={styles.jumuahSaveText}>Save</Text>
        </Pressable>
      </View>
      <Text style={styles.jumuahHelp}>Set your local mosque’s Friday prayer time in 24-hour format. This is separate from calculated Zuhr. Leave blank to clear it.</Text>
    </View>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    splashPage: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 35,
      paddingVertical: 36,
    },
    splashCenter: { alignItems: 'center', maxWidth: 300 },
    splashMark: {
      width: 58,
      height: 58,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    splashBrandImage: { width: 48, height: 48 },
    splashName: { color: colors.ink, fontSize: 28, fontWeight: '700', marginTop: 17 },
    splashTagline: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
      marginTop: 8,
    },
    splashSpinner: { marginTop: 26 },
    splashFooter: { color: colors.muted, fontSize: 9, fontWeight: '600', letterSpacing: 3 },
    screen: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center' },
    wideScreen: {
      maxWidth: '100%',
      alignSelf: 'stretch',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    mainColumn: { flex: 1, minWidth: 0, minHeight: 0, width: '100%' },
    mainColumnWide: { maxWidth: 1180, width: '100%', alignSelf: 'stretch' },
    desktopSidebar: {
      width: 218,
      paddingHorizontal: 13,
      paddingTop: 25,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.line,
      backgroundColor: colors.surface,
    },
    desktopNavButton: { minHeight: 49, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 13, borderRadius: 13, marginBottom: 5 },
    desktopNavButtonActive: { backgroundColor: colors.surfaceRaised },
    desktopNavIcon: { width: 22, color: colors.muted, fontSize: 16, textAlign: 'center' },
    desktopNavLabel: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    desktopNavLabelActive: { color: colors.accent, fontWeight: '700' },
    topBar: {
      minHeight: 76,
      paddingHorizontal: 22,
      paddingTop: Platform.OS === 'android' ? Math.max(NativeStatusBar.currentHeight ?? 0, 10) : 10,
      paddingBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    homeHeader: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    headerSpacer: { flex: 1 },
    contextHeader: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerBackButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerBackGlyph: { color: colors.accent, fontSize: 30, lineHeight: 34 },
    contextHeaderGlyph: {
      width: 38,
      height: 38,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: colors.goldTint,
      color: colors.accent,
      fontSize: 19,
      lineHeight: 38,
      textAlign: 'center',
    },
    contextHeaderTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
    contextHeaderSubtitle: { color: colors.muted, fontSize: 9, marginTop: 3 },
    brandLockup: { flexDirection: 'row', alignItems: 'center', gap: 11 },
    brandMark: {
      width: 38,
      height: 38,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#145B50',
    },
    brandImage: { width: 31, height: 31 },
    brandName: { color: colors.ink, fontSize: 19, fontWeight: '700', letterSpacing: 0.1 },
    brandCaption: { color: colors.muted, fontSize: 10, marginTop: 2 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    locationButton: {
      maxWidth: '55%',
      alignItems: 'flex-end',
      paddingVertical: 7,
      paddingLeft: 12,
    },
    locationLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
    locationName: { color: colors.ink, fontSize: 13, fontWeight: '600', marginTop: 4 },
    profileButton: { minWidth: 43, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
    headerActionButton: { minWidth: 42, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
    headerActionGlyph: { width: 30, height: 30, borderRadius: 15, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', backgroundColor: colors.surfaceRaised, color: colors.accent, fontSize: 17, lineHeight: 30 },
    streakGlyph: { backgroundColor: colors.goldTint, color: colors.gold },
    prayerGlyph: { backgroundColor: colors.accent, color: colors.accentInk },
    headerActionLabel: { color: colors.muted, fontSize: 8, fontWeight: '600', marginTop: 2 },
    profileGlyph: {
      width: 31,
      height: 31,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
    },
    profileGlyphText: { color: colors.accent, fontSize: 17, fontWeight: '600' },
    profileLabel: { color: colors.muted, fontSize: 8, fontWeight: '600', marginTop: 2 },
    bottomNav: {
      minHeight: 65,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
      backgroundColor: colors.surface,
      flexDirection: 'row',
      alignItems: 'stretch',
      paddingHorizontal: 6,
      paddingTop: 5,
      paddingBottom: 4,
      elevation: 10,
      shadowColor: '#000000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: -3 },
    },
    bottomTab: {
      flex: 1,
      minWidth: 54,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopWidth: 2,
      borderTopColor: 'transparent',
    },
    bottomTabActive: { borderTopColor: colors.accent },
    bottomTabIcon: { color: colors.muted, fontSize: 17, lineHeight: 21, minHeight: 22 },
    bottomTabIconActive: { color: colors.accent },
    bottomTabLabel: { color: colors.muted, fontSize: 9, fontWeight: '600', marginTop: 1 },
    bottomTabLabelActive: { color: colors.accent, fontWeight: '700' },
    contentScroll: { flex: 1, minHeight: 0 },
    contentMotion: { flexGrow: 1 },
    content: { paddingHorizontal: 20, paddingTop: 7, paddingBottom: 32 },
    qhdPhotoCard: { position: 'relative', overflow: 'hidden', marginTop: 9, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: '#14201D' },
    quotePhotoCard: { position: 'relative', overflow: 'hidden', marginTop: 9, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: '#14201D' },
    qhdPhotoScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 15, 13, 0.79)' },
    qhdPhotoContent: { padding: 16 },
    qhdVerse: { paddingBottom: 2 },
    qhdDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.25)', marginVertical: 13 },
    qhdLowerRow: { flexDirection: 'row', alignItems: 'stretch', gap: 11 },
    qhdLowerItem: { flex: 1, minWidth: 0, paddingVertical: 2 },
    qhdVerticalDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
    photoCardEyebrow: { color: '#E8D19A', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
    photoCardTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', lineHeight: 18, marginTop: 8 },
    photoCardBody: { color: 'rgba(255,255,255,0.88)', fontSize: 11, lineHeight: 17, marginTop: 7 },
    photoCardArabic: { color: '#FFFFFF', fontSize: 17, lineHeight: 29, textAlign: 'right', writingDirection: 'rtl', marginTop: 10 },
    photoCardLink: { color: '#C9E9D1', fontSize: 9, fontWeight: '700', lineHeight: 14, marginTop: 8 },
    quotePhotoText: { color: '#FFFFFF', fontSize: 16, lineHeight: 24, fontWeight: '600', marginTop: 13 },
    photoCardChip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', backgroundColor: 'rgba(255,255,255,0.12)' },
    photoCardChipText: { color: '#FFFFFF', fontSize: 9, fontWeight: '600' },
    dailyHighlightCard: { position: 'relative', overflow: 'hidden', padding: 17, marginTop: 9, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: '#14201D' },
    highlightPhotoScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 15, 13, 0.72)' },
    photoCalendarText: { color: '#FFFFFF' },
    photoCalendarMuted: { color: 'rgba(255,255,255,0.84)' },
    photoCalendarAccent: { color: '#E8D19A' },
    highlightEyebrow: { color: colors.gold, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
    highlightTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 9 },
    highlightBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
    calendarEventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 9, borderTopWidth: 1, borderTopColor: colors.line },
    calendarEventTitle: { color: colors.ink, fontSize: 12, fontWeight: '600' },
    calendarEventCountdown: { color: colors.accent, fontSize: 11, fontWeight: '700' },
    fastingGuidanceCard: {
      paddingHorizontal: 16,
      paddingTop: 15,
      paddingBottom: 14,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    fastingGuidanceIntro: { color: colors.muted, fontSize: 11, lineHeight: 17 },
    fastingGuidanceRow: {
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    fastingGuidanceLastRow: { borderBottomWidth: 0 },
    fastingGuidanceCopy: { flex: 1 },
    fastingGuidanceTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    fastingGuidanceTitle: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '700' },
    fastingGuidanceTag: { overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 9, fontSize: 7, fontWeight: '700', letterSpacing: 0.6 },
    fastingGuidanceObligatoryTag: { color: colors.accent, backgroundColor: colors.goldTint },
    fastingGuidanceVoluntaryTag: { color: colors.muted, backgroundColor: colors.surfaceRaised },
    fastingGuidanceDetail: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 5 },
    fastingGuidanceSource: { color: colors.accent, fontSize: 8, lineHeight: 12, marginTop: 4 },
    fastingGuidanceNote: {
      color: colors.muted,
      fontSize: 9,
      lineHeight: 14,
      backgroundColor: colors.surfaceRaised,
      padding: 10,
      borderRadius: 12,
      marginTop: 3,
    },
    highlightArabic: { color: colors.ink, fontSize: 19, lineHeight: 34, textAlign: 'right', writingDirection: 'rtl', marginTop: 12 },
    highlightLink: { color: colors.accent, fontSize: 10, fontWeight: '700', marginTop: 12 },
    retryVerseButton: { alignSelf: 'flex-start', marginTop: 5 },
    communityPreview: { padding: 22, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center' },
    communityIcon: { color: colors.gold, fontSize: 25 },
    communityTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 8 },
    notice: {
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: colors.goldTint,
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 14,
    },
    noticeText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 18 },
    noticeDismiss: { color: colors.muted, fontSize: 22, paddingLeft: 12 },
    introBlock: { marginBottom: 20 },
    eyebrow: { color: colors.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1.7 },
    pageTitle: { color: colors.ink, fontSize: 27, fontWeight: '600', letterSpacing: -0.5, marginTop: 8 },
    dateText: { color: colors.muted, fontSize: 13, marginTop: 6 },
    bodyText: { color: colors.muted, fontSize: 13, lineHeight: 20, marginTop: 8 },
    nextPrayerCard: {
      borderRadius: 25,
      paddingHorizontal: 22,
      paddingTop: 21,
      paddingBottom: 17,
      backgroundColor: colors.accent,
      overflow: 'hidden',
    },
    heroTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    heroEyebrow: { color: '#D6E8DB', fontSize: 9, fontWeight: '700', letterSpacing: 1.7 },
    heroLocation: { color: '#D6E8DB', fontSize: 10, maxWidth: '50%' },
    nextPrayerName: { color: colors.accentInk, fontSize: 31, fontWeight: '600', marginTop: 20 },
    heroTimeRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 2 },
    heroTime: { color: colors.accentInk, fontSize: 22, fontWeight: '500' },
    heroDivider: { color: '#C3DBCD', fontSize: 19, paddingHorizontal: 8 },
    countdown: { color: '#D6E8DB', fontSize: 14 },
    progressTrack: { height: 3, backgroundColor: '#ffffff35', borderRadius: 3, marginTop: 19 },
    progressFill: { height: 3, backgroundColor: colors.gold, borderRadius: 3 },
    heroFootnote: { color: '#D6E8DB', fontSize: 10, marginTop: 10 },
    sectionHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 25,
      marginBottom: 12,
    },
    sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '600' },
    sectionCaption: { color: colors.muted, fontSize: 11, marginTop: 4 },
    textLink: { color: colors.accent, fontSize: 12, fontWeight: '700' },
    prayerList: { backgroundColor: colors.surface, borderRadius: 20, paddingHorizontal: 16 },
    prayerRow: {
      minHeight: 51,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    lastPrayerRow: { borderBottomWidth: 0 },
    prayerNameGroup: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    prayerDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line },
    activePrayerDot: { backgroundColor: colors.gold },
    prayerName: { color: colors.muted, fontSize: 13 },
    jumuahDot: { backgroundColor: colors.gold },
    activePrayerName: { color: colors.accent, fontWeight: '700' },
    nextTag: { color: colors.gold, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
    prayerTime: { color: colors.ink, fontSize: 13, fontWeight: '500' },
    prayerRowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    prayerCheckButton: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
    prayerCheckButtonDone: { backgroundColor: colors.accent, borderColor: colors.accent },
    prayerCheckButtonDisabled: { opacity: 0.4 },
    prayerCheckText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
    prayerCheckTextDone: { color: colors.accentInk },
    inlineCards: { flexDirection: 'row', gap: 10, marginTop: 13 },
    softCard: {
      flex: 1,
      minHeight: 112,
      borderRadius: 18,
      padding: 14,
      backgroundColor: colors.surfaceRaised,
    },
    photoSoftCard: { position: 'relative', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
    softCardScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 15, 13, 0.62)' },
    photoSoftCardContent: { position: 'relative' },
    photoSoftCardSymbol: { color: '#E8D19A', fontSize: 17 },
    photoSoftCardTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', marginTop: 8 },
    photoSoftCardBody: { color: 'rgba(255,255,255,0.84)', fontSize: 10, marginTop: 4 },
    softCardSymbol: { color: colors.gold, fontSize: 17 },
    softCardTitle: { color: colors.ink, fontSize: 12, fontWeight: '600', marginTop: 8 },
    softCardBody: { color: colors.muted, fontSize: 10, marginTop: 4 },
    searchBox: {
      height: 48,
      borderRadius: 15,
      paddingHorizontal: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
      flexDirection: 'row',
      alignItems: 'center',
    },
    searchIcon: { color: colors.accent, fontSize: 23, marginRight: 8 },
    searchInput: { flex: 1, color: colors.ink, fontSize: 13, paddingVertical: 0 },
    resultList: { marginTop: 8, backgroundColor: colors.surface, borderRadius: 16, paddingHorizontal: 14 },
    cityResult: {
      minHeight: 54,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomColor: colors.line,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    cityResultCopy: { flex: 1 },
    cityName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
    cityCountry: { color: colors.muted, fontSize: 10, marginTop: 4 },
    addCityLabel: { color: colors.accent, fontSize: 12, fontWeight: '700', padding: 10 },
    emptySearch: { color: colors.muted, fontSize: 12, paddingVertical: 18 },
    popularChips: { marginTop: 16 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    cityChip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surfaceRaised, borderRadius: 30 },
    cityChipLabel: { color: colors.ink, fontSize: 11 },
    globalCityCard: {
      borderRadius: 18,
      backgroundColor: colors.surface,
      padding: 15,
      marginBottom: 10,
    },
    globalCityRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    globalCityMain: { flex: 1 },
    cityPrayerPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
    cityPrayerLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
    cityPrayerValue: { color: colors.accent, fontSize: 11, fontWeight: '600', marginRight: 6 },
    jumuahEditor: { marginTop: 14, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
    jumuahEditorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    jumuahFieldLabel: { color: colors.ink, flex: 1, fontSize: 11, fontWeight: '600' },
    jumuahTimeInput: {
      minWidth: 68,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surfaceRaised,
      color: colors.ink,
      fontSize: 13,
      paddingHorizontal: 10,
      paddingVertical: 8,
      textAlign: 'center',
    },
    jumuahSaveButton: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 10,
      justifyContent: 'center',
      minHeight: 36,
      paddingHorizontal: 11,
    },
    jumuahSaveText: { color: colors.accentInk, fontSize: 10, fontWeight: '700' },
    jumuahHelp: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 7 },
    fixedCityBadge: { color: colors.gold, fontSize: 9, fontWeight: '800', letterSpacing: 0.7, paddingHorizontal: 8, paddingVertical: 6 },
    removeCityButton: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: colors.surfaceRaised,
    },
    removeCityText: { color: colors.muted, fontSize: 20, lineHeight: 21 },
    helperText: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 9 },
    routineCard: { borderRadius: 21, padding: 18, backgroundColor: colors.surface, marginBottom: 13 },
    routineIcon: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: colors.goldTint,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 15,
    },
    iftarIcon: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 15,
    },
    routineIconText: { color: colors.gold, fontSize: 19 },
    routineEyebrow: { color: colors.gold, fontSize: 9, fontWeight: '700', letterSpacing: 1.4 },
    routineTitle: { color: colors.ink, fontSize: 19, fontWeight: '600', marginTop: 6 },
    routineBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: 9 },
    leadChoices: { flexDirection: 'row', gap: 8, marginVertical: 12 },
    leadChoice: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 22, backgroundColor: colors.surfaceRaised },
    selectedLeadChoice: { backgroundColor: colors.accent },
    leadChoiceText: { color: colors.muted, fontSize: 11 },
    selectedLeadChoiceText: { color: colors.accentInk, fontWeight: '600' },
    toggleRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
      paddingTop: 14,
      marginTop: 6,
      flexDirection: 'row',
      alignItems: 'center',
    },
    toggleCopy: { flex: 1, paddingRight: 12 },
    toggleLabel: { color: colors.ink, fontSize: 12, fontWeight: '600' },
    toggleDetail: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
    switchTrack: {
      width: 44,
      height: 25,
      borderRadius: 14,
      padding: 3,
      backgroundColor: colors.line,
      justifyContent: 'center',
    },
    switchTrackOn: { backgroundColor: colors.accent },
    switchThumb: { width: 19, height: 19, borderRadius: 10, backgroundColor: '#FFFFFF' },
    switchThumbOn: { alignSelf: 'flex-end' },
    checklistCard: { backgroundColor: colors.surface, borderRadius: 19, paddingHorizontal: 15 },
    checklistRow: {
      minHeight: 63,
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    checkbox: {
      width: 21,
      height: 21,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    checkedBox: { borderColor: colors.accent, backgroundColor: colors.accent },
    checkmark: { color: colors.accentInk, fontSize: 13, fontWeight: '700' },
    checklistCopy: { flex: 1, paddingVertical: 10 },
    checklistTitle: { color: colors.ink, fontSize: 12, fontWeight: '500' },
    completedText: { color: colors.muted, textDecorationLine: 'line-through' },
    checklistDetail: { color: colors.muted, fontSize: 10, marginTop: 4 },
    assistantCard: { backgroundColor: colors.surface, borderRadius: 21, padding: 17 },
    assistantHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
    assistantMark: {
      height: 39,
      width: 39,
      borderRadius: 15,
      backgroundColor: colors.goldTint,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 11,
    },
    assistantMarkText: { color: colors.gold, fontSize: 19 },
    assistantTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
    localBadge: { color: colors.accent, fontSize: 8, fontWeight: '700', letterSpacing: 1, marginTop: 4 },
    guideInput: {
      minHeight: 47,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 13,
      color: colors.ink,
      paddingHorizontal: 12,
      fontSize: 12,
    },
    guideActions: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
    siblingActions: { gap: 8, marginTop: 16 },
    searchInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 5,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: 14,
      backgroundColor: colors.surface,
      marginTop: 12,
    },
    searchTextInput: { flex: 1, minWidth: 0, borderWidth: 0, marginTop: 0 },
    searchHelper: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 6 },
    actionButton: {
      minHeight: 43,
      paddingHorizontal: 15,
      paddingVertical: 11,
      borderRadius: 13,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
      marginTop: 10,
    },
    disabledButton: { opacity: 0.65 },
    actionButtonText: { color: colors.accentInk, fontSize: 12, fontWeight: '700' },
    dangerActionButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    dangerActionButtonText: { color: colors.danger },
    answerCard: { backgroundColor: colors.surfaceRaised, borderRadius: 15, padding: 14, marginTop: 14 },
    answerTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
    answerText: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 7 },
    faqRow: {
      minHeight: 45,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    faqText: { color: colors.ink, fontSize: 12 },
    faqArrow: { color: colors.gold, fontSize: 14 },
    disclaimerCard: { backgroundColor: colors.goldTint, padding: 15, borderRadius: 15, marginTop: 18 },
    disclaimerTitle: { color: colors.ink, fontSize: 12, fontWeight: '600' },
    disclaimerText: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
    settingsCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 16, marginBottom: 12 },
    moreAccountRow: {
      minHeight: 67,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 13,
      borderRadius: 15,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    streakPanel: { marginTop: 10, paddingHorizontal: 13, paddingVertical: 12, borderRadius: 15, backgroundColor: colors.surfaceRaised },
    streakHero: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 20,
      paddingHorizontal: 16,
      marginTop: 12,
      borderRadius: 18,
      backgroundColor: colors.goldTint,
    },
    streakHeroNumber: { color: colors.accent, fontSize: 48, fontWeight: '800', lineHeight: 54 },
    streakHeroLabel: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: 4 },
    streakHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 8 },
    streakCount: { color: colors.accent, fontSize: 24, fontWeight: '700' },
    streakUnit: { color: colors.muted, fontSize: 9, fontWeight: '500' },
    rewardRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
    rewardMark: { width: 21, color: colors.muted, fontSize: 16, fontWeight: '700' },
    rewardMarkUnlocked: { color: colors.accent },
    rewardLabel: { flex: 1, color: colors.ink, fontSize: 10 },
    rewardRequirement: { color: colors.muted, fontSize: 9 },
    moreSectionHeading: { marginTop: 22, marginBottom: 9 },
    moreToolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
    moreTool: {
      flexGrow: 1,
      flexBasis: '47%',
      minWidth: 145,
      minHeight: 112,
      padding: 13,
      borderRadius: 15,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.line,
    },
    moreListRow: {
      minHeight: 61,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    moreListIcon: {
      width: 34,
      height: 34,
      borderRadius: 12,
      marginRight: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
    },
    moreIcon: {
      width: 35,
      height: 35,
      borderRadius: 13,
      marginRight: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
    },
    moreIconText: { color: colors.accent, fontSize: 17, fontWeight: '600' },
    moreRowCopy: { flex: 1, minWidth: 0 },
    moreRowTitle: { color: colors.ink, fontSize: 12, fontWeight: '600' },
    moreRowDescription: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 },
    moreArrow: { color: colors.muted, fontSize: 20, paddingHorizontal: 5 },
    profileBackdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: '#07161588',
    },
    profileDrawer: {
      width: '100%',
      maxWidth: 760,
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 11,
      paddingBottom: 24,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      backgroundColor: colors.surface,
    },
    detailDrawer: {
      width: '100%',
      maxWidth: 620,
      maxHeight: '92%',
      alignSelf: 'center',
      paddingHorizontal: 20,
      paddingTop: 11,
      paddingBottom: 24,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      backgroundColor: colors.surface,
    },
    prayerDrawer: {
      width: '100%',
      maxWidth: 620,
      maxHeight: '92%',
      alignSelf: 'center',
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      backgroundColor: colors.surface,
    },
    prayerDrawerContent: {
      paddingHorizontal: 20,
      paddingTop: 11,
      paddingBottom: 24,
    },
    searchDrawer: {
      width: '100%',
      maxWidth: 500,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 12,
      paddingBottom: 28,
      backgroundColor: colors.surface,
    },
    profileDrawerHandle: {
      width: 38,
      height: 4,
      borderRadius: 3,
      backgroundColor: colors.line,
      alignSelf: 'center',
      marginBottom: 17,
    },
    profileDrawerHeading: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    profileCloseButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileCloseText: { color: colors.muted, fontSize: 22, lineHeight: 24 },
    profileSettingsLink: {
      minHeight: 42,
      marginTop: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    settingGroupTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
    settingDescription: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
    syncCard: {
      backgroundColor: colors.surfaceRaised,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginTop: 12,
    },
    syncLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
    syncValue: { color: colors.ink, fontSize: 16, fontWeight: '600', marginTop: 6 },
    syncMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
    inlineActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    choiceRow: { flexDirection: 'row', gap: 9, marginTop: 13 },
    choice: {
      flex: 1,
      minHeight: 39,
      borderRadius: 12,
      borderColor: colors.line,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedChoice: { borderColor: colors.accent, backgroundColor: colors.surfaceRaised },
    lockedChoice: { opacity: 0.52 },
    choiceText: { color: colors.muted, fontSize: 11 },
    selectedChoiceText: { color: colors.accent, fontWeight: '700' },
    methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
    methodChoice: {
      minWidth: '45%',
      minHeight: 38,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderColor: colors.line,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    methodChoiceText: { color: colors.muted, fontSize: 11 },
    healthMessage: { color: colors.accent, fontSize: 11, lineHeight: 17, marginTop: 10 },
    privacyNote: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 11 },
    supportRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 },
    supportButton: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.surfaceRaised, padding: 12, borderRadius: 13 },
    supportLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
    supportHandle: { color: colors.accent, fontSize: 12, fontWeight: '600', marginTop: 5 },
    footer: { alignItems: 'center', marginTop: 27, marginBottom: 6 },
    footerLine: { width: 35, height: 1, backgroundColor: colors.line, marginBottom: 12 },
    footerBrand: { color: colors.muted, fontSize: 9, fontWeight: '600', letterSpacing: 3 },
    modalBackdrop: {
      flex: 1,
      padding: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#071615B8',
    },
    modalCard: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 24,
      backgroundColor: colors.surface,
      padding: 23,
      alignItems: 'center',
    },
    modalIcon: {
      width: 49,
      height: 49,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.goldTint,
    },
    modalIconText: { color: colors.gold, fontSize: 24 },
    modalTitle: { color: colors.ink, fontSize: 19, fontWeight: '600', marginTop: 14 },
    modalMessage: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 20,
      textAlign: 'center',
      marginTop: 8,
      marginBottom: 10,
    },
    modalActions: { width: '100%', flexDirection: 'row', gap: 10, marginTop: 8 },
    modalSecondaryButton: {
      flex: 1,
      minHeight: 43,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalSecondaryText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
    modalDangerButton: {
      flex: 1,
      minHeight: 43,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalDangerText: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  });
}
