import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import { useIdTokenAuthRequest } from 'expo-auth-session/providers/google';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
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
import { getLocalAnswer, getLocalFaqs } from './src/domain/assistant';
import {
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
  isValidJumuahTime,
  type PrayerName,
} from './src/domain/prayer';
import {
  getIslamicDate,
  getUpcomingIslamicEvents,
  HIJRI_MONTHS,
} from './src/domain/islamicCalendar';
import {
  checkDiagnosticsStorage,
  isSecureDiagnosticsAvailable,
  installUnhandledExceptionRecorder,
  readDiagnosticEntries,
  buildFridayDigest,
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
import { GoogleSignInButton } from './src/components/GoogleSignInButton';
import { AiAssistantBar, type AssistantDestination } from './src/components/AiAssistantBar';
import { WorshipHub, type WorshipTab } from './src/components/WorshipHub';
import { GuidanceHub } from './src/components/GuidanceHub';
import { HISN_AL_MUSLIM_DUAS } from './src/domain/adhkar';
import { getDailyHadith } from './src/domain/hadith';
import { resetPostSalahCounts } from './src/domain/tasbeeh';
import { getDailyVerse, type DailyVerse } from './src/services/dailyVerse';
import { clearAuthSession, isAuthSessionExpired, loadAuthSession, saveAuthSession } from './src/services/auth';
import {
  connectSupabaseGoogleAccount,
  disconnectSupabaseAccount,
  isSupabaseSyncConfigured,
  subscribeToSharedRecords,
} from './src/services/cloudSync';
import {
  connectGoogleAccount,
  disconnectGoogleAccount,
  flushSyncQueue,
  isCrossDeviceSyncConfigured,
  readSyncState,
  refreshFurqanProgress,
  syncEngagement,
  type SyncState,
} from './src/services/syncEngine';

WebBrowser.maybeCompleteAuthSession();

type Screen = 'Prayer' | 'Global' | 'Fasting' | 'Guide' | 'More' | 'Worship' | 'Settings' | 'Community';
type PrimaryScreen = 'Prayer' | 'Worship' | 'Community' | 'Guide' | 'More';
const PRIMARY_TABS: readonly { screen: PrimaryScreen; label: string; icon: string }[] = [
  { screen: 'Prayer', label: 'Home', icon: '⌂' },
  { screen: 'Worship', label: 'Library', icon: '▤' },
  { screen: 'Community', label: 'Community Hub', icon: '◎' },
  { screen: 'Guide', label: 'Guidance', icon: '✦' },
  { screen: 'More', label: 'Profile', icon: '◉' },
];

function isPrimaryTabActive(tab: PrimaryScreen, screen: Screen): boolean {
  switch (tab) {
    case 'Prayer':
      return screen === 'Prayer' || screen === 'Global' || screen === 'Fasting';
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

const PALETTES: Record<'light' | 'dark' | 'midnight', Palette> = {
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
const UNCONFIGURED_GOOGLE_CLIENT_ID = 'unconfigured-google-client-id';
const DEV_KEY_DIGEST: unknown = Constants.expoConfig?.extra?.developerKeyDigest;

void SplashScreen.preventAutoHideAsync().catch((error: unknown) => {
  console.error('Mishkah could not hold the native splash screen.', error);
});

function isValidDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function secureStringEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

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

export default function App() {
  const { width: windowWidth } = useWindowDimensions();
  const isWideLayout = Platform.OS === 'web' && windowWidth >= 980;
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const preferencesRef = useRef(preferences);
  const [isReady, setIsReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('Prayer');
  const [now, setNow] = useState(new Date());
  const [appState, setAppState] = useState(
    AppState.currentState == null || AppState.currentState === 'active' ? 'active' : 'background',
  );
  const [notice, setNotice] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [capacityModalVisible, setCapacityModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [universalSearchVisible, setUniversalSearchVisible] = useState(false);
  const [universalSearchQuery, setUniversalSearchQuery] = useState('');
  const [worshipTab, setWorshipTab] = useState<WorshipTab>('Hadith');
  const [guideQuery, setGuideQuery] = useState('');
  const [guideAnswer, setGuideAnswer] = useState(getLocalAnswer(''));
  const [healthMessage, setHealthMessage] = useState('');
  const [developerKey, setDeveloperKey] = useState('');
  const [developerUnlocked, setDeveloperUnlocked] = useState(false);
  const [developerMessage, setDeveloperMessage] = useState('');
  const [developerDigest, setDeveloperDigest] = useState('');
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [authSession, setAuthSession] = useState<Awaited<ReturnType<typeof loadAuthSession>>>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const [dailyVerse, setDailyVerse] = useState<DailyVerse | null>(null);
  const [dailyVerseError, setDailyVerseError] = useState('');
  const [refreshingVerse, setRefreshingVerse] = useState(false);
  const googleWebClientId = String(Constants.expoConfig?.extra?.googleWebClientId ?? '').trim();
  const googleIosClientId = String(Constants.expoConfig?.extra?.googleIosClientId ?? '').trim();
  const googleAndroidClientId = String(Constants.expoConfig?.extra?.googleAndroidClientId ?? '').trim();
  const syncApiUrl = String(Constants.expoConfig?.extra?.syncApiUrl ?? '').trim();
  const syncConfigured = isCrossDeviceSyncConfigured();
  const googleClientId = Platform.select({
    ios: googleIosClientId,
    android: googleAndroidClientId,
    default: googleWebClientId,
  }) ?? '';

  const [request, response, promptAsync] = useIdTokenAuthRequest(
    {
      webClientId: googleWebClientId || UNCONFIGURED_GOOGLE_CLIENT_ID,
      iosClientId: googleIosClientId || UNCONFIGURED_GOOGLE_CLIENT_ID,
      androidClientId: googleAndroidClientId || UNCONFIGURED_GOOGLE_CLIENT_ID,
      scopes: ['profile', 'email'],
      selectAccount: true,
    },
    { scheme: 'mishkah' },
  );

  const theme = preferences.theme;
  const palette = PALETTES[theme];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const city =
    getCity(preferences.selectedCityId) ??
    getCity(DEFAULT_PREFERENCES.selectedCityId);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadPreferences().then(async (loadedPreferences) => {
        await savePreferences(loadedPreferences);
        if (active) {
          preferencesRef.current = loadedPreferences;
          setPreferences(loadedPreferences);
        }
      }),
      loadAuthSession().then((session) => {
        if (active && session && !isAuthSessionExpired(session)) {
          setAuthSession(session);
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
    if (appState !== 'active' || !authSession || !syncConfigured) return;
    let active = true;
    void refreshFurqanProgress(authSession.idToken)
      .then((next) => {
        if (active && next) setSyncState(next);
      })
      .catch((error: unknown) => {
        if (active) setAuthMessage(`Furqan progress could not refresh: ${friendlyError(error, 'sync service unavailable')}`);
      });
    return () => {
      active = false;
    };
  }, [appState, authSession?.idToken, syncConfigured]);

  useEffect(() => {
    if (!authSession || !isSupabaseSyncConfigured()) return;
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => Promise<void>) | undefined;
    void subscribeToSharedRecords((record) => {
      if (
        active &&
        (record.record_key === 'furqan.progression' ||
          record.record_key.startsWith('furqan.memorized:') ||
          record.record_key.startsWith('quran.daily-highlight:'))
      ) {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          void refreshFurqanProgress(authSession.idToken)
            .then((next) => {
              if (active && next) setSyncState(next);
            })
            .catch((error: unknown) => {
              if (active) setAuthMessage(`Shared Furqan progress could not refresh: ${friendlyError(error, 'sync service unavailable')}`);
            });
        }, 300);
      }
    })
      .then((cleanup) => {
        if (active) unsubscribe = cleanup;
        else void cleanup();
      })
      .catch((error: unknown) => {
        if (active) setAuthMessage(`Live sync could not start: ${friendlyError(error, 'please try syncing again')}`);
      });
    return () => {
      active = false;
      if (refreshTimer) clearTimeout(refreshTimer);
      if (unsubscribe) void unsubscribe();
    };
  }, [authSession?.idToken]);

  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params.id_token || response.authentication?.idToken;
      if (!idToken) {
        setAuthLoading(false);
        setAuthMessage('Google sign-in completed without an ID token. Please try again.');
        return;
      }
      const session = {
        provider: 'google' as const,
        idToken,
        accessToken: response.authentication?.accessToken,
        name: 'Google account',
        linkedAt: Date.now(),
        expiresAt: Date.now() + (response.authentication?.expiresIn ?? 3600) * 1000,
      };
      void (async () => {
        try {
          await saveAuthSession(session);
          const next = await connectGoogleAccount({ name: session.name });
          setAuthSession(session);
          setSyncState(next);
          if (isSupabaseSyncConfigured()) {
            try {
              await connectSupabaseGoogleAccount(session.idToken, session.accessToken);
              setAuthMessage('Google account connected to LIXZON shared sync.');
            } catch (error) {
              setAuthMessage(`Google sign-in is active locally, but Supabase sync could not connect: ${friendlyError(error, 'check the Supabase Google provider setup')}`);
            }
          } else {
            setAuthMessage(syncApiUrl
              ? 'Google sign-in is active on this device.'
              : 'Google sign-in is active locally. Configure Supabase to enable cross-app sync.');
          }
        } catch (error) {
          setAuthMessage(`Google sign-in could not be saved: ${friendlyError(error, 'secure storage is unavailable')}`);
        } finally {
          setAuthLoading(false);
        }
      })();
    }

    if (response?.type === 'error') {
      setAuthLoading(false);
      setAuthMessage('Google sign-in could not be completed.');
    }
  }, [response]);

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
        events: getUpcomingIslamicEvents(localDate),
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
  const dailyHadith = getDailyHadith(now);
  const [duaYear, duaMonth, duaDay] = localDate.split('-').map(Number);
  const duaDayOfYear = localDate
    ? Math.floor((Date.UTC(duaYear, duaMonth - 1, duaDay) - Date.UTC(duaYear, 0, 1)) / 86_400_000)
    : 0;
  const dailyDua = HISN_AL_MUSLIM_DUAS[duaDayOfYear % HISN_AL_MUSLIM_DUAS.length];
  const furqanBaseUrl = String(Constants.expoConfig?.extra?.furqanBaseUrl ?? '').trim().replace(/\/$/, '');

  const refreshDailyVerse = useCallback(async (forceRefresh = false) => {
    setRefreshingVerse(true);
    try {
      setDailyVerse(await getDailyVerse(new Date(), forceRefresh));
      setDailyVerseError('');
    } catch (error) {
      setDailyVerseError(friendlyError(error, 'The verse of the day could not be loaded.'));
    } finally {
      setRefreshingVerse(false);
    }
  }, []);

  useEffect(() => {
    if (isReady) void refreshDailyVerse(false);
  }, [isReady, localDate, refreshDailyVerse]);
  const prayerTimes = city
    ? getPrayerTimes(city, now, preferences.calculationMethod)
    : undefined;
  const nextPrayer = city && prayerTimes ? nextPrayerAt(prayerTimes, now, city.timeZone) : undefined;
  const jumuahTime = city ? preferences.jumuahTimesByCity[city.id] : undefined;
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
      selectedCityId: selectedCity.id,
    }));
    setScreen('Prayer');
    setCityQuery('');
  };

  const removeCity = (cityId: string) => {
    if (preferencesRef.current.pinnedCityIds.length === 1) {
      setNotice('Keep at least one pinned city to see a prayer schedule.');
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

  const runHealthCheck = async () => {
    setIsCheckingHealth(true);
    setHealthMessage('');
    try {
      if (!(await isSecureDiagnosticsAvailable())) {
        setHealthMessage('Private diagnostics are available in the iOS and Android apps, not this browser.');
        return;
      }
      if (!(await checkPreferencesStorage())) {
        throw new Error('Saved app preferences are not available.');
      }
      await checkDiagnosticsStorage();
      const entries = await readDiagnosticEntries();
      setHealthMessage(
        entries.length > 0
          ? 'A small issue was recorded for developer review. Your private logs stay on this device.'
          : 'Everything looks well. No issues have been logged.',
      );
    } catch (error) {
      console.error('Mishkah could not complete its private health check.', error);
      setHealthMessage('The private health check could not finish. Your technical logs remain private on this device.');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  const unlockDeveloperTools = async () => {
    if (!isValidDigest(DEV_KEY_DIGEST)) {
      setDeveloperMessage('Developer access is not configured for this build.');
      return;
    }
    if (!developerKey.trim()) {
      setDeveloperMessage('Enter the configured master key to continue.');
      return;
    }
    try {
      const enteredDigest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        developerKey,
      );
      if (!secureStringEqual(enteredDigest, DEV_KEY_DIGEST)) {
        setDeveloperMessage('That key did not match.');
        return;
      }
      const entries = await readDiagnosticEntries();
      setDeveloperUnlocked(true);
      setDeveloperDigest(buildFridayDigest(entries));
      setDeveloperMessage(`${entries.length} encrypted exception${entries.length === 1 ? '' : 's'} in the local ring buffer.`);
      setDeveloperKey('');
    } catch (error) {
      setDeveloperMessage(`Developer diagnostics could not be opened: ${friendlyError(error, 'secure storage is unavailable')}`);
    }
  };

  const refreshDeveloperDigest = async () => {
    try {
      const entries = await readDiagnosticEntries();
      setDeveloperDigest(buildFridayDigest(entries));
      setDeveloperMessage(`${entries.length} encrypted exception${entries.length === 1 ? '' : 's'} in the local ring buffer.`);
    } catch (error) {
      setDeveloperMessage(`The local digest could not be read: ${friendlyError(error, 'secure storage is unavailable')}`);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!request || !googleClientId) {
      const requiredVariable = Platform.select({
        ios: 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
        android: 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
        default: 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
      });
      setAuthMessage(`Configure ${requiredVariable} before enabling Google sign-in.`);
      return;
    }

    setAuthLoading(true);
    setAuthMessage('');
    try {
      const result = await promptAsync();
      if (result.type === 'cancel' || result.type === 'dismiss') {
        setAuthMessage('Google sign-in was cancelled.');
      } else if (result.type === 'error') {
        setAuthMessage('Google authentication could not be completed.');
      }
    } catch (error) {
      setAuthMessage(`Google sign-in failed: ${friendlyError(error, 'please try again')}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    try {
      await disconnectSupabaseAccount();
    } catch (error) {
      setAuthMessage(`Supabase sign-out could not complete: ${friendlyError(error, 'please retry')}`);
      return;
    }
    await clearAuthSession();
    const next = await disconnectGoogleAccount();
    setAuthSession(null);
    setSyncState(next);
    setAuthMessage('Google account disconnected.');
  };

  const handleSyncNow = async () => {
    try {
      const next = await flushSyncQueue(authSession?.idToken ?? '');
      const progress = await refreshFurqanProgress(authSession?.idToken ?? '');
      setSyncState(progress ?? next);
      setNotice(next.queuedCount ? `${next.queuedCount} updates are still waiting for sync.` : 'Your queued updates are synced.');
    } catch (error) {
      setNotice(friendlyError(error, 'Sync could not complete. Your updates remain queued on this device.'));
      const latest = await readSyncState();
      setSyncState(latest);
    }
  };

  const openSupportLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setNotice('This support link could not be opened on your device.');
    }
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
    if (prayerName === 'Sunrise') return;
    const completed = preferences.prayerChecklistDate === localDate
      ? preferences.completedPrayers
      : [];
    const alreadyCompleted = completed.includes(prayerName);
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
  };

  const askGuide = (query: string) => {
    setGuideQuery(query);
    setGuideAnswer(getLocalAnswer(query));
  };

  const submitUniversalSearch = () => {
    const query = universalSearchQuery.trim();
    if (!query) return;
    const normalized = query.toLocaleLowerCase();
    const destination: Screen = /community|project idea|event idea/.test(normalized)
      ? 'Community'
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
    setScreen(destination);
    if (destination === 'Guide') askGuide(query);
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
            <Text style={styles.sidebarBrand}>Mishkah</Text>
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mishkah home"
            onPress={() => setScreen('Prayer')}
            style={styles.brandLockup}
          >
            <View style={styles.brandMark}>
              <Image
                source={require('./assets/brand-mark.png')}
                resizeMode="contain"
                style={styles.brandImage}
              />
            </View>
            <View>
              <Text style={styles.brandName}>Mishkah</Text>
              <Text style={styles.brandCaption}>A little light, wherever you are</Text>
            </View>
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change your city"
              onPress={() => setScreen('Global')}
              style={styles.locationButton}
            >
              <Text style={styles.locationLabel}>YOUR CITY</Text>
              <Text style={styles.locationName} numberOfLines={1}>
                {city.name}⌄
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Open Rafiq guidance" onPress={() => setScreen('Guide')} style={styles.headerActionButton}>
              <Text style={styles.headerActionGlyph}>✦</Text>
              <Text style={styles.headerActionLabel}>Rafiq</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Search Mishkah" onPress={() => setUniversalSearchVisible(true)} style={styles.headerActionButton}>
              <Text style={styles.headerActionGlyph}>⌕</Text>
              <Text style={styles.headerActionLabel}>Search</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={screen === 'Prayer' ? (
            <RefreshControl
              onRefresh={() => void refreshDailyVerse(true)}
              refreshing={refreshingVerse}
              tintColor={palette.accent}
            />
          ) : undefined}
          showsVerticalScrollIndicator={false}
        >
          {notice ? (
            <Pressable accessibilityRole="button" onPress={() => setNotice('')} style={styles.notice}>
              <Text style={styles.noticeText}>{notice}</Text>
              <Text style={styles.noticeDismiss}>×</Text>
            </Pressable>
          ) : null}

          {screen === 'Prayer' ? (
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

              <View style={styles.dailyHighlightCard}>
                <Text style={styles.highlightEyebrow}>ISLAMIC CALENDAR · ESTIMATE</Text>
                {islamicCalendar?.date ? (
                  <>
                    <Text style={styles.highlightTitle}>
                      {islamicCalendar.date.day} {HIJRI_MONTHS[islamicCalendar.date.month - 1]} {islamicCalendar.date.year} AH
                    </Text>
                    <Text style={styles.highlightBody}>
                      {city.name} · dates may differ by local moon sighting.
                    </Text>
                    {islamicCalendar.events.map((event) => (
                      <View key={`${event.id}:${event.hijriYear}`} style={styles.calendarEventRow}>
                        <Text style={styles.calendarEventTitle}>{event.title}</Text>
                        <Text style={styles.calendarEventCountdown}>
                          {event.daysUntil === 0 ? 'Today' : `In ${event.daysUntil} days`}
                        </Text>
                      </View>
                    ))}
                  </>
                ) : (
                  <Text style={styles.highlightBody}>
                    {islamicCalendar?.error ?? 'Islamic calendar dates are unavailable.'}
                  </Text>
                )}
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
                  return (
                    <View
                      key={prayerName}
                      style={[
                        styles.prayerRow,
                        index === PRAYER_ORDER.length - 1 && styles.lastPrayerRow,
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
                            accessibilityLabel={`${prayerName} prayer completed`}
                            accessibilityState={{ checked: prayerCompleted }}
                            onPress={() => togglePrayer(prayerName)}
                            style={[styles.prayerCheckButton, prayerCompleted && styles.prayerCheckButtonDone]}
                          >
                            <Text style={[styles.prayerCheckText, prayerCompleted && styles.prayerCheckTextDone]}>
                              {prayerCompleted ? '✓' : '○'}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>

              {isFridayInCity ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit Jumu'ah time for ${city.name}`}
                  onPress={() => setScreen('Global')}
                  style={styles.fridayPrayerCard}
                >
                  <View style={styles.fridayPrayerCopy}>
                    <Text style={styles.fridayPrayerEyebrow}>FRIDAY · JUMU'AH</Text>
                    <Text style={styles.fridayPrayerTitle}>{city.name}</Text>
                  </View>
                  <Text style={styles.fridayPrayerTime}>
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

              <View style={styles.inlineCards}>
                <Pressable style={styles.softCard} onPress={() => setScreen('Global')}>
                  <Text style={styles.softCardSymbol}>◎</Text>
                  <Text style={styles.softCardTitle}>Across horizons</Text>
                  <Text style={styles.softCardBody}>{pinnedCities.length} places in your hub</Text>
                </Pressable>
                <Pressable style={styles.softCard} onPress={() => setScreen('Fasting')}>
                  <Text style={styles.softCardSymbol}>☾</Text>
                  <Text style={styles.softCardTitle}>A mindful fast</Text>
                  <Text style={styles.softCardBody}>Your suhoor & iftar routine</Text>
                </Pressable>
              </View>

              <View style={styles.sectionHeading}>
                <View>
                  <Text style={styles.sectionTitle}>Today’s reminders</Text>
                  <Text style={styles.sectionCaption}>A daily teaching and a supplication</Text>
                </View>
              </View>
              {dailyVerse ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${dailyVerse.surahName} ${dailyVerse.surahNumber}, verse ${dailyVerse.ayahNumber} in Furqan`}
                  onPress={() => void openSupportLink(`${furqanBaseUrl}/surah/${dailyVerse.surahNumber}?ayah=${dailyVerse.ayahNumber}`)}
                  style={styles.dailyHighlightCard}
                >
                  <Text style={styles.highlightEyebrow}>QUR’AN VERSE OF THE DAY · FURQAN</Text>
                  <Text style={styles.highlightArabic}>{dailyVerse.arabic}</Text>
                  <Text style={styles.highlightBody}>{dailyVerse.translation}</Text>
                  <Text style={styles.highlightLink}>{dailyVerse.surahName} · {dailyVerse.surahNumber}:{dailyVerse.ayahNumber} · Open in Furqan ›</Text>
                </Pressable>
              ) : null}
              {dailyVerseError ? (
                <View style={styles.dailyHighlightCard}>
                  <Text style={styles.highlightTitle}>Verse of the day unavailable</Text>
                  <Text style={styles.highlightBody}>{dailyVerseError}</Text>
                  <Pressable accessibilityRole="button" onPress={() => void refreshDailyVerse(true)} style={styles.retryVerseButton}>
                    <Text style={styles.highlightLink}>Try again</Text>
                  </Pressable>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setWorshipTab('Hadith');
                  setScreen('Worship');
                }}
                style={styles.dailyHighlightCard}
              >
                <Text style={styles.highlightEyebrow}>HADITH OF THE DAY · {dailyHadith.reference}</Text>
                <Text style={styles.highlightTitle}>{dailyHadith.title}</Text>
                <Text style={styles.highlightBody}>{dailyHadith.summary}</Text>
                <Text style={styles.highlightLink}>Browse Hadith in Library ›</Text>
              </Pressable>
              {dailyDua ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setWorshipTab('Duas');
                    setScreen('Worship');
                  }}
                  style={styles.dailyHighlightCard}
                >
                  <Text style={styles.highlightEyebrow}>DU’A OF THE DAY · {dailyDua.category.toUpperCase()}</Text>
                  <Text style={styles.highlightTitle}>{dailyDua.title}</Text>
                  <Text style={styles.highlightArabic}>{dailyDua.arabic}</Text>
                  <Text style={styles.highlightBody}>{dailyDua.meaning}</Text>
                  <Text style={styles.highlightLink}>Browse Du’a categories in Library ›</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}

          {screen === 'Global' ? (
            <>
              <View style={styles.introBlock}>
                <Text style={styles.eyebrow}>YOUR FIVE-SLOT HUB</Text>
                <Text style={styles.pageTitle}>A little closer, everywhere.</Text>
                <Text style={styles.bodyText}>
                  Prayer times are worked out only when you open a place. Your saved cities stay on this device.
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
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Unpin ${pinnedCity.name}`}
                        onPress={() => removeCity(pinnedCity.id)}
                        style={styles.removeCityButton}
                      >
                        <Text style={styles.removeCityText}>×</Text>
                      </Pressable>
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
                <Text style={styles.helperText}>Search above to add a place · {MAX_PINNED_CITIES - pinnedCities.length} {MAX_PINNED_CITIES - pinnedCities.length === 1 ? 'slot' : 'slots'} left</Text>
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
              <View style={styles.introBlock}>
                <Text style={styles.eyebrow}>YOUR MISHKAH COMPANION</Text>
                <Text style={styles.pageTitle}>A little guidance.</Text>
                <Text style={styles.bodyText}>
                  Answers come from a small on-device library. Nothing you ask is sent to a server.
                </Text>
              </View>
              <View style={styles.assistantCard}>
                <View style={styles.assistantHeader}>
                  <View style={styles.assistantMark}>
                    <Text style={styles.assistantMarkText}>✦</Text>
                  </View>
                  <View>
                    <Text style={styles.assistantTitle}>Rafiq AI</Text>
                    <Text style={styles.localBadge}>ON-DEVICE · OFFLINE READY</Text>
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
                <ActionButton
                  label="Find a gentle answer"
                  onPress={() => askGuide(guideQuery)}
                  palette={palette}
                  styles={styles}
                />
                <View style={styles.answerCard}>
                  <Text style={styles.answerTitle}>{guideAnswer.title}</Text>
                  <Text style={styles.answerText}>{guideAnswer.answer}</Text>
                </View>
              </View>
              <Text style={styles.sectionCaption}>A few things you can ask</Text>
              {getLocalFaqs().map((faq) => (
                <Pressable key={faq.title} onPress={() => askGuide(faq.title)} style={styles.faqRow}>
                  <Text style={styles.faqText}>{faq.title}</Text>
                  <Text style={styles.faqArrow}>↗</Text>
                </Pressable>
              ))}
              <View style={styles.disclaimerCard}>
                <Text style={styles.disclaimerTitle}>A thoughtful companion, not a fatwa.</Text>
                <Text style={styles.disclaimerText}>
                  For personal religious rulings, health concerns, and local practice, speak with a trusted scholar or qualified professional.
                </Text>
              </View>
              <GuidanceHub
                city={city}
                hour={Number(new Intl.DateTimeFormat('en-GB', {
                  timeZone: city.timeZone,
                  hour: '2-digit',
                  hourCycle: 'h23',
                }).format(now))}
                palette={palette}
              />
            </>
          ) : null}

          {screen === 'Worship' ? (
            <WorshipHub
              preferences={preferences}
              palette={palette}
              date={localDate}
              initialTab={worshipTab}
              featuresUnlocked={syncState?.featuresUnlocked ?? ['basic-guidance']}
              onPreferencesChange={changePreferences}
              onNotice={setNotice}
            />
          ) : null}

          {screen === 'More' ? (
            <>
              <View style={styles.introBlock}>
                <Text style={styles.eyebrow}>YOUR MISHKAH</Text>
                <Text style={styles.pageTitle}>Your profile.</Text>
                <Text style={styles.bodyText}>Account, progress, preferences, and the companion Furqan app.</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setProfileModalVisible(true)} style={styles.moreAccountRow}>
                <View style={styles.moreIcon}><Text style={styles.moreIconText}>◎</Text></View>
                <View style={styles.moreRowCopy}>
                  <Text style={styles.moreRowTitle}>Account & sync</Text>
                  <Text style={styles.moreRowDescription}>{authSession ? 'Google sign-in active' : 'Sign in or continue locally'}</Text>
                </View>
                <Text style={styles.moreArrow}>›</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Explore Furqan, the companion Quran app"
                onPress={() => void openSupportLink('https://furqan-quran-app.vercel.app/')}
                style={styles.moreAccountRow}
              >
                <View style={styles.moreIcon}><Text style={styles.moreIconText}>۞</Text></View>
                <View style={styles.moreRowCopy}>
                  <Text style={styles.moreRowTitle}>Explore Furqan</Text>
                  <Text style={styles.moreRowDescription}>Your companion Qur’an reading app by LIXZON</Text>
                </View>
                <Text style={styles.moreArrow}>↗</Text>
              </Pressable>
              <View style={styles.streakPanel}>
                <View style={styles.streakHeading}>
                  <View>
                    <Text style={styles.moreRowTitle}>Furqan reading streak</Text>
                    <Text style={styles.moreRowDescription}>
                      {syncApiUrl ? 'Verified progress refreshes when your account connects.' : 'Connect a shared sync service to import verified Furqan progress.'}
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
                  {(['light', 'dark', 'midnight'] as const).map((appearance) => {
                    const locked = appearance === 'midnight' && !syncState?.featuresUnlocked.includes('premium-theme-collection');
                    const label = appearance === 'light' ? 'Daylight' : appearance === 'dark' ? 'Night' : locked ? 'Midnight · 14d' : 'Midnight';
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
                <Text style={styles.helperText}>Midnight unlocks after a verified 14-day Furqan reading streak.</Text>
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
                <Text style={styles.settingGroupTitle}>Account & sync</Text>
                <Text style={styles.settingDescription}>
                  {syncConfigured
                    ? 'Connect a Google account to sync streaks and unlock guidance features across devices.'
                    : 'Google account linking is available. Cross-device sync is not configured for this build.'}
                </Text>
                <View style={styles.syncCard}>
                  <Text style={styles.syncLabel}>Status</Text>
                  <Text style={styles.syncValue}>
                    {!authSession && syncState?.linkedAccount.linked
                      ? 'Sign-in required'
                        : authSession
                          ? 'Google sign-in active'
                          : 'Local-only mode'}
                  </Text>
                  <Text style={styles.syncMeta}>{syncState?.status ?? 'idle'} · {syncState?.queuedCount ?? 0} queued updates</Text>
                  {syncConfigured ? (
                    <Text style={styles.syncMeta}>
                      Furqan: {syncState?.furqanMemorizedCount ?? 0} tracked ayahs · {syncState?.furqanMemorizedMilestones ?? 0} memorized
                      {syncState?.dailyHighlightGlobalAyah
                        ? ` · Today’s highlight ${syncState.dailyHighlightGlobalAyah}`
                        : ''}
                    </Text>
                  ) : null}
                  {authSession && !syncConfigured ? (
                    <Text style={styles.syncMeta}>Cross-device sync is unavailable in this build. Your data stays on this device.</Text>
                  ) : null}
                  {authSession ? (
                    <Text style={styles.syncMeta}>Signed in as {authSession.email ?? authSession.name ?? 'Google user'}</Text>
                  ) : null}
                </View>
                {!authSession ? (
                  <GoogleSignInButton
                    label="Sign in with Google"
                    loading={authLoading}
                    onPress={() => void handleGoogleSignIn()}
                  />
                ) : (
                  <View style={styles.inlineActions}>
                    <ActionButton
                      label={syncConfigured ? 'Sync now' : 'Sync unavailable'}
                      onPress={() => void handleSyncNow()}
                      palette={palette}
                      styles={styles}
                      disabled={!syncConfigured}
                    />
                    <ActionButton
                      label="Sign out"
                      onPress={() => void handleGoogleSignOut()}
                      palette={palette}
                      styles={styles}
                    />
                  </View>
                )}
                {authMessage ? <Text style={styles.healthMessage}>{authMessage}</Text> : null}
              </View>
              <View style={styles.settingsCard}>
                <Text style={styles.settingGroupTitle}>A private health check</Text>
                <Text style={styles.settingDescription}>
                  Check local app health without sharing technical logs.
                </Text>
                <ActionButton
                  label={isCheckingHealth ? 'Checking…' : 'Run in-app health check'}
                  onPress={() => void runHealthCheck()}
                  palette={palette}
                  styles={styles}
                  disabled={isCheckingHealth}
                  busy={isCheckingHealth}
                />
                {healthMessage ? <Text style={styles.healthMessage}>{healthMessage}</Text> : null}
                <Text style={styles.privacyNote}>
                  Diagnostics are encrypted on your device. They are never uploaded.
                </Text>
              </View>
              <View style={styles.settingsCard}>
                <Text style={styles.settingGroupTitle}>For developers</Text>
                {developerUnlocked ? (
                  <>
                    <Text style={styles.settingDescription}>
                      A private Friday digest from this device’s encrypted ring buffer.
                    </Text>
                    <Text style={styles.digestText}>{developerDigest}</Text>
                    <ActionButton
                      label="Refresh local digest"
                      onPress={() => void refreshDeveloperDigest()}
                      palette={palette}
                      styles={styles}
                    />
                    <Pressable onPress={() => setDeveloperUnlocked(false)}>
                      <Text style={styles.lockLink}>Lock developer tools</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text style={styles.settingDescription}>
                      {isValidDigest(DEV_KEY_DIGEST)
                        ? 'Enter the build-configured master key to view the local digest.'
                        : 'Developer access is locked until LIXZON_MASTER_KEY is configured for this build.'}
                    </Text>
                    <TextInput
                      accessibilityLabel="Developer master key"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onChangeText={setDeveloperKey}
                      placeholder="Master key"
                      placeholderTextColor={palette.muted}
                      secureTextEntry
                      style={styles.keyInput}
                      value={developerKey}
                    />
                    <ActionButton
                      label="Unlock developer tools"
                      onPress={() => void unlockDeveloperTools()}
                      palette={palette}
                      styles={styles}
                    />
                  </>
                )}
                {developerMessage ? <Text style={styles.healthMessage}>{developerMessage}</Text> : null}
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
                </View>
              </View>
            </>
          ) : null}

          <View style={styles.footer}>
            <View style={styles.footerLine} />
            <Text style={styles.footerBrand}>by LIXZON</Text>
          </View>
        </ScrollView>
        <AiAssistantBar
          palette={palette}
          onNavigate={(destination: AssistantDestination, query: string) => {
            if (destination === 'Worship') {
              const normalized = query.toLocaleLowerCase();
              setWorshipTab(/tasbeeh|tasbih|dhikr|adhkar|remembrance/.test(normalized)
                ? 'Tasbeeh'
                : /reciter|audio quran|quran audio/.test(normalized)
                  ? 'Reciters'
                  : /story|stories|sahaba|companion|dajjal|end.?times|archive|halal food|adab/.test(normalized)
                    ? 'Archives'
                  : /dua|supplication|travel|sleep/.test(normalized)
                  ? 'Duas'
                  : 'Hadith');
              setScreen('Worship');
              return;
            }
            setScreen(destination);
            if (destination === 'Guide') askGuide(query);
          }}
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
                <Text style={styles.settingDescription}>Keep your progress close across devices.</Text>
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
            <View style={styles.syncCard}>
              <Text style={styles.syncLabel}>ACCOUNT STATUS</Text>
              <Text style={styles.syncValue}>{authSession ? 'Google sign-in active' : 'Local-only mode'}</Text>
              <Text style={styles.syncMeta}>
                {authSession?.email ?? authSession?.name ?? 'Your settings remain on this device.'}
              </Text>
              {authSession && !syncConfigured ? (
                <Text style={styles.syncMeta}>Cross-device sync is unavailable in this build. Your data stays on this device.</Text>
              ) : null}
            </View>
            {!authSession ? (
              <GoogleSignInButton
                label="Sign in with Google"
                loading={authLoading}
                onPress={() => void handleGoogleSignIn()}
              />
            ) : (
              <View style={styles.inlineActions}>
                <ActionButton
                  label={syncConfigured ? 'Sync now' : 'Sync unavailable'}
                  onPress={() => void handleSyncNow()}
                  palette={palette}
                  styles={styles}
                  disabled={!syncConfigured}
                />
                <ActionButton
                  label="Sign out"
                  onPress={() => void handleGoogleSignOut()}
                  palette={palette}
                  styles={styles}
                />
              </View>
            )}
            {authMessage ? <Text style={styles.healthMessage}>{authMessage}</Text> : null}
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
            <TextInput
              accessibilityLabel="Search Mishkah features"
              autoFocus
              onChangeText={setUniversalSearchQuery}
              onSubmitEditing={submitUniversalSearch}
              placeholder="Try Qibla, Du’a, Tasbeeh, fasting…"
              placeholderTextColor={palette.muted}
              returnKeyType="search"
              style={styles.guideInput}
              value={universalSearchQuery}
            />
            <ActionButton label="Search and open" onPress={submitUniversalSearch} palette={palette} styles={styles} />
            <Text style={styles.settingDescription}>Rafiq can guide you to a screen or explain where a feature lives. Voice call mode needs a speech service and is not active in this build.</Text>
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
}: {
  label: string;
  onPress: () => void;
  palette: Palette;
  styles: ReturnType<typeof createStyles>;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.actionButton, disabled && styles.disabledButton]}
    >
      {busy ? <ActivityIndicator color={palette.accentInk} size="small" /> : null}
      <Text style={styles.actionButtonText}>{label}</Text>
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
      <Text style={styles.jumuahHelp}>Enter your local mosque’s time in 24-hour format, then save. Leave blank to clear it.</Text>
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
    wideScreen: { maxWidth: '100%', alignSelf: 'stretch', flexDirection: 'row' },
    mainColumn: { flex: 1, minWidth: 0, width: '100%' },
    mainColumnWide: { maxWidth: 1180, alignSelf: 'center' },
    desktopSidebar: {
      width: 218,
      paddingHorizontal: 13,
      paddingTop: 25,
      borderRightWidth: StyleSheet.hairlineWidth,
      borderRightColor: colors.line,
      backgroundColor: colors.surface,
    },
    sidebarBrand: { color: colors.accent, fontSize: 20, fontWeight: '700', paddingHorizontal: 12, marginBottom: 22 },
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
    content: { paddingHorizontal: 20, paddingTop: 7, paddingBottom: 32 },
    dailyHighlightCard: { padding: 17, marginTop: 9, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
    highlightEyebrow: { color: colors.gold, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
    highlightTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', marginTop: 9 },
    highlightBody: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
    calendarEventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, marginTop: 9, borderTopWidth: 1, borderTopColor: colors.line },
    calendarEventTitle: { color: colors.ink, fontSize: 12, fontWeight: '600' },
    calendarEventCountdown: { color: colors.accent, fontSize: 11, fontWeight: '700' },
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
    activePrayerName: { color: colors.accent, fontWeight: '700' },
    nextTag: { color: colors.gold, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
    prayerTime: { color: colors.ink, fontSize: 13, fontWeight: '500' },
    prayerRowRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    prayerCheckButton: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line },
    prayerCheckButtonDone: { backgroundColor: colors.accent, borderColor: colors.accent },
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
    fridayPrayerCard: {
      alignItems: 'center',
      backgroundColor: colors.surfaceRaised,
      borderColor: colors.gold,
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    fridayPrayerCopy: { flex: 1, minWidth: 0 },
    fridayPrayerEyebrow: { color: colors.gold, fontSize: 9, fontWeight: '700' },
    fridayPrayerTitle: { color: colors.ink, fontSize: 12, fontWeight: '600', marginTop: 3 },
    fridayPrayerTime: { color: colors.accent, fontSize: 14, fontWeight: '700', marginLeft: 12 },
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
    digestText: { color: colors.accent, fontSize: 13, fontWeight: '600', marginTop: 12 },
    keyInput: {
      height: 43,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: 12,
      color: colors.ink,
      fontSize: 12,
      marginTop: 12,
    },
    lockLink: { color: colors.muted, textAlign: 'center', fontSize: 11, marginTop: 12 },
    supportRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
    supportButton: { flex: 1, backgroundColor: colors.surfaceRaised, padding: 12, borderRadius: 13 },
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
  });
}
