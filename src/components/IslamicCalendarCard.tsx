import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  getRamadanCalendarDates,
  HIJRI_MONTHS,
  type IslamicDate,
  type UpcomingIslamicEvent,
} from '../domain/islamicCalendar';
import { addCalendarDays } from '../domain/prayer';

interface IslamicCalendarCardProps {
  cityName: string;
  currentDate: IslamicDate | null;
  error: string;
  events: readonly UpcomingIslamicEvent[];
  onNotice: (message: string) => void;
}

interface CalendarReference {
  label: string;
  url: string;
}

interface EventDetails {
  lines: string[];
  references: CalendarReference[];
}

const CALENDAR_PHOTOS = [
  require('../../assets/share-backgrounds/ocean.jpg'),
  require('../../assets/share-backgrounds/sky.jpg'),
  require('../../assets/share-backgrounds/skyline.jpg'),
  require('../../assets/share-backgrounds/snow.jpg'),
  require('../../assets/share-backgrounds/mountain-starry.jpg'),
  require('../../assets/share-backgrounds/mountain-valley.jpg'),
  require('../../assets/share-backgrounds/alpine-range.jpg'),
  require('../../assets/share-backgrounds/forest-sunrise.jpg'),
  require('../../assets/share-backgrounds/lakeshore.jpg'),
] as const;

const EVENT_SUMMARIES: Record<string, string> = {
  'islamic-new-year': 'The first day of Muharram marks the start of a new Hijri year. The calendar date alone does not prescribe a special act of worship.',
  ashura: 'Ashura is the tenth day of Muharram. Some Muslims observe fasting on this day; check trusted local guidance for its practice.',
  'eid-al-fitr': 'The first day of Shawwal follows Ramadan. Its date is an estimate until confirmed by local moon sighting.',
  'day-of-arafah': 'The ninth day of Dhu al-Hijjah falls during the Hajj season, one day before Eid al-Adha.',
  'eid-al-adha': 'The tenth day of Dhu al-Hijjah marks Eid al-Adha. Its date is an estimate and can differ with local moon sighting.',
};

const RAMADAN_REFERENCES: readonly CalendarReference[] = [
  { label: 'Qur’an 97:1–5', url: 'https://quran.com/97/1-5' },
  { label: 'Sahih al-Bukhari 2017', url: 'https://sunnah.com/bukhari:2017' },
  { label: 'Sahih al-Bukhari 2024', url: 'https://sunnah.com/bukhari:2024' },
  { label: 'Sahih al-Bukhari 2026', url: 'https://sunnah.com/bukhari:2026' },
];

function formatGregorianDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

function eventDetails(event: UpcomingIslamicEvent): EventDetails {
  const hijriDate = `${event.hijriDay} ${HIJRI_MONTHS[event.hijriMonth - 1]} ${event.hijriYear} AH`;
  if (event.id !== 'ramadan') {
    return {
      lines: [
        EVENT_SUMMARIES[event.id] ?? 'An estimated date in the Hijri calendar.',
        `Hijri date: ${hijriDate}.`,
        `Estimated Gregorian date: ${formatGregorianDate(event.date)}.`,
      ],
      references: [],
    };
  }

  const ramadan = getRamadanCalendarDates(event.date);
  const oddNightDates = ramadan.oddNights
    .map(({ hijriDay, beginsAt }) => `Night of ${hijriDay} Ramadan · sunset ${formatGregorianDate(beginsAt)}`)
    .join('; ');
  const firstFinalNight = ramadan.finalTenNights[0];
  return {
    lines: [
      `First fast: 1 Ramadan · ${formatGregorianDate(ramadan.firstFast)} (estimated). Ramadan begins at sunset on ${formatGregorianDate(addCalendarDays(ramadan.firstFast, -1))}.`,
      `Last fast: ${ramadan.finalHijriDay} Ramadan · ${formatGregorianDate(ramadan.lastFast)} (estimated). Ramadan ends at sunset that day.`,
      `Eid al-Fitr: 1 Shawwal · ${formatGregorianDate(ramadan.eidAlFitr)} (estimated).`,
      `Final ten nights: Ramadan ${firstFinalNight?.hijriDay ?? '21'}–${ramadan.finalHijriDay}. Each night begins at sunset on the previous Gregorian date.`,
      'Laylat al-Qadr is sought in the odd nights of the final ten; its exact night is not known in advance.',
      `Estimated odd nights: ${oddNightDates}.`,
      'The Prophet ﷺ increased worship in the last ten nights, and practiced i‘tikaf during them.',
    ],
    references: [...RAMADAN_REFERENCES],
  };
}

