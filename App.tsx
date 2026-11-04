import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
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
  type PrayerName,
} from './src/domain/prayer';
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

type Screen = 'Prayer' | 'Global' | 'Fasting' | 'Guide' | 'Settings';
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

const PALETTES: Record<'light' | 'dark', Palette> = {
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
};

const PRAYER_ORDER: readonly PrayerName[] = [
  'Fajr',
  'Sunrise',
  'Dhuhr',
  'Asr',
  'Maghrib',
  'Isha',
];

const FASTING_CHECKLIST = [
  { id: 'water', title: 'Drink water and prepare gently', detail: 'Keep hydration within your own needs.' },
  { id: 'suhoor', title: 'Have suhoor before Fajr', detail: 'Choose a nourishing meal that suits you.' },
  { id: 'intention', title: 'Set your intention', detail: 'A quiet moment for a sincere niyyah.' },
  { id: 'iftar', title: 'Break your fast at Maghrib', detail: 'Dates and water are a gentle Sunnah reminder.' },
  { id: 'dua', title: 'Make dua and pause', detail: 'Leave room for gratitude and reflection.' },
] as const;

const BRAND_TAGLINE = 'The Seeker who carries the Light of Guidance across horizons.';
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
  const [guideQuery, setGuideQuery] = useState('');
  const [guideAnswer, setGuideAnswer] = useState(getLocalAnswer(''));
  const [healthMessage, setHealthMessage] = useState('');
  const [developerKey, setDeveloperKey] = useState('');
  const [developerUnlocked, setDeveloperUnlocked] = useState(false);
  const [developerMessage, setDeveloperMessage] = useState('');
  const [developerDigest, setDeveloperDigest] = useState('');
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const theme = preferences.theme;
  const palette = PALETTES[theme];
  const styles = useMemo(() => createStyles(palette), [palette]);
  const city =
    getCity(preferences.selectedCityId) ??
    getCity(DEFAULT_PREFERENCES.selectedCityId);

  useEffect(() => {
    let active = true;
    loadPreferences()
      .then(async (loadedPreferences) => {
        await savePreferences(loadedPreferences);
        if (active) {
          preferencesRef.current = loadedPreferences;
          setPreferences(loadedPreferences);
          setIsReady(true);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setNotice(`Your saved settings could not be loaded: ${friendlyError(error, 'storage is unavailable')}`);
          setIsReady(true);
        }
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
    if (
      !isReady ||
      appState !== 'active' ||
      !city ||
      (!preferences.fajrAlarm && !preferences.iftarAlarm)
    ) {
      return;
    }
    schedulePrayerReminders(city, {
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
  ]);

  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync().catch((error: unknown) => {
        console.error('Mishkah could not dismiss the native splash screen.', error);
      });
    }
  }, [isReady]);

  const localDate = city ? dateInTimeZone(now, city.timeZone) : '';
  const prayerTimes = city
    ? getPrayerTimes(city, now, preferences.calculationMethod)
    : undefined;
  const nextPrayer = city && prayerTimes ? nextPrayerAt(prayerTimes, now, city.timeZone) : undefined;
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

  const setPrayerAlarm = async (alarm: 'fajrAlarm' | 'iftarAlarm', enabled: boolean) => {
    if (!city) {
      return;
    }
    const next = { ...preferencesRef.current, [alarm]: enabled };
    try {
      const count = await schedulePrayerReminders(city, {
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

  const askGuide = (query: string) => {
    setGuideQuery(query);
    setGuideAnswer(getLocalAnswer(query));
  };

  if (!isReady || !city || !prayerTimes || !nextPrayer) {
    return (
      <SafeAreaView style={styles.splashPage}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <View />
        <View style={styles.splashCenter}>
          <View style={styles.splashMark}>
            <Text style={styles.splashSpark}>✦</Text>
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mishkah home"
            onPress={() => setScreen('Prayer')}
            style={styles.brandLockup}
          >
            <View style={styles.brandMark}>
              <Text style={styles.brandSpark}>✦</Text>
            </View>
            <View>
              <Text style={styles.brandName}>Mishkah</Text>
              <Text style={styles.brandCaption}>A little light, wherever you are</Text>
            </View>
          </Pressable>
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
        </View>

        <View style={styles.tabBar}>
          {(['Prayer', 'Global', 'Fasting', 'Guide', 'Settings'] as const).map((tab) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: screen === tab }}
              key={tab}
              onPress={() => setScreen(tab)}
              style={[styles.tab, screen === tab && styles.activeTab]}
            >
              <Text style={[styles.tabLabel, screen === tab && styles.activeTabLabel]}>
                {tab === 'Settings' ? 'More' : tab}
              </Text>
            </Pressable>
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
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
                      <Text style={[styles.prayerTime, isNextPrayer && styles.activePrayerName]}>
                        {formatPrayerTime(prayerTimes[prayerName], city, localDate)}
                      </Text>
                    </View>
                  );
                })}
              </View>

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
                  onChange={(enabled) => void setPrayerAlarm('fajrAlarm', enabled)}
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
                  onChange={(enabled) => void setPrayerAlarm('iftarAlarm', enabled)}
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

          {screen === 'Guide' ? (
            <>
              <View style={styles.introBlock}>
                <Text style={styles.eyebrow}>A LOCAL-FIRST COMPANION</Text>
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
                    <Text style={styles.assistantTitle}>Mishkah Guide</Text>
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
                  {(['light', 'dark'] as const).map((appearance) => (
                    <Pressable
                      key={appearance}
                      onPress={() =>
                        changePreferences((current) => ({ ...current, theme: appearance }))
                      }
                      style={[
                        styles.choice,
                        theme === appearance && styles.selectedChoice,
                      ]}
                    >
                      <Text style={[styles.choiceText, theme === appearance && styles.selectedChoiceText]}>
                        {appearance === 'light' ? 'Daylight' : 'Night'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
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
      </View>

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
    splashSpark: { color: colors.accentInk, fontSize: 28 },
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
    screen: { flex: 1 },
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
      backgroundColor: colors.accent,
    },
    brandSpark: { color: colors.accentInk, fontSize: 20 },
    brandName: { color: colors.ink, fontSize: 19, fontWeight: '700', letterSpacing: 0.1 },
    brandCaption: { color: colors.muted, fontSize: 10, marginTop: 2 },
    locationButton: {
      maxWidth: '43%',
      alignItems: 'flex-end',
      paddingVertical: 7,
      paddingLeft: 12,
    },
    locationLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
    locationName: { color: colors.ink, fontSize: 13, fontWeight: '600', marginTop: 4 },
    tabBar: {
      marginHorizontal: 16,
      marginBottom: 13,
      padding: 4,
      borderRadius: 18,
      backgroundColor: colors.surfaceRaised,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    tab: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
    activeTab: { backgroundColor: colors.surface },
    tabLabel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
    activeTabLabel: { color: colors.accent, fontWeight: '700' },
    content: { paddingHorizontal: 20, paddingTop: 7, paddingBottom: 32 },
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
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    globalCityMain: { flex: 1 },
    cityPrayerPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
    cityPrayerLabel: { color: colors.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
    cityPrayerValue: { color: colors.accent, fontSize: 11, fontWeight: '600', marginRight: 6 },
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
    settingGroupTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
    settingDescription: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
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
