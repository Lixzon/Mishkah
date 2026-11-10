import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { City } from '../domain/cities';
import { getQiblaBearing, normalizeHeading, relativeQiblaHeading } from '../domain/qibla';
import { EVERYDAY_MOMENTS, LESSER_KNOWN_DUAS, PRACTICAL_GUIDANCE } from '../domain/guidance';

type GuidancePalette = {
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
};

interface GuidanceHubProps {
  city: City;
  hour: number;
  initialSection?: 'overview' | 'qibla' | 'wellness';
  palette: GuidancePalette;
}

type Coordinates = { latitude: number; longitude: number };

const GUIDANCE_PHOTOS = [
  require('../../assets/share-backgrounds/ocean.jpg'),
  require('../../assets/share-backgrounds/mountain-valley.jpg'),
  require('../../assets/share-backgrounds/mountain-starry.jpg'),
  require('../../assets/share-backgrounds/alpine-range.jpg'),
  require('../../assets/share-backgrounds/forest-sunrise.jpg'),
  require('../../assets/share-backgrounds/lakeshore.jpg'),
  require('../../assets/share-backgrounds/sky.jpg'),
  require('../../assets/share-backgrounds/snow.jpg'),
  require('../../assets/share-backgrounds/skyline.jpg'),
] as const;

export function GuidanceHub({ city, initialSection = 'overview', palette }: GuidanceHubProps) {
  const [section, setSection] = useState<'overview' | 'qibla' | 'wellness'>(initialSection);
  const [coordinates, setCoordinates] = useState<Coordinates>({
    latitude: city.latitude,
    longitude: city.longitude,
  });
  const [locationLabel, setLocationLabel] = useState(`Using ${city.name} city centre`);
  const [heading, setHeading] = useState<number | null>(null);
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [compassError, setCompassError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const subscription = useRef<ReturnType<typeof Magnetometer.addListener> | null>(null);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const qiblaBearing = getQiblaBearing(coordinates.latitude, coordinates.longitude);
  const pointerRotation = heading === null
    ? qiblaBearing
    : relativeQiblaHeading(qiblaBearing, heading);

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (!compassEnabled) return;
    let active = true;

    const startCompass = async () => {
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
          setCompassError('This browser does not provide a compass sensor. The Qibla bearing from north is still shown.');
          return;
        }
        const handleOrientation = (event: DeviceOrientationEvent) => {
          if (typeof event.alpha === 'number' && event.absolute) {
            setHeading(normalizeHeading(360 - event.alpha));
            setCompassError('');
          }
        };
        window.addEventListener('deviceorientation', handleOrientation);
        return () => window.removeEventListener('deviceorientation', handleOrientation);
      }

      try {
        if (!(await Magnetometer.isAvailableAsync())) {
          setCompassError('A compass sensor is not available on this device. The Qibla bearing from north is still shown.');
          return;
        }
        Magnetometer.setUpdateInterval(100);
        subscription.current = Magnetometer.addListener(({ x, y }) => {
          if (!active) return;
          setHeading(normalizeHeading(90 - Math.atan2(y, x) * 180 / Math.PI));
          setCompassError('');
        });
      } catch (error) {
        if (active) {
          setCompassError(error instanceof Error ? error.message : 'The compass could not be started.');
        }
      }
    };

    let removeWebListener: (() => void) | undefined;
    void startCompass().then((cleanup) => {
      removeWebListener = cleanup;
    }).catch((error: unknown) => {
      if (active) setCompassError(error instanceof Error ? error.message : 'The compass could not be started.');
    });

    return () => {
      active = false;
      subscription.current?.remove();
      subscription.current = null;
      removeWebListener?.();
    };
  }, [compassEnabled]);

  const useCurrentLocation = async () => {
    setIsLocating(true);
    setLocationError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError('Location access was not granted. The compass will continue using the selected city.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setLocationLabel('Using your current location');
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Your location could not be read.');
    } finally {
      setIsLocating(false);
    }
  };

  const openSource = async (url: string) => {
    setReferenceError('');
    try {
      await Linking.openURL(url);
    } catch (error) {
      setReferenceError(error instanceof Error ? error.message : 'The source could not be opened.');
    }
  };

  const renderSources = (sources: readonly { label: string; url: string }[]) => (
    <View style={styles.sourceRow}>
      {sources.map((source) => (
        <Pressable key={source.url} accessibilityRole="link" onPress={() => void openSource(source.url)}>
          <Text style={styles.sourceLink}>{source.label} ↗</Text>
        </Pressable>
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.sectionSwitch}>
        {([
          { id: 'overview', label: 'Muslim life' },
          { id: 'qibla', label: 'Qibla' },
          { id: 'wellness', label: 'Du’as & moments' },
        ] as const).map((item) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: section === item.id }}
            key={item.id}
            onPress={() => setSection(item.id)}
            style={[styles.sectionButton, section === item.id && styles.sectionButtonActive]}
          >
            <Text style={[styles.sectionButtonText, section === item.id && styles.sectionButtonTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {section === 'overview' ? (
        <>
          <View style={styles.photoCard}>
            <Image source={GUIDANCE_PHOTOS[0]} resizeMode="cover" style={styles.photo} />
            <View style={styles.photoScrim} />
            <View style={styles.photoAccent} />
            <View style={styles.photoContent}>
              <Text style={styles.eyebrow}>GUIDANCE FOR EVERYDAY MUSLIM LIFE</Text>
              <Text style={styles.title}>Faith in the things we do every day.</Text>
              <Text style={styles.body}>Explore worship, character, food, rest, wellbeing, family, and daily activities. Each card points to Qur’an or hadith sources where available. Summaries are not fatwas or medical advice.</Text>
            </View>
          </View>
          {PRACTICAL_GUIDANCE.map((item, index) => (
            <View key={item.id} style={styles.photoCard}>
              <Image source={GUIDANCE_PHOTOS[(index + 1) % GUIDANCE_PHOTOS.length]} resizeMode="cover" style={styles.photo} />
              <View style={styles.photoScrim} />
              <View style={styles.photoAccent} />
              <View style={styles.photoContent}>
                <Text style={styles.eyebrow}>PRACTICE · {item.title.toUpperCase()}</Text>
                <Text style={styles.title}>{item.summary}</Text>
                <Text style={styles.body}>{item.practice}</Text>
                {renderSources(item.sources)}
              </View>
            </View>
          ))}
        </>
      ) : null}

      {section === 'qibla' ? (
        <View style={styles.photoCard}>
          <Image source={GUIDANCE_PHOTOS[3]} resizeMode="cover" style={styles.photo} />
          <View style={styles.photoScrim} />
          <View style={styles.photoAccent} />
          <View style={styles.photoContent}>
            <Text style={styles.eyebrow}>DIRECTION OF PRAYER</Text>
            <Text style={styles.title}>Qibla compass</Text>
            <Text style={styles.body}>{locationLabel}</Text>
            <View style={styles.compass}>
              <View style={styles.compassNorth}><Text style={styles.northLabel}>N</Text></View>
              <View style={[styles.qiblaPointer, { transform: [{ rotate: `${pointerRotation}deg` }] }]}>
                <View style={styles.pointerTop} />
                <View style={styles.pointerBottom} />
              </View>
              <View style={styles.compassCenter}><Text style={styles.kaaba}>◆</Text></View>
            </View>
            <Text style={styles.bearing}>{Math.round(qiblaBearing)}° from true north</Text>
            <View style={styles.actionRow}>
              <Pressable accessibilityRole="button" disabled={isLocating} onPress={() => void useCurrentLocation()} style={[styles.actionButton, isLocating && styles.disabledButton]}>
                <Text style={styles.actionText}>{isLocating ? 'Finding location…' : 'Use current location'}</Text>
              </Pressable>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: compassEnabled }} onPress={() => {
                setCompassError('');
                setCompassEnabled((enabled) => !enabled);
                if (compassEnabled) setHeading(null);
              }} style={[styles.actionButton, compassEnabled && styles.actionButtonActive]}>
                <Text style={[styles.actionText, compassEnabled && styles.actionTextActive]}>
                  {compassEnabled ? 'Compass on' : 'Enable compass'}
                </Text>
              </Pressable>
            </View>
            {locationError ? <Text accessibilityRole="alert" style={styles.error}>{locationError}</Text> : null}
            {compassError ? <Text accessibilityRole="alert" style={styles.error}>{compassError}</Text> : null}
            <Text style={styles.disclosure}>Compass readings are approximate and may be affected by nearby metal or magnetic interference. You can use the bearing from north without granting location access.</Text>
          </View>
        </View>
      ) : null}

      {section === 'wellness' ? (
        <>
          <View style={styles.photoCard}>
            <Image source={GUIDANCE_PHOTOS[5]} resizeMode="cover" style={styles.photo} />
            <View style={styles.photoScrim} />
            <View style={styles.photoAccent} />
            <View style={styles.photoContent}>
              <Text style={styles.eyebrow}>DU’AS FOR DAILY LIFE</Text>
              <Text style={styles.title}>Supplications for familiar and difficult moments.</Text>
              <Text style={styles.body}>Read the meaning and check the Qur’an or hadith reference. A dua is worship—not a guarantee of a particular outcome.</Text>
            </View>
          </View>
          <View style={styles.sectionHeading}>
            <Text style={styles.eyebrow}>LESS-KNOWN, USEFUL DU’AS</Text>
            <Text style={styles.sectionDescription}>Less frequently shared supplications, with their sources and context.</Text>
          </View>
          {LESSER_KNOWN_DUAS.map((item, index) => (
            <View key={item.id} style={styles.photoCard}>
              <Image source={GUIDANCE_PHOTOS[(index + 2) % GUIDANCE_PHOTOS.length]} resizeMode="cover" style={styles.photo} />
              <View style={styles.photoScrim} />
              <View style={styles.photoAccent} />
              <View style={styles.photoContent}>
                <Text style={styles.eyebrow}>A LESS-KNOWN DU’A</Text>
                <Text style={styles.title}>{item.moment}</Text>
                {item.arabic ? <Text style={styles.arabic}>{item.arabic}</Text> : null}
                {item.transliteration ? <Text style={styles.transliteration}>{item.transliteration}</Text> : null}
                <Text style={styles.body}>{item.meaning}</Text>
                {item.practice ? <Text style={styles.disclosure}>{item.practice}</Text> : null}
                {renderSources(item.sources)}
              </View>
            </View>
          ))}
          <View style={styles.sectionHeading}>
            <Text style={styles.eyebrow}>DU’AS FOR EVERYDAY MOMENTS</Text>
          </View>
          {EVERYDAY_MOMENTS.map((item, index) => (
            <View key={item.id} style={styles.photoCard}>
              <Image source={GUIDANCE_PHOTOS[(index + 6) % GUIDANCE_PHOTOS.length]} resizeMode="cover" style={styles.photo} />
              <View style={styles.photoScrim} />
              <View style={styles.photoAccent} />
              <View style={styles.photoContent}>
                <Text style={styles.eyebrow}>A DU’A OR REMEMBRANCE</Text>
                <Text style={styles.title}>{item.moment}</Text>
                {item.arabic ? <Text style={styles.arabic}>{item.arabic}</Text> : null}
                {item.transliteration ? <Text style={styles.transliteration}>{item.transliteration}</Text> : null}
                <Text style={styles.body}>{item.meaning}</Text>
                {item.practice ? <Text style={styles.disclosure}>{item.practice}</Text> : null}
                {renderSources(item.sources)}
              </View>
            </View>
          ))}
        </>
      ) : null}
      {referenceError ? <Text accessibilityRole="alert" style={styles.error}>{referenceError}</Text> : null}
    </View>
  );
}

function createStyles(colors: GuidancePalette) {
  return StyleSheet.create({
    container: { gap: 12, marginTop: 16 },
    sectionSwitch: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
    sectionButton: { minHeight: 36, paddingHorizontal: 13, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
    sectionButtonActive: { backgroundColor: colors.accent },
    sectionButtonText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
    sectionButtonTextActive: { color: colors.accentInk },
    sectionHeading: { gap: 5, paddingHorizontal: 2, paddingTop: 6 },
    sectionDescription: { color: colors.muted, fontSize: 11, lineHeight: 17 },
    photoCard: { position: 'relative', overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', backgroundColor: '#11201D' },
    photo: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
    photoScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(5, 18, 19, 0.72)' },
    photoAccent: { position: 'absolute', left: 0, top: 17, bottom: 17, width: 3, borderRadius: 2, backgroundColor: colors.gold },
    photoContent: { padding: 17, paddingLeft: 21 },
    eyebrow: { color: '#F3DEAE', fontSize: 9, fontWeight: '700', letterSpacing: 1.1 },
    title: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', lineHeight: 23, marginTop: 8 },
    body: { color: '#FFFFFF', fontSize: 12, lineHeight: 19, marginTop: 8, opacity: 0.94 },
    arabic: { color: '#FFFFFF', fontSize: 21, lineHeight: 40, marginTop: 12, textAlign: 'right', writingDirection: 'rtl' },
    transliteration: { color: '#F3DEAE', fontSize: 11, lineHeight: 18, marginTop: 8 },
    disclosure: { color: '#FFFFFF', fontSize: 10, lineHeight: 16, marginTop: 9, opacity: 0.82 },
    sourceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
    sourceLink: { color: '#F3DEAE', fontSize: 10, fontWeight: '700', paddingVertical: 4 },
    compass: { width: 218, height: 218, alignSelf: 'center', marginTop: 18, borderRadius: 109, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
    compassNorth: { position: 'absolute', top: 13, width: 24, alignItems: 'center' },
    northLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    qiblaPointer: { position: 'absolute', top: 24, bottom: 24, width: 24, alignItems: 'center', justifyContent: 'space-between' },
    pointerTop: { width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 44, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: colors.gold },
    pointerBottom: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 31, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FFFFFF', opacity: 0.6 },
    compassCenter: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    kaaba: { color: colors.gold, fontSize: 17 },
    bearing: { color: '#F3DEAE', fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 9 },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
    actionButton: { minHeight: 39, paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
    actionButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    actionText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
    actionTextActive: { color: colors.accentInk },
    disabledButton: { opacity: 0.55 },
    error: { color: '#FFD4CB', fontSize: 10, lineHeight: 15, marginTop: 8 },
  });
}