function makeShareText(event: UpcomingIslamicEvent, details: EventDetails, cityName: string): string {
  const references = details.references.length
    ? `\n\nSources:\n${details.references.map(({ label, url }) => `${label}: ${url}`).join('\n')}`
    : '';
  return [
    `Mishkah · Islamic calendar`,
    event.title,
    `Estimated date: ${formatGregorianDate(event.date)} · ${event.hijriDay} ${HIJRI_MONTHS[event.hijriMonth - 1]} ${event.hijriYear} AH`,
    ...details.lines,
    `Countdown: ${event.daysUntil === 0 ? 'Today' : `In ${event.daysUntil} days`}.`,
    `Dates are estimates for ${cityName} and may differ by local moon sighting.`,
  ].join('\n') + references;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function wrapText(lines: readonly string[], maxCharacters: number): string[] {
  return lines.flatMap((line) => {
    const words = line.split(/\s+/);
    const wrapped: string[] = [];
    let current = '';
    for (const word of words) {
      if (current && `${current} ${word}`.length > maxCharacters) {
        wrapped.push(current);
        current = word;
      } else {
        current = current ? `${current} ${word}` : word;
      }
    }
    if (current) wrapped.push(current);
    return wrapped;
  });
}

function makeCalendarSvg(
  event: UpcomingIslamicEvent,
  details: EventDetails,
  cityName: string,
  photoUri: string,
): string {
  const content = [
    `${event.hijriDay} ${HIJRI_MONTHS[event.hijriMonth - 1]} ${event.hijriYear} AH · ${formatGregorianDate(event.date)}`,
    event.daysUntil === 0 ? 'Today' : `In ${event.daysUntil} days`,
    ...details.lines,
    `Estimated for ${cityName}; dates may differ by local moon sighting.`,
    details.references.length ? `Sources: ${details.references.map(({ label }) => label).join(' · ')}` : '',
  ].filter(Boolean);
  const textLines = wrapText(content, 57);
  const body = textLines.map((line, index) =>
    `<text x="88" y="${410 + index * 49}" fill="#FFFFFF" font-size="29" font-family="Arial,sans-serif">${escapeXml(line)}</text>`,
  ).join('');
  const footerY = Math.min(1400, 470 + textLines.length * 49);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1500" viewBox="0 0 1080 1500"><image href="${photoUri}" width="1080" height="1500" preserveAspectRatio="xMidYMid slice"/><rect width="1080" height="1500" fill="#071615" opacity=".72"/><rect x="62" y="62" width="956" height="1376" rx="34" fill="none" stroke="#FFFFFF" stroke-opacity=".22" stroke-width="2"/><rect x="88" y="100" width="8" height="88" rx="4" fill="#E8C781"/><text x="124" y="140" fill="#F4E2B9" font-size="24" font-family="Arial,sans-serif" letter-spacing="3">MISHKAH · ISLAMIC CALENDAR</text><text x="88" y="310" fill="#FFFFFF" font-size="48" font-family="Georgia,serif">${escapeXml(event.title)}</text>${body}<text x="88" y="${footerY}" fill="#FFFFFF" fill-opacity=".72" font-size="22" font-family="Arial,sans-serif">Mishkah · by LIXZON</text></svg>`;
}

async function photoDataUri(source: number): Promise<string> {
  const uri = Asset.fromModule(source).uri;
  if (!uri) throw new Error('The selected calendar photo could not be resolved.');
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`The selected calendar photo could not be loaded (HTTP ${response.status}).`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('The selected calendar photo could not be prepared for sharing.'));
    reader.onerror = () => reject(new Error('The selected calendar photo could not be prepared for sharing.'));
    reader.readAsDataURL(blob);
  });
}

