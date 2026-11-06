import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getContextualAnswer } from '../domain/assistant';

export type AssistantDestination = 'Prayer' | 'Global' | 'Fasting' | 'Guide' | 'Settings' | 'Worship';

interface AiAssistantBarProps {
  palette: {
    surface: string;
    surfaceRaised: string;
    ink: string;
    muted: string;
    line: string;
    accent: string;
    accentInk: string;
  };
  onNavigate: (destination: AssistantDestination, query: string) => void;
}

function destinationForQuery(query: string): AssistantDestination {
  const normalized = query.toLocaleLowerCase();
  if (/reciter|audio quran|quran audio/.test(normalized)) return 'Worship';
  if (/hadith|prophet|sunnah/.test(normalized)) return 'Worship';
  if (/tasbeeh|tasbih|dhikr|adhkar|remembrance/.test(normalized)) return 'Worship';
  if (/dua|supplication|travel|sleep/.test(normalized)) return 'Worship';
  if (/fast|suhoor|iftar|ramadan/.test(normalized)) return 'Fasting';
  if (/city|location|global|travel time/.test(normalized)) return 'Global';
  if (/setting|calculation method|theme/.test(normalized)) return 'Settings';
  if (/prayer|salah|fajr|dhuhr|asr|maghrib|isha/.test(normalized)) return 'Prayer';
  return 'Guide';
}

export function AiAssistantBar({ palette, onNavigate }: AiAssistantBarProps) {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState<{ title: string; body: string; destination: AssistantDestination } | null>(null);
  const styles = createStyles(palette);

  const submit = () => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;
    const localAnswer = getContextualAnswer(cleanQuery);
    setAnswer({ title: localAnswer.title, body: localAnswer.answer, destination: destinationForQuery(cleanQuery) });
  };

  return (
    <View style={styles.wrap}>
      {answer ? (
        <View style={styles.answer}>
          <Text style={styles.answerTitle}>{answer.title}</Text>
          <Text style={styles.answerBody} numberOfLines={3}>{answer.body}</Text>
          <View style={styles.answerActions}>
            <Pressable onPress={() => onNavigate(answer.destination, query)}>
              <Text style={styles.actionLink}>Open {answer.destination === 'Settings' ? 'More' : answer.destination}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss guidance" onPress={() => setAnswer(null)}>
              <Text style={styles.dismiss}>×</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <View style={styles.inputRow}>
        <Text style={styles.spark}>✦</Text>
        <TextInput
          accessibilityLabel="Ask Rafiq AI for guidance"
          onChangeText={setQuery}
          onSubmitEditing={submit}
          placeholder="Ask Rafiq AI for guidance"
          placeholderTextColor={palette.muted}
          returnKeyType="search"
          style={styles.input}
          value={query}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Ask guidance" onPress={submit} style={styles.sendButton}>
          <Text style={styles.sendText}>↗</Text>
        </Pressable>
      </View>
      <Text style={styles.disclosure}>Rafiq AI · On-device answers · offline ready</Text>
    </View>
  );
}

function createStyles(colors: AiAssistantBarProps['palette']) {
  return StyleSheet.create({
    wrap: { paddingHorizontal: 14, paddingTop: 7, paddingBottom: 6, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
    inputRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 10, backgroundColor: colors.surfaceRaised },
    spark: { color: colors.accent, fontSize: 15, marginRight: 8 },
    input: { flex: 1, minWidth: 0, color: colors.ink, fontSize: 11, paddingVertical: 7 },
    sendButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
    sendText: { color: colors.accentInk, fontSize: 16, lineHeight: 18 },
    disclosure: { color: colors.muted, fontSize: 8, marginTop: 4, textAlign: 'center' },
    answer: { padding: 11, marginBottom: 7, backgroundColor: colors.surfaceRaised, borderRadius: 12 },
    answerTitle: { color: colors.ink, fontSize: 11, fontWeight: '700' },
    answerBody: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 4 },
    answerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 },
    actionLink: { color: colors.accent, fontSize: 10, fontWeight: '700' },
    dismiss: { color: colors.muted, fontSize: 20, paddingHorizontal: 4 },
  });
}