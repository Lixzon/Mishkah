import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AdhkarEntry, DuaEntry } from '../domain/adhkar';
import { EVENING_ADHKAR, HISN_AL_MUSLIM_DUAS, MORNING_ADHKAR, searchDuas } from '../domain/adhkar';
import {
  getDailyHadith,
  HADITH_COLLECTIONS,
  searchHadiths,
  type HadithCollection,
  type HadithEntry,
} from '../domain/hadith';
import {
  CUSTOM_DHIKR_TARGETS,
  makeCustomDhikr,
  nextTasbeehCount,
  TASBEEH_PRESETS,
  type TasbeehPreset,
} from '../domain/tasbeeh';
import type { AppPreferences } from '../services/preferences';
import { getReciterAudioUrl, QURAN_RECITERS } from '../domain/reciters';

export type WorshipTab = 'Hadith' | 'Tasbeeh' | 'Adhkar' | 'Duas' | 'Reciters';
type Period = 'morning' | 'evening';

export interface WorshipPalette {
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
}

interface WorshipHubProps {
  preferences: AppPreferences;
  palette: WorshipPalette;
  date: string;
  initialTab?: WorshipTab;
  featuresUnlocked: readonly string[];
  onPreferencesChange: (update: (current: AppPreferences) => AppPreferences) => void;
  onNotice: (message: string) => void;
}

const TABS: readonly WorshipTab[] = ['Hadith', 'Tasbeeh', 'Adhkar', 'Duas', 'Reciters'];
const DUA_CATEGORIES: readonly (DuaEntry['category'] | 'all')[] = [
  'all',
  'travel',
  'anxiety',
  'sleep',
  'morning',
  'home',
  'food',
  'forgiveness',
];

function categoryLabel(category: string): string {
  return category === 'all' ? 'All' : category[0].toUpperCase() + category.slice(1);
}

