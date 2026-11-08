import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { City } from '../domain/cities';
import { getQiblaBearing, normalizeHeading, relativeQiblaHeading } from '../domain/qibla';
import { WELLNESS_GUIDANCE } from '../domain/guidance';

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
  palette: GuidancePalette;
}

type Coordinates = { latitude: number; longitude: number };

export function GuidanceHub({ city, hour, palette }: GuidanceHubProps) {
  const [section, setSection] = useState<'overview' | 'qibla' | 'wellness'>('overview');
  const [coordinates, setCoordinates] = useState<Coordinates>({
    latitude: city.latitude,
    longitude: city.longitude,
  });
  const [locationLabel, setLocationLabel] = useState(`Using ${city.name} city centre`);
  const [heading, setHeading] = useState<number | null>(null);
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [compassError, setCompassError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const subscription = useRef<ReturnType<typeof Magnetometer.addListener> | null>(null);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const qiblaBearing = getQiblaBearing(coordinates.latitude, coordinates.longitude);
  const pointerRotation = heading === null
    ? qiblaBearing
    : relativeQiblaHeading(qiblaBearing, heading);
  const contextualTitle = hour >= 4 && hour < 12
    ? 'Morning adhkar'
    : hour >= 17 && hour < 22
      ? 'Evening remembrance'
      : hour >= 22 || hour < 4
        ? 'A quiet moment before sleep'
        : 'A moment to pause';
  const contextualBody = hour >= 4 && hour < 12
    ? 'Begin the day with remembrance and a prayer for well-being.'
    : hour >= 17 && hour < 22
      ? 'Close the day with evening remembrance and gratitude.'
      : hour >= 22 || hour < 4
        ? 'Settle into your evening with the supplication before sleep.'
        : 'Return to remembrance whenever you need a gentle pause.';

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

  return (
    <View style={styles.container}>
      <View style={styles.sectionSwitch}>
        {([
          { id: 'overview', label: 'Sunnah' },
          { id: 'qibla', label: 'Qibla' },
          { id: 'wellness', label: 'At-Tibb & Adab' },
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
        <View style={styles.card}>
          <Text style={styles.eyebrow}>A SUNNAH FOR THIS MOMENT</Text>
          <Text style={styles.title}>{contextualTitle}</Text>
          <Text style={styles.body}>{contextualBody}</Text>
          <Pressable accessibilityRole="button" onPress={() => setSection('wellness')} style={styles.linkButton}>
            <Text style={styles.linkText}>Explore wellness and Adab</Text>
            <Text style={styles.linkArrow}>›</Text>
          </Pressable>
        </View>
      ) : null}

      {section === 'qibla' ? (
        <View style={styles.card}>
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
      ) : null}

      {section === 'wellness' ? (
        <>
          <View style={styles.card}>
            <Text style={styles.eyebrow}>AT-TIBB · FOOD AND WELLNESS</Text>
            <Text style={styles.title}>Prophetic tradition, with care.</Text>
            <Text style={styles.body}>These notes are educational and do not diagnose, treat, or prevent illness. Ask a qualified clinician before changing treatment or using supplements.</Text>
          </View>
          {WELLNESS_GUIDANCE.map((item) => (
            <View key={item.id} style={styles.wellnessCard}>
              <Text style={styles.wellnessTitle}>{item.title}</Text>
              <Text style={styles.body}>{item.summary}</Text>
              <Text style={styles.tradition}>{item.tradition}</Text>
              <Text style={styles.disclosure}>{item.practicalNote}</Text>
            </View>
          ))}
          <View style={styles.card}>
            <Text style={styles.eyebrow}>ADAB & DAILY LIFE</Text>
            <Text style={styles.title}>Small, considerate habits.</Text>
            <Text style={styles.body}>Eat and drink with moderation, give thanks, keep shared spaces clean, and avoid causing harm. Specific rulings can vary; consult a trusted scholar for religious guidance.</Text>
          </View>
        </>
      ) : null}
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
    card: { padding: 17, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
    eyebrow: { color: colors.gold, fontSize: 9, fontWeight: '700', letterSpacing: 1.3 },
    title: { color: colors.ink, fontSize: 17, fontWeight: '700', marginTop: 8 },
    body: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
    linkButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
    linkText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
    linkArrow: { color: colors.accent, fontSize: 20 },
    compass: { width: 218, height: 218, alignSelf: 'center', marginTop: 18, borderRadius: 109, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
    compassNorth: { position: 'absolute', top: 13, width: 24, alignItems: 'center' },
    northLabel: { color: colors.muted, fontSize: 11, fontWeight: '800' },
    qiblaPointer: { position: 'absolute', top: 24, bottom: 24, width: 24, alignItems: 'center', justifyContent: 'space-between' },
    pointerTop: { width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 44, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: colors.accent },
    pointerBottom: { width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 31, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: colors.muted, opacity: 0.6 },
    compassCenter: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    kaaba: { color: colors.gold, fontSize: 17 },
    bearing: { color: colors.accent, fontSize: 15, fontWeight: '700', textAlign: 'center', marginTop: 9 },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 },
    actionButton: { minHeight: 39, paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    actionButtonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    actionText: { color: colors.accent, fontSize: 10, fontWeight: '700' },
    actionTextActive: { color: colors.accentInk },
    disabledButton: { opacity: 0.55 },
    error: { color: '#A44343', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 8 },
    disclosure: { color: colors.muted, fontSize: 9, lineHeight: 14, marginTop: 10 },
    wellnessCard: { padding: 15, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
    wellnessTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' },
    tradition: { color: colors.accent, fontSize: 9, fontWeight: '700', marginTop: 7 },
  });
}