export function IslamicCalendarCard({
  cityName,
  currentDate,
  error,
  events,
  onNotice,
}: IslamicCalendarCardProps) {
  const [expandedEventKey, setExpandedEventKey] = useState<string | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const cardRef = useRef<ViewShotRef | null>(null);
  const expandedEvent = events.find((event) => `${event.id}:${event.hijriYear}` === expandedEventKey);
  const details = expandedEvent ? eventDetails(expandedEvent) : null;

  const copyDetails = async (event: UpcomingIslamicEvent, eventInfo: EventDetails) => {
    try {
      await Clipboard.setStringAsync(makeShareText(event, eventInfo, cityName));
      onNotice('Calendar event details copied to the clipboard.');
    } catch (copyError) {
      onNotice(`Could not copy calendar details: ${copyError instanceof Error ? copyError.message : 'clipboard access is unavailable'}`);
    }
  };

  const shareCard = async (event: UpcomingIslamicEvent, eventInfo: EventDetails) => {
    try {
      if (Platform.OS === 'web') {
        const svg = makeCalendarSvg(event, eventInfo, cityName, await photoDataUri(CALENDAR_PHOTOS[photoIndex]));
        const file = new File([svg], `mishkah-calendar-${event.id}.svg`, { type: 'image/svg+xml' });
        const webNavigator = navigator as Navigator & {
          share?: (data: ShareData) => Promise<void>;
          canShare?: (data: ShareData) => boolean;
        };
        if (webNavigator.share && webNavigator.canShare?.({ files: [file] })) {
          await webNavigator.share({
            title: `${event.title} · Mishkah`,
            text: makeShareText(event, eventInfo, cityName),
            files: [file],
          });
          onNotice('Calendar share card shared.');
          return;
        }
        const objectUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `mishkah-calendar-${event.id}.svg`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        onNotice('Calendar share card downloaded. Attach the image to a message to share it.');
        return;
      }

      if (!cardRef.current || !(await Sharing.isAvailableAsync())) {
        onNotice('Image sharing is not available on this device. Copy the event details instead.');
        return;
      }
      const imageUri = await cardRef.current.capture();
      if (!imageUri) throw new Error('The calendar card image could not be captured.');
      await Sharing.shareAsync(imageUri, {
        mimeType: 'image/png',
        dialogTitle: `Share ${event.title}`,
      });
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === 'AbortError') return;
      onNotice(`Could not share the calendar card: ${shareError instanceof Error ? shareError.message : 'sharing is unavailable'}`);
    }
  };

  const openReference = async (reference: CalendarReference) => {
    try {
      await Linking.openURL(reference.url);
    } catch (openError) {
      onNotice(`Could not open ${reference.label}: ${openError instanceof Error ? openError.message : 'link handling is unavailable'}`);
    }
  };

  return (
    <View style={styles.calendarCard}>
      <Image source={CALENDAR_PHOTOS[(photoIndex + 8) % CALENDAR_PHOTOS.length]} resizeMode="cover" style={StyleSheet.absoluteFill} />
      <View style={styles.calendarScrim} />
      <Text style={styles.eyebrow}>ISLAMIC CALENDAR · ESTIMATE</Text>
      {currentDate ? (
        <>
          <Text style={styles.currentDate}>
            {currentDate.day} {HIJRI_MONTHS[currentDate.month - 1]} {currentDate.year} AH
          </Text>
          <Text style={styles.location}>{cityName} · dates may differ by local moon sighting.</Text>
          {events.map((event) => {
            const eventKey = `${event.id}:${event.hijriYear}`;
            const expanded = expandedEventKey === eventKey;
            return (
              <View key={eventKey}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => setExpandedEventKey(expanded ? null : eventKey)}
                  style={styles.eventRow}
                >
                  <View style={styles.eventCopy}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventDate}>
                      {event.hijriDay} {HIJRI_MONTHS[event.hijriMonth - 1]} · {formatGregorianDate(event.date)}
                    </Text>
                  </View>
                  <View style={styles.eventTrailing}>
                    <Text style={styles.countdown}>{event.daysUntil === 0 ? 'Today' : `In ${event.daysUntil} days`}</Text>
                    <Text style={styles.chevron}>{expanded ? '⌃' : '⌄'}</Text>
                  </View>
                </Pressable>
                {expanded && expandedEvent && details ? (
                  <View style={styles.expandedEvent}>
                    <ViewShot ref={cardRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }} style={styles.shareCard}>
                      <Image source={CALENDAR_PHOTOS[photoIndex]} resizeMode="cover" style={StyleSheet.absoluteFill} />
                      <View style={styles.shareScrim} />
                      <View style={styles.shareCardContent}>
                        <Text style={styles.shareEyebrow}>MISHKAH · ISLAMIC CALENDAR</Text>
                        <Text style={styles.shareTitle}>{expandedEvent.title}</Text>
                        <Text style={styles.shareDate}>
                          {expandedEvent.hijriDay} {HIJRI_MONTHS[expandedEvent.hijriMonth - 1]} {expandedEvent.hijriYear} AH · {formatGregorianDate(expandedEvent.date)}
                        </Text>
                        <Text style={styles.shareCountdown}>
                          {expandedEvent.daysUntil === 0 ? 'Today' : `In ${expandedEvent.daysUntil} days`}
                        </Text>
                        {details.lines.map((line) => <Text key={line} style={styles.shareDetail}>{line}</Text>)}
                        {details.references.length ? (
                          <Text style={styles.shareSources}>
                            Sources: {details.references.map(({ label }) => label).join(' · ')}
                          </Text>
                        ) : null}
                        <Text style={styles.shareCaveat}>Estimated for {cityName}; local moon sighting may differ.</Text>
                        <Text style={styles.shareBrand}>Mishkah · by LIXZON</Text>
                      </View>
                    </ViewShot>
                    <View style={styles.actionRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Shuffle calendar card background"
                        onPress={() => setPhotoIndex((previous) =>
                          (previous + 1 + Math.floor(Math.random() * (CALENDAR_PHOTOS.length - 1))) % CALENDAR_PHOTOS.length)}
                        style={styles.actionButton}
                      >
                        <Text style={styles.actionText}>Shuffle photo</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => void shareCard(expandedEvent, details)} style={styles.actionButton}>
                        <Text style={styles.actionText}>Share card</Text>
                      </Pressable>
                      <Pressable accessibilityRole="button" onPress={() => void copyDetails(expandedEvent, details)} style={styles.actionButton}>
                        <Text style={styles.actionText}>Copy details</Text>
                      </Pressable>
                    </View>
                    {details.references.length ? (
                      <View style={styles.references}>
                        {details.references.map((reference) => (
                          <Pressable key={reference.url} accessibilityRole="link" onPress={() => void openReference(reference)}>
                            <Text style={styles.referenceText}>{reference.label} ↗</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      ) : (
        <Text style={styles.location}>{error || 'Islamic calendar dates are unavailable.'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  calendarCard: { position: 'relative', overflow: 'hidden', padding: 17, marginTop: 9, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: '#14201D' },
  calendarScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 15, 13, 0.78)' },
  eyebrow: { color: '#E8D19A', fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  currentDate: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 9 },
  location: { color: 'rgba(255,255,255,0.84)', fontSize: 12, lineHeight: 18, marginTop: 7 },
  eventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 11, marginTop: 9, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.23)' },
  eventCopy: { flex: 1, minWidth: 0 },
  eventTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  eventDate: { color: 'rgba(255,255,255,0.76)', fontSize: 10, marginTop: 4 },
  eventTrailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countdown: { color: '#E8D19A', fontSize: 11, fontWeight: '700' },
  chevron: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  expandedEvent: { gap: 9, paddingTop: 12 },
  shareCard: { position: 'relative', overflow: 'hidden', minHeight: 250, borderRadius: 15, backgroundColor: '#14201D' },
  shareScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 15, 13, 0.78)' },
  shareCardContent: { padding: 16 },
  shareEyebrow: { color: '#E8D19A', fontSize: 9, fontWeight: '700', letterSpacing: 0.9 },
  shareTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', lineHeight: 23, marginTop: 9 },
  shareDate: { color: '#FFFFFF', fontSize: 11, lineHeight: 17, marginTop: 7 },
  shareCountdown: { color: '#E8D19A', fontSize: 11, fontWeight: '700', marginTop: 5 },
  shareDetail: { color: '#FFFFFF', fontSize: 10, lineHeight: 15, marginTop: 8 },
  shareSources: { color: '#F4E2B9', fontSize: 9, lineHeight: 14, fontWeight: '700', marginTop: 9 },
  shareCaveat: { color: 'rgba(255,255,255,0.8)', fontSize: 9, lineHeight: 14, marginTop: 9 },
  shareBrand: { color: 'rgba(255,255,255,0.72)', fontSize: 9, marginTop: 10 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  actionButton: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 11, borderRadius: 17, borderWidth: 1, borderColor: 'rgba(255,255,255,0.48)', backgroundColor: 'rgba(255,255,255,0.1)' },
  actionText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  references: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  referenceText: { color: '#F4E2B9', fontSize: 10, fontWeight: '700', paddingVertical: 3 },
});
