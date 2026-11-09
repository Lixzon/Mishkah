import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  SECTION_BY_ID,
  STORY_SECTIONS,
  searchStories,
  storiesInSection,
  type Story,
  type StorySectionId,
} from '../domain/stories';
import type { WorshipPalette } from './WorshipHub';
import { StoryReader } from './StoryReader';

interface StoriesHubProps {
  palette: WorshipPalette;
  furqanBaseUrl: string;
  onNotice: (message: string) => void;
}

export function StoriesHub({ palette, furqanBaseUrl, onNotice }: StoriesHubProps) {
  const [section, setSection] = useState<StorySectionId>('prophets');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Story | null>(null);
  const styles = useMemo(() => createStyles(palette), [palette]);

  const searching = query.trim().length > 0;
  const stories = searching ? searchStories(query, section) : storiesInSection(section);
  const meta = SECTION_BY_ID.get(section);

  return (
    <View>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>{meta?.eyebrow ?? 'STORIES'}</Text>
        <Text style={styles.pageTitle}>Stories that were told to us.</Text>
        <Text style={styles.body}>{meta?.description}</Text>
      </View>

      <ScrollView
        horizontal
        contentContainerStyle={styles.sectionRow}
        showsHorizontalScrollIndicator={false}
      >
        {STORY_SECTIONS.map((entry) => {
          const active = entry.id === section;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={entry.id}
              onPress={() => {
                setSection(entry.id);
                setQuery('');
              }}
              style={[styles.sectionChip, active && styles.sectionChipActive]}
            >
              <Text style={[styles.sectionText, active && styles.sectionTextActive]}>{entry.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          accessibilityLabel="Search stories"
          onChangeText={setQuery}
          placeholder="Search a prophet, a companion, or a sign"
          placeholderTextColor={palette.muted}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        {searching ? (
          <Pressable accessibilityLabel="Clear story search" onPress={() => setQuery('')} style={styles.clear}>
            <Text style={styles.clearText}>×</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.count}>
        {stories.length} {stories.length === 1 ? 'story' : 'stories'}
        {section === 'prophets' && !searching ? ' · in order, Adam to Muhammad ﷺ' : ''}
      </Text>

      {stories.map((story) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${story.title}. ${story.subtitle}`}
          key={story.id}
          onPress={() => setSelected(story)}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={styles.cardNumber}>
            <Text style={styles.cardNumberText}>
              {story.section === 'prophets' || story.section === 'companions' ? story.order : '·'}
            </Text>
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>{story.title}</Text>
            <Text style={styles.cardSubtitle}>{story.subtitle}</Text>
            <View style={styles.cardFooter}>
              <Text style={styles.cardMeta}>{story.era ?? (story.hadithRefs?.[0] ?? 'Story')}</Text>
              <Text style={styles.cardAction}>Read ›</Text>
            </View>
          </View>
        </Pressable>
      ))}

      {stories.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing matches that search</Text>
          <Text style={styles.body}>Try a name, such as Yusuf, Bilal, or Dajjal.</Text>
        </View>
      ) : null}

      <Text style={styles.footnote}>
        Stories are written for Mishkah and cite the Qur’an and authentic narrations. Where revelation is silent,
        the entry stays silent too.
      </Text>

      <StoryReader
        story={selected}
        palette={palette}
        furqanBaseUrl={furqanBaseUrl}
        onClose={() => setSelected(null)}
        onNotice={onNotice}
      />
    </View>
  );
}

function createStyles(colors: WorshipPalette) {
  return StyleSheet.create({
    intro: { paddingTop: 6, paddingBottom: 4 },
    eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '700', letterSpacing: 1.6 },
    pageTitle: { color: colors.ink, fontSize: 25, fontWeight: '700', marginTop: 8 },
    body: { color: colors.muted, fontSize: 12, lineHeight: 19, marginTop: 8 },
    sectionRow: { gap: 8, paddingVertical: 14, paddingRight: 8 },
    sectionChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    sectionChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    sectionText: { color: colors.muted, fontSize: 11, fontWeight: '700' },
    sectionTextActive: { color: colors.accentInk },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      minHeight: 42,
    },
    searchIcon: { color: colors.muted, fontSize: 14 },
    searchInput: { flex: 1, color: colors.ink, fontSize: 13, paddingVertical: 0 },
    clear: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
    clearText: { color: colors.muted, fontSize: 18, lineHeight: 20 },
    count: { color: colors.muted, fontSize: 10, fontWeight: '600', letterSpacing: 0.6, marginTop: 12, marginBottom: 8 },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      padding: 14,
      marginBottom: 9,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    cardPressed: { opacity: 0.86, transform: [{ scale: 0.995 }] },
    cardNumber: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceRaised,
    },
    cardNumberText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
    cardCopy: { flex: 1, minWidth: 0 },
    cardTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
    cardSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    cardMeta: { color: colors.muted, fontSize: 10 },
    cardAction: { color: colors.accent, fontSize: 11, fontWeight: '700' },
    empty: {
      padding: 18,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      marginTop: 4,
    },
    emptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
    footnote: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 14 },
  });
}