function makeShareSvg(entry: HadithEntry): string {
  const lines: string[] = [];
  const words = entry.summary.split(/\s+/);
  let line = '';
  for (const word of words) {
    if (`${line} ${word}`.trim().length > 42) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  const escapeXml = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
  const summaryLines = lines.map((text, index) =>
    `<text x="88" y="${520 + index * 64}" fill="#162D2C" font-size="36" font-family="Georgia,serif">${escapeXml(text)}</text>`,
  ).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#F3F5F1"/><rect x="42" y="42" width="996" height="1266" rx="34" fill="#FFFFFF"/><rect x="88" y="100" width="8" height="88" rx="4" fill="#C59143"/><text x="124" y="132" fill="#71817D" font-size="24" font-family="Arial,sans-serif" letter-spacing="3">MISHKAH · DAILY HADITH</text><text x="88" y="326" fill="#145B50" font-size="50" font-family="Georgia,serif">${escapeXml(entry.title)}</text>${summaryLines}<text x="88" y="1080" fill="#71817D" font-size="25" font-family="Arial,sans-serif">${escapeXml(entry.reference)}</text><text x="88" y="1160" fill="#145B50" font-size="21" font-family="Arial,sans-serif">Teaching summary, not a verbatim translation</text><text x="88" y="1232" fill="#71817D" font-size="20" font-family="Arial,sans-serif">The Seeker who carries the Light of Guidance across horizons.</text></svg>`;
}

export function WorshipHub({ preferences, palette, date, initialTab = 'Hadith', featuresUnlocked, onPreferencesChange, onNotice }: WorshipHubProps) {
  const [tab, setTab] = useState<WorshipTab>(initialTab);
  const [hadithQuery, setHadithQuery] = useState('');
  const [hadithCollection, setHadithCollection] = useState<HadithCollection | 'all'>('all');
  const [selectedHadithId, setSelectedHadithId] = useState(() => getDailyHadith().id);
  const [period, setPeriod] = useState<Period>('morning');
  const [duaQuery, setDuaQuery] = useState('');
  const [duaCategory, setDuaCategory] = useState<DuaEntry['category'] | 'all'>('all');
  const [customName, setCustomName] = useState('');
  const [customTarget, setCustomTarget] = useState<(typeof CUSTOM_DHIKR_TARGETS)[number]>(33);
  const [selectedPresetId, setSelectedPresetId] = useState(TASBEEH_PRESETS[0].id);
  const [selectedReciterId, setSelectedReciterId] = useState(QURAN_RECITERS[0].id);
  const cardRef = useRef<ViewShotRef | null>(null);
  const progressValue = useRef(new Animated.Value(0)).current;
  const audioPlayer = useAudioPlayer(null);
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const styles = useMemo(() => createStyles(palette), [palette]);

  const customPresets: TasbeehPreset[] = preferences.customDhikr.map((item) => ({
    id: item.id,
    category: 'custom',
    label: item.label,
    arabic: item.arabic ?? '',
    transliteration: item.label,
    meaning: 'A personal remembrance saved on this device.',
    target: item.target,
    reference: 'Personal Dhikr',
  }));
  const allPresets = [...TASBEEH_PRESETS, ...customPresets];
  const selectedPreset = allPresets.find((item) => item.id === selectedPresetId) ?? allPresets[0];
  const currentTasbeehCounts = preferences.tasbeehDate === date ? preferences.tasbeehCounts : {};
  const tasbeehCount = selectedPreset ? currentTasbeehCounts[selectedPreset.id] ?? 0 : 0;
  const adhkar = period === 'morning' ? MORNING_ADHKAR : EVENING_ADHKAR;
  const currentAdhkarCounts = preferences.adhkarDate === date ? preferences.adhkarCounts : {};
  const extendedHadithUnlocked = featuresUnlocked.includes('extended-hadith');
  const reciterLibraryUnlocked = featuresUnlocked.includes('reciter-library');
  const allowedHadiths = extendedHadithUnlocked
    ? HADITH_COLLECTIONS
    : HADITH_COLLECTIONS.filter((entry) => entry.collection === 'nawawi40');
  const selectedHadith = allowedHadiths.find((item) => item.id === selectedHadithId) ?? getDailyHadith();
  const filteredHadiths = searchHadiths(hadithQuery, hadithCollection)
    .filter((entry) => extendedHadithUnlocked || entry.collection === 'nawawi40');
  const filteredDuas = searchDuas(duaQuery, duaCategory);

  useEffect(() => {
    progressValue.setValue(0);
    Animated.timing(progressValue, {
      toValue: selectedPreset ? tasbeehCount / selectedPreset.target : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progressValue, selectedPreset?.id, selectedPreset?.target, tasbeehCount]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const selectionHaptic = () => {
    const feedback = Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Clock_Tick)
      : Haptics.selectionAsync();
    void feedback.catch(() => undefined);
  };

  const updateTasbeeh = (preset: TasbeehPreset, nextCount: number) => {
    onPreferencesChange((current) => {
      const counts = current.tasbeehDate === date ? current.tasbeehCounts : {};
      return {
        ...current,
        tasbeehDate: date,
        tasbeehCounts: { ...counts, [preset.id]: nextCount },
      };
    });
  };

  const incrementTasbeeh = () => {
    if (!selectedPreset) return;
    const nextCount = nextTasbeehCount(tasbeehCount, selectedPreset.target);
    if (nextCount === tasbeehCount) return;
    updateTasbeeh(selectedPreset, nextCount);
    selectionHaptic();
    if (nextCount === selectedPreset.target) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      onNotice(`${selectedPreset.label} complete.`);
    }
  };

  const addCustomDhikr = () => {
    const custom = makeCustomDhikr(customName, customTarget);
    if (!custom) {
      onNotice('Add a name for your personal Dhikr first.');
      return;
    }
    onPreferencesChange((current) => ({ ...current, customDhikr: [...current.customDhikr, custom].slice(-30) }));
    setSelectedPresetId(custom.id);
    setCustomName('');
    onNotice('Personal Dhikr saved on this device.');
  };

  const incrementAdhkar = (entry: AdhkarEntry) => {
    const currentCount = currentAdhkarCounts[entry.id] ?? 0;
    if (currentCount >= entry.count) return;
    const nextCount = currentCount + 1;
    onPreferencesChange((current) => {
      const counts = current.adhkarDate === date ? current.adhkarCounts : {};
      return { ...current, adhkarDate: date, adhkarCounts: { ...counts, [entry.id]: nextCount } };
    });
    selectionHaptic();
    if (nextCount === entry.count) onNotice(`${entry.title} complete.`);
  };

  const toggleReciter = (reciterId: string) => {
    if (!reciterLibraryUnlocked) return;
    const reciter = QURAN_RECITERS.find((item) => item.id === reciterId);
    if (!reciter) return;
    if (selectedReciterId === reciterId && audioStatus.playing) {
      audioPlayer.pause();
      return;
    }
    setSelectedReciterId(reciterId);
    audioPlayer.replace(getReciterAudioUrl(reciter));
    audioPlayer.play();
  };

  const shareHadith = async () => {
    try {
      if (Platform.OS === 'web') {
        const anchor = document.createElement('a');
        anchor.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(makeShareSvg(selectedHadith))}`;
        anchor.download = `mishkah-hadith-${selectedHadith.id}.svg`;
        anchor.click();
        onNotice('Hadith card downloaded as an image.');
        return;
      }
      if (!cardRef.current || !(await Sharing.isAvailableAsync())) {
        onNotice('Sharing is not available on this device.');
        return;
      }
      const imageUri = await cardRef.current?.capture();
      if (!imageUri) return;
      await Sharing.shareAsync(imageUri, { mimeType: 'image/png', dialogTitle: 'Share Hadith card' });
    } catch {
      onNotice('The Hadith card could not be exported.');
    }
  };

  return (
    <View>
      <View style={styles.introBlock}>
        <Text style={styles.eyebrow}>WORSHIP & REFLECTION</Text>
        <Text style={styles.pageTitle}>A little more light.</Text>
        <Text style={styles.bodyText}>Hadith, remembrance, and supplications, available offline.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolTabs}>
        {TABS.map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={[styles.toolTab, tab === item && styles.toolTabActive]}>
            <Text style={[styles.toolTabLabel, tab === item && styles.toolTabLabelActive]}>{item}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {tab === 'Hadith' ? (
        <>
          <ViewShot ref={cardRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }} style={styles.hadithCard}>
            <View style={styles.cardAccent} />
            <Text style={styles.cardEyebrow}>DAILY HADITH</Text>
            <Text style={styles.cardTitle}>{selectedHadith.title}</Text>
            <Text style={styles.cardSummary}>{selectedHadith.summary}</Text>
            <Text style={styles.cardReference}>{selectedHadith.reference}</Text>
            <Text style={styles.cardDisclosure}>Teaching summary, not a verbatim translation.</Text>
          </ViewShot>
          <ActionRow label="Export share card" icon="↗" styles={styles} onPress={() => void shareHadith()} />
          <SectionLabel title="Hadith library" detail={`${filteredHadiths.length} entries`} styles={styles} />
          <TextInput
            accessibilityLabel="Search Hadith"
            onChangeText={setHadithQuery}
            placeholder="Search topics, chapters, or sources"
            placeholderTextColor={palette.muted}
            style={styles.searchInput}
            value={hadithQuery}
          />
          <View style={styles.chipRow}>
            {([
              { id: 'all', label: 'All', locked: false },
              { id: 'nawawi40', label: 'Nawawi 40', locked: false },
              { id: 'bukhari', label: extendedHadithUnlocked ? 'Bukhari' : 'Bukhari · 7d', locked: !extendedHadithUnlocked },
              { id: 'muslim', label: extendedHadithUnlocked ? 'Muslim' : 'Muslim · 7d', locked: !extendedHadithUnlocked },
            ] as const).map((collection) => (
              <ChoiceChip
                key={collection.id}
                label={collection.label}
                selected={hadithCollection === collection.id}
                disabled={collection.locked}
                styles={styles}
                onPress={() => setHadithCollection(collection.id)}
              />
            ))}
          </View>
          {!extendedHadithUnlocked ? (
            <Text style={styles.collectionLock}>Bukhari and Muslim selections unlock after a verified 7-day Furqan reading streak. Daily Hadith and Nawawi 40 remain available.</Text>
          ) : null}
          <View style={styles.listGroup}>
            {filteredHadiths.map((entry) => (
              <Pressable key={entry.id} onPress={() => setSelectedHadithId(entry.id)} style={styles.listRow}>
                <View style={styles.listCopy}>
                  <Text style={styles.listTitle}>{entry.title}</Text>
                  <Text style={styles.listSubtitle}>{entry.reference}</Text>
                </View>
                <Text style={styles.listArrow}>{selectedHadith.id === entry.id ? '●' : '›'}</Text>
              </Pressable>
            ))}
            {!filteredHadiths.length ? <EmptyState text="No Hadith matches this search." styles={styles} /> : null}
          </View>
        </>
      ) : null}

      {tab === 'Tasbeeh' ? (
        <>
          <Text style={styles.sectionTitle}>Choose a remembrance</Text>
          <View style={styles.chipRow}>
            {allPresets.map((preset) => (
              <ChoiceChip
                key={preset.id}
                label={preset.label}
                selected={selectedPreset?.id === preset.id}
                styles={styles}
                onPress={() => setSelectedPresetId(preset.id)}
              />
            ))}
          </View>
          {selectedPreset ? (
            <View style={styles.tasbeehPanel}>
              <Text style={styles.eyebrow}>{categoryLabel(selectedPreset.category)}</Text>
              {selectedPreset.arabic ? <Text style={styles.arabicText}>{selectedPreset.arabic}</Text> : null}
              <Text style={styles.tasbeehPhrase}>{selectedPreset.transliteration}</Text>
              <Text style={styles.cardDisclosure}>{selectedPreset.meaning}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Increment Tasbeeh" onPress={incrementTasbeeh} style={({ pressed }) => [styles.counterButton, pressed && styles.counterPressed]}>
                <Text style={styles.counterValue}>{tasbeehCount}</Text>
                <Text style={styles.counterTarget}>of {selectedPreset.target}</Text>
              </Pressable>
              <View style={styles.counterTrack}>
                <Animated.View style={[styles.counterFill, { width: progressValue.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
              </View>
              <View style={styles.counterActions}>
                <Pressable onPress={() => updateTasbeeh(selectedPreset, 0)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Reset</Text>
                </Pressable>
                {selectedPreset.category === 'custom' ? (
                  <Pressable
                    onPress={() => {
                      onPreferencesChange((current) => ({
                        ...current,
                        customDhikr: current.customDhikr.filter((item) => item.id !== selectedPreset.id),
                      }));
                      setSelectedPresetId(TASBEEH_PRESETS[0].id);
                    }}
                    style={styles.secondaryButton}
                  >
                    <Text style={styles.secondaryButtonText}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.cardReference}>{selectedPreset.reference}</Text>
            </View>
          ) : null}
          <SectionLabel title="Create personal Dhikr" detail="Saved privately on this device" styles={styles} />
          <TextInput
            accessibilityLabel="Personal Dhikr name"
            onChangeText={setCustomName}
            placeholder="Name or phrase"
            placeholderTextColor={palette.muted}
            style={styles.searchInput}
            value={customName}
          />
          <View style={styles.counterActions}>
            {CUSTOM_DHIKR_TARGETS.map((target) => (
              <ChoiceChip key={target} label={`${target} repetitions`} selected={customTarget === target} styles={styles} onPress={() => setCustomTarget(target)} />
            ))}
          </View>
          <ActionRow label="Add personal Dhikr" icon="+" styles={styles} onPress={addCustomDhikr} />
        </>
      ) : null}

      {tab === 'Adhkar' ? (
        <>
          <View style={styles.periodSwitch}>
            {(['morning', 'evening'] as const).map((value) => (
              <Pressable key={value} onPress={() => setPeriod(value)} style={[styles.periodButton, period === value && styles.periodButtonActive]}>
                <Text style={[styles.periodLabel, period === value && styles.periodLabelActive]}>{categoryLabel(value)}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.bodyText}>Tap a remembrance to count it. Progress resets for a new local day.</Text>
          {adhkar.map((entry) => (
            <AdhkarCard
              key={entry.id}
              entry={entry}
              count={currentAdhkarCounts[entry.id] ?? 0}
              palette={palette}
              styles={styles}
              onPress={() => incrementAdhkar(entry)}
            />
          ))}
        </>
      ) : null}

      {tab === 'Duas' ? (
        <>
          <Text style={styles.bodyText}>A searchable Hisn al-Muslim selection for everyday moments.</Text>
          <TextInput
            accessibilityLabel="Search supplications"
            onChangeText={setDuaQuery}
            placeholder="Try travel, anxiety, sleep, or home"
            placeholderTextColor={palette.muted}
            style={styles.searchInput}
            value={duaQuery}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {DUA_CATEGORIES.map((category) => (
              <ChoiceChip key={category} label={categoryLabel(category)} selected={duaCategory === category} styles={styles} onPress={() => setDuaCategory(category)} />
            ))}
          </ScrollView>
          {filteredDuas.map((dua) => <AdhkarCard key={dua.id} entry={dua} count={0} palette={palette} styles={styles} />)}
          {!filteredDuas.length ? <EmptyState text="No supplications match this search." styles={styles} /> : null}
        </>
      ) : null}

      {tab === 'Reciters' ? (
        <>
          <View style={styles.reciterIntro}>
            <Text style={styles.sectionTitle}>Qur’an reciters</Text>
            <Text style={styles.bodyText}>Stream a complete surah from the Furqan reciter catalog. Audio requires an internet connection.</Text>
          </View>
          {!reciterLibraryUnlocked ? (
            <View style={styles.lockedPanel}>
              <Text style={styles.lockedTitle}>Reciter library locked</Text>
              <Text style={styles.bodyText}>Connect your Google account to the LIXZON sync service and reach a verified 21-day Furqan reading streak to unlock audio reciters.</Text>
            </View>
          ) : (
            <>
              <View style={styles.reciterPlayer}>
                <Text style={styles.eyebrow}>NOW PLAYING</Text>
                <Text style={styles.cardTitle}>{QURAN_RECITERS.find((item) => item.id === selectedReciterId)?.label}</Text>
                <Text style={styles.cardReference}>Surah Al-Fatihah · streamed from the Quran audio CDN</Text>
                <View style={styles.audioTrack}>
                  <View style={[styles.audioFill, { width: `${audioStatus.duration > 0 ? Math.min(100, audioStatus.currentTime / audioStatus.duration * 100) : 0}%` }]} />
                </View>
                <View style={styles.audioControls}>
                  <Text style={styles.cardDisclosure}>{audioStatus.isBuffering ? 'Loading audio…' : audioStatus.playing ? 'Playing' : 'Ready'}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={audioStatus.playing ? 'Pause recitation' : 'Play recitation'} onPress={() => toggleReciter(selectedReciterId)} style={styles.audioButton}>
                    <Text style={styles.audioButtonText}>{audioStatus.playing ? 'Pause' : 'Play'}</Text>
                  </Pressable>
                </View>
                {audioStatus.error ? <Text style={styles.cardDisclosure}>{audioStatus.error}</Text> : null}
              </View>
              <View style={styles.listGroup}>
                {QURAN_RECITERS.map((reciter) => (
                  <Pressable accessibilityRole="button" key={reciter.id} onPress={() => toggleReciter(reciter.id)} style={styles.listRow}>
                    <View style={styles.listCopy}>
                      <Text style={styles.listTitle}>{reciter.label}</Text>
                      <Text style={styles.listSubtitle}>{reciter.arabicName}</Text>
                    </View>
                    <Text style={styles.listArrow}>{selectedReciterId === reciter.id && audioStatus.playing ? 'Ⅱ' : '▶'}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </>
      ) : null}
    </View>
  );
}

function SectionLabel({ title, detail, styles }: { title: string; detail: string; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.sectionLabel}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCaption}>{detail}</Text>
    </View>
  );
}

function ChoiceChip({ label, selected, disabled = false, styles, onPress }: { label: string; selected: boolean; disabled?: boolean; styles: ReturnType<typeof createStyles>; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.chip, selected && styles.chipSelected, disabled && styles.lockedChip]}>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

function ActionRow({ label, icon, styles, onPress }: { label: string; icon: string; styles: ReturnType<typeof createStyles>; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.actionRow}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.listArrow}>›</Text>
    </Pressable>
  );
}

function EmptyState({ text, styles }: { text: string; styles: ReturnType<typeof createStyles> }) {
  return <Text style={styles.emptyState}>{text}</Text>;
}

function AdhkarCard({ entry, count, palette, styles, onPress }: {
  entry: AdhkarEntry;
  count: number;
  palette: WorshipPalette;
  styles: ReturnType<typeof createStyles>;
  onPress?: () => void;
}) {
  const content = (
    <>
      <View style={styles.adhkarHeading}>
        <Text style={styles.listTitle}>{entry.title}</Text>
        {onPress ? <Text style={styles.repeatPill}>{Math.min(count, entry.count)}/{entry.count}</Text> : null}
      </View>
      <Text style={styles.arabicText}>{entry.arabic}</Text>
      <Text style={styles.transliteration}>{entry.transliteration}</Text>
      <Text style={styles.cardSummary}>{entry.meaning}</Text>
      <Text style={styles.cardReference}>{entry.reference}</Text>
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${entry.title}, ${Math.min(count, entry.count)} of ${entry.count}`} onPress={onPress} style={({ pressed }) => [styles.adhkarCard, pressed && styles.cardPressed]}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.adhkarCard}>{content}</View>
  );
}

function createStyles(colors: WorshipPalette) {
  return StyleSheet.create({
    introBlock: { marginBottom: 15 },
    eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
    pageTitle: { color: colors.ink, fontSize: 25, fontWeight: '600', marginTop: 7 },
    bodyText: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
    toolTabs: { gap: 7, paddingVertical: 6, marginBottom: 13 },
    toolTab: { minHeight: 35, minWidth: 68, paddingHorizontal: 13, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
    toolTabActive: { backgroundColor: colors.accent },
    toolTabLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
    toolTabLabelActive: { color: colors.accentInk },
    hadithCard: { position: 'relative', overflow: 'hidden', backgroundColor: colors.surface, borderRadius: 17, borderWidth: 1, borderColor: colors.line, padding: 18, paddingLeft: 21, minHeight: 205 },
    cardAccent: { position: 'absolute', left: 0, top: 17, bottom: 17, width: 3, borderRadius: 2, backgroundColor: colors.gold },
    cardEyebrow: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
    cardTitle: { color: colors.accent, fontSize: 19, fontWeight: '600', marginTop: 12 },
    cardSummary: { color: colors.ink, fontSize: 13, lineHeight: 20, marginTop: 10 },
    cardReference: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 11 },
    cardDisclosure: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 5 },
    actionRow: { minHeight: 45, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
    actionIcon: { color: colors.accent, fontSize: 17, width: 28 },
    actionLabel: { flex: 1, color: colors.ink, fontSize: 12, fontWeight: '600' },
    sectionLabel: { marginTop: 21, marginBottom: 10 },
    sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '600' },
    sectionCaption: { color: colors.muted, fontSize: 10, marginTop: 4 },
    searchInput: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, color: colors.ink, backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, fontSize: 12, marginTop: 8 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10, paddingBottom: 3 },
    chip: { maxWidth: 220, minHeight: 32, paddingHorizontal: 11, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
    chipSelected: { backgroundColor: colors.accent },
    chipLabel: { color: colors.muted, fontSize: 10, fontWeight: '600' },
    chipLabelSelected: { color: colors.accentInk },
    lockedChip: { opacity: 0.55 },
    collectionLock: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 9 },
    listGroup: { marginTop: 12, paddingHorizontal: 12, backgroundColor: colors.surface, borderRadius: 15 },
    listRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
    listCopy: { flex: 1, paddingVertical: 9, paddingRight: 10 },
    listTitle: { color: colors.ink, fontSize: 12, fontWeight: '600' },
    listSubtitle: { color: colors.muted, fontSize: 9, marginTop: 4 },
    listArrow: { color: colors.gold, fontSize: 18, paddingHorizontal: 5 },
    emptyState: { color: colors.muted, fontSize: 12, lineHeight: 18, paddingVertical: 18 },
    tasbeehPanel: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 20, marginTop: 14 },
    arabicText: { color: colors.ink, fontSize: 23, lineHeight: 42, textAlign: 'right', writingDirection: 'rtl', marginTop: 12 },
    tasbeehPhrase: { color: colors.accent, fontSize: 14, fontWeight: '600', textAlign: 'center', marginTop: 8 },
    counterButton: { width: 164, height: 164, borderRadius: 82, marginTop: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 8, borderColor: colors.surfaceRaised },
    counterPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
    counterValue: { color: colors.accentInk, fontSize: 42, fontWeight: '600' },
    counterTarget: { color: colors.accentInk, opacity: 0.8, fontSize: 11, marginTop: 1 },
    counterTrack: { width: '100%', height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.surfaceRaised, marginTop: 17 },
    counterFill: { height: '100%', borderRadius: 3, backgroundColor: colors.gold },
    counterActions: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    secondaryButton: { minHeight: 35, minWidth: 74, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    secondaryButtonText: { color: colors.muted, fontSize: 10, fontWeight: '600' },
    periodSwitch: { flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: colors.surfaceRaised, marginTop: 4 },
    periodButton: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
    periodButtonActive: { backgroundColor: colors.surface },
    periodLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
    periodLabelActive: { color: colors.accent, fontWeight: '700' },
    adhkarCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 15, padding: 15, marginTop: 10 },
    adhkarHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    repeatPill: { color: colors.accent, backgroundColor: colors.surfaceRaised, borderRadius: 12, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, fontSize: 10, fontWeight: '700' },
    transliteration: { color: colors.accent, fontSize: 12, lineHeight: 19, marginTop: 11 },
    cardPressed: { opacity: 0.84 },
    reciterIntro: { marginBottom: 8 },
    lockedPanel: { padding: 17, backgroundColor: colors.surface, borderRadius: 15, borderWidth: 1, borderColor: colors.line },
    lockedTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
    reciterPlayer: { padding: 16, backgroundColor: colors.surface, borderRadius: 15, borderWidth: 1, borderColor: colors.line, marginTop: 10, marginBottom: 12 },
    audioTrack: { height: 4, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.surfaceRaised, marginTop: 15 },
    audioFill: { height: '100%', backgroundColor: colors.gold },
    audioControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 7 },
    audioButton: { minWidth: 72, minHeight: 34, paddingHorizontal: 13, borderRadius: 17, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
    audioButtonText: { color: colors.accentInk, fontSize: 10, fontWeight: '700' },
  });
}