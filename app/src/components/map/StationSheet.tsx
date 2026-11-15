import { useEffect, useRef } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useStationDetailQuery } from '../../hooks';
import { Touchable } from '../Touchable';
import { useAppTheme } from '../../theme/ThemeContext';
import { emphasis, onColor, radius, spacing } from '../../theme';
import { stationName } from '../../utils/format';
import type { StationDetail } from '../../types';
import { LINE_BY_CODE, shortLineName, type MapStation } from './networkData';

interface Props {
  station: MapStation;
  onClose: () => void;
  onDetails: () => void;
  onRouteFromHere: () => void;
}

/**
 * A slow fade between 50% and 100% for placeholder shapes. Holds at full
 * opacity when motion is off, so the placeholders still show without moving.
 */
function usePulse(active: boolean): Animated.Value {
  const { animationStyle, reduceMotionEnabled } = useAppTheme();
  const value = useRef(new Animated.Value(1)).current;
  const still = animationStyle === 'none' || reduceMotionEnabled;

  useEffect(() => {
    if (!active || still) {
      value.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 0.5, duration: 700, useNativeDriver: true }),
        Animated.timing(value, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, still, value]);

  return value;
}

function facilityChips(detail: StationDetail | undefined): { icon: keyof typeof Ionicons.glyphMap; text: string }[] {
  if (!detail) return [];
  const chips: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [];
  const lifts = (detail.lifts ?? []).filter((l) => /lift/i.test(l.lift_type ?? ''));
  const escalators = (detail.lifts ?? []).filter((l) => /escalator/i.test(l.lift_type ?? ''));
  if (lifts.length) chips.push({ icon: 'swap-vertical', text: `${lifts.length} ${lifts.length === 1 ? 'lift' : 'lifts'}` });
  if (escalators.length) chips.push({ icon: 'trending-up', text: `${escalators.length} escalators` });
  if ((detail.gates ?? []).length) chips.push({ icon: 'enter-outline', text: `${detail.gates.length} gates` });
  if ((detail.parkings ?? []).length) chips.push({ icon: 'car-outline', text: 'Parking' });
  const names = (detail.station_facility ?? []).map((f) => f.name.toLowerCase());
  if (names.some((n) => n.includes('divyang'))) chips.push({ icon: 'accessibility-outline', text: 'Step-free' });
  if ((detail.platforms ?? []).length) {
    chips.push({ icon: 'subway-outline', text: `${detail.platforms.length} platforms` });
  }
  return chips;
}

/**
 * Bottom sheet for the station picked on the map: which lines stop here, the
 * first and last train, what the station has, and the two next steps.
 */
export function StationSheet({ station, onClose, onDetails, onRouteFromHere }: Props) {
  const theme = useTheme();
  const { fills } = useAppTheme();
  const { data: detail, isLoading: detailLoading } = useStationDetailQuery(station.code);

  const lines = station.lines
    .map((code) => LINE_BY_CODE.get(code))
    .filter((line, index, all): line is NonNullable<typeof line> =>
      Boolean(line) && all.findIndex((l) => l?.name === line?.name) === index,
    );

  const chips = facilityChips(detail);
  const name = stationName(station.name);
  const kannada = detail?.station_name_kn;
  const chipsLoading = chips.length === 0 && detailLoading;
  const pulse = usePulse(chipsLoading);

  return (
    <View style={[styles.sheet, { backgroundColor: fills.containerLow }]}>
      <View style={[styles.handle, { backgroundColor: theme.colors.onSurfaceVariant }]} />

      <View style={styles.head}>
        <View
          style={[
            styles.mark,
            { backgroundColor: station.interchange ? theme.colors.primary : lines[0]?.color ?? theme.colors.primary },
          ]}
        >
          <Ionicons
            name={station.interchange ? 'swap-horizontal' : 'train'}
            size={24}
            color={station.interchange ? theme.colors.onPrimary : onColor(lines[0]?.color ?? theme.colors.primary)}
          />
        </View>
        <View style={styles.headText}>
          <Text variant="labelMedium" style={[styles.overline, { color: theme.colors.primary }]}>
            {station.interchange ? 'Interchange' : 'Station'}
          </Text>
          <Text variant="headlineSmall" numberOfLines={2} style={[emphasis.strong, { color: theme.colors.onSurface }]}>
            {name}
          </Text>
          {kannada ? (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              {kannada}
            </Text>
          ) : null}
          <View style={styles.badges}>
            {lines.map((line) => (
              <View key={line.code} style={[styles.badge, { backgroundColor: line.color }]}>
                <Text variant="labelMedium" style={[emphasis.strong, { color: onColor(line.color) }]}>
                  {shortLineName(line)}
                </Text>
              </View>
            ))}
          </View>
        </View>
        <Touchable
          radius={radius.pill}
          onPress={onClose}
          accessibilityLabel="Close station"
          style={{ backgroundColor: fills.containerHigh }}
        >
          <View style={styles.close}>
            <Ionicons name="close" size={22} color={theme.colors.onSurface} />
          </View>
        </Touchable>
      </View>

      {chipsLoading ? (
        <View style={styles.chipRowSkeleton} accessible accessibilityLabel="Loading facilities">
          {[84, 120, 92].map((width) => (
            <Animated.View
              key={width}
              style={[styles.chip, { width, backgroundColor: fills.containerHighest, opacity: pulse }]}
            />
          ))}
        </View>
      ) : null}

      {chips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsBleed}
        >
          {chips.map((chip) => (
            <View key={chip.text} style={[styles.chip, { backgroundColor: fills.containerHighest }]}>
              <Ionicons name={chip.icon} size={18} color={theme.colors.onSurface} />
              <Text variant="labelLarge" style={[emphasis.medium, { color: theme.colors.onSurface }]}>
                {chip.text}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {station.approx ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          This station's position on the map is approximate.
        </Text>
      ) : null}

      <View style={styles.actions}>
        {/* Touchable wraps itself in a clipping view, so flex goes on a parent. */}
        <View style={styles.action}>
        <Touchable
          radius={radius.pill}
          onPress={onDetails}
          accessibilityLabel={`Details for ${name}`}
          style={{ backgroundColor: theme.colors.secondaryContainer }}
        >
          <View style={styles.actionInner}>
            <Ionicons name="information-circle-outline" size={20} color={theme.colors.onSecondaryContainer} />
            <Text variant="titleSmall" style={[emphasis.strong, { color: theme.colors.onSecondaryContainer }]}>
              Details
            </Text>
          </View>
        </Touchable>
        </View>
        <View style={[styles.action, styles.actionWide]}>
        <Touchable
          radius={radius.pill}
          haptic="press"
          onPress={onRouteFromHere}
          accessibilityLabel={`Plan a route from ${name}`}
          style={{ backgroundColor: theme.colors.primary }}
        >
          <View style={styles.actionInner}>
            <Ionicons name="navigate-outline" size={20} color={theme.colors.onPrimary} />
            <Text variant="titleSmall" style={[emphasis.strong, { color: theme.colors.onPrimary }]}>
              Route from here
            </Text>
          </View>
        </Touchable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.base,
    paddingTop: 10,
    paddingBottom: spacing.lg,
    gap: spacing.base,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    opacity: 0.4,
    alignSelf: 'center',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  overline: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  badge: {
    height: 24,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    justifyContent: 'center',
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tile: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    gap: 2,
  },
  barTime: {
    height: 26,
    width: '62%',
    borderRadius: 8,
    marginTop: 6,
  },
  barNote: {
    height: 12,
    width: '80%',
    borderRadius: 6,
    marginTop: 6,
  },
  chipRowSkeleton: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chipsBleed: {
    marginHorizontal: -spacing.base,
    flexGrow: 0,
  },
  chips: {
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
  actionWide: {
    flex: 1.4,
  },
  actionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
  },
});
