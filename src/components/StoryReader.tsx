import { useMemo, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { quranRefLabel, type Story } from '../domain/stories';
import type { WorshipPalette } from './WorshipHub';

interface StoryReaderProps {
  story: Story | null;
  palette: WorshipPalette;
  furqanBaseUrl: string;
  onClose: () => void;
  onNotice: (message: string) => void;
}

export function StoryReader({ story, palette, furqanBaseUrl, onClose, onNotice }: StoryReaderProps) {
  const [mode, setMode] = useState<'short' | 'long'>('short');
  const styles = useMemo(() => createStyles(palette), [palette]);

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      onNotice('That link could not be opened on this device.');
    }
  };

  const openVerse = async (surah: number, ayah: number) => {
    if (!furqanBaseUrl) {
      onNotice('The Furqan reader is not configured for this build.');
      return;
    }
    await openLink(`${furqanBaseUrl}/surah/${surah}?ayah=${ayah}`);
  };

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={story !== null}
    >
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Close story" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {story ? (
            <>
              <View style={styles.header}>
                <View style={styles.headerCopy}>
                  <Text style={styles.eyebrow}>
                    {story.section === 'prophets' ? `STORY ${story.order} OF 25` : story.era ?? 'STORY'}
                  </Text>
                  <Text style={styles.title}>{story.title}</Text>
                  {story.arabicName ? <Text style={styles.arabic}>{story.arabicName}</Text> : null}
                  <Text style={styles.subtitle}>{story.subtitle}</Text>
                </View>
                <Pressable accessibilityLabel="Close story" onPress={onClose} style={styles.close}>
                  <Text style={styles.closeText}>×</Text>
                </Pressable>
              </View>

              <View style={styles.modeRow}>
                {(['short', 'long'] as const).map((option) => (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected: mode === option }}
                    key={option}
                    onPress={() => setMode(option)}
                    style={[styles.modeChip, mode === option && styles.modeChipActive]}
                  >
                    <Text style={[styles.modeText, mode === option && styles.modeTextActive]}>
                      {option === 'short' ? 'Short read' : 'Long read'}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator>
                {mode === 'short' ? (
                  <Text style={styles.paragraph}>{story.short}</Text>
                ) : (
                  story.long.map((paragraph, index) => (
                    <Text key={index} style={styles.paragraph}>{paragraph}</Text>
                  ))
                )}

                {story.quranRefs.length > 0 ? (
                  <View style={styles.refBlock}>
                    <Text style={styles.refTitle}>In the Qur’an</Text>
                    <View style={styles.refRow}>
                      {story.quranRefs.map((ref) => (
                        <Pressable
                          accessibilityRole="link"
                          key={`${ref.surah}:${ref.from}`}
                          onPress={() => void openVerse(ref.surah, ref.from)}
                          style={styles.refChip}
                        >
                          <Text style={styles.refChipText}>{quranRefLabel(ref)} ›</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                {story.hadithRefs && story.hadithRefs.length > 0 ? (
                  <View style={styles.refBlock}>
                    <Text style={styles.refTitle}>In the hadith</Text>
                    {story.hadithRefs.map((reference) => (
                      <Text key={reference} style={styles.hadithText}>· {reference}</Text>
                    ))}
                  </View>
                ) : null}

                {story.video ? (
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => void openLink(story.video!.url)}
                    style={styles.watchButton}
                  >
                    <Text style={styles.watchGlyph}>▶</Text>
                    <View style={styles.watchCopy}>
                      <Text style={styles.watchTitle}>{story.video.label}</Text>
                      <Text style={styles.watchMeta}>Opens a video search in your browser</Text>
                    </View>
                  </Pressable>
                ) : null}

                <Text style={styles.footnote}>
                  Mishkah keeps a short and a long reading for each story. Verse references open the full surah in
                  Furqan, where the complete text sits in context.
                </Text>
              </ScrollView>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: WorshipPalette) {
  return StyleSheet.create({
    backdrop: { flex: 1, flexDirection: 'column', justifyContent: 'flex-end', backgroundColor: '#07161588' },
    sheet: {
      maxHeight: '92%',
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingTop: 10,
      paddingHorizontal: 20,
      paddingBottom: 18,
    },
    handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: colors.line },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 16 },
    headerCopy: { flex: 1, minWidth: 0 },
    eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
    title: { color: colors.ink, fontSize: 24, fontWeight: '700', marginTop: 6 },
    arabic: { color: colors.muted, fontSize: 17, marginTop: 2, writingDirection: 'rtl' },
    subtitle: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 6 },
    close: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.surfaceRaised },
    closeText: { color: colors.muted, fontSize: 22, lineHeight: 24 },
    modeRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
    modeChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
    },
    modeChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    modeText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    modeTextActive: { color: colors.accentInk },
    body: { paddingTop: 16, paddingBottom: 28, gap: 12 },
    paragraph: { color: colors.ink, fontSize: 14, lineHeight: 23 },
    refBlock: { marginTop: 6, padding: 14, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
    refTitle: { color: colors.ink, fontSize: 12, fontWeight: '700', marginBottom: 8 },
    refRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    refChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.surfaceRaised },
    refChipText: { color: colors.accent, fontSize: 11, fontWeight: '600' },
    hadithText: { color: colors.muted, fontSize: 12, lineHeight: 20 },
    watchButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 6,
      padding: 14,
      borderRadius: 16,
      backgroundColor: colors.accent,
    },
    watchGlyph: { color: colors.accentInk, fontSize: 16 },
    watchCopy: { flex: 1, minWidth: 0 },
    watchTitle: { color: colors.accentInk, fontSize: 13, fontWeight: '700' },
    watchMeta: { color: colors.accentInk, fontSize: 10, opacity: 0.75, marginTop: 2 },
    footnote: { color: colors.muted, fontSize: 10, lineHeight: 16, marginTop: 8 },
  });
}
