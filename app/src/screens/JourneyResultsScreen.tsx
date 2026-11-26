import { useHaptics } from '../hooks/useHaptics';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Appbar, Text, useTheme } from 'react-native-paper';
import {
  useJourneyPlanCachedQuery,
  useMetroLinesQuery,
  useStationSearchQuery,
} from '../hooks';
import { StrategyToggle } from '../components/StrategyToggle';
import { RouteSegmentView } from '../components/RouteSegmentView';
import { TransferSegmentView } from '../components/TransferSegmentView';
import { TicketPass } from '../components/TicketPass';
import { SectionHeader } from '../components/SectionHeader';
import { LoadingState } from '../components/LoadingState';
import { OfflineNote } from '../components/OfflineNote';
import { ErrorState } from '../components/ErrorState';
import { StationPicker } from '../components/StationPicker';
import { Reveal } from '../components/Reveal';
import { RouteMap } from '../components/map/RouteMap';
import { useSaved } from '../saved/SavedContext';
import { useAppTheme } from '../theme/ThemeContext';
import type { RouteStrategy } from '../types';
import type { HomeStackParamList, RootTabParamList } from '../navigation/types';
import { spacing, emphasis } from '../theme';
import { stationName } from '../utils/format';
import { useAdaptedStyles } from '../theme/useAdaptedStyles';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'JourneyResults'>;
type Route = RouteProp<HomeStackParamList, 'JourneyResults'>;

function normalizeLineKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function inr(value: number): string {
  return `₹${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

/** Shared links open the website, so a phone without the app can follow them. */
const PRODUCTION_ORIGIN = 'https://blr-metro.tashif.codes';

/** The page's own origin on web, so preview deploys share preview links. */
function shareOrigin(): string {
  return Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : PRODUCTION_ORIGIN;
}

type ChipTone = 'accent' | 'tonal' | 'outline';

export function JourneyResultsScreen() {
  const styles = useAdaptedStyles(baseStyles);
  const haptics = useHaptics();
  const route = useRoute<Route>();
  const isFocused = useIsFocused();
  const lastOutcome = useRef<string | null>(null);
  const navigation = useNavigation<Nav>();
  const { fromCode, toCode } = route.params;
  const theme = useTheme();
  const { fills, look } = useAppTheme();
  const saved = useSaved();
  const [strategy, setStrategy] = useState<RouteStrategy>(
    route.params.strategy ?? 'least-distance',
  );
  const [editing, setEditing] = useState<'from' | 'to' | null>(null);

  const { data: plan, isPending, isError, isPlaceholderData, savedAt, refetch } =
    useJourneyPlanCachedQuery(fromCode, toCode, strategy);

  // Deep links carry only codes, so fall back to the plan's own names.
  const fromName = stationName(route.params.fromName ?? plan?.origin.name ?? fromCode);
  const toName = stationName(route.params.toName ?? plan?.destination.name ?? toCode);

  const handleSwapStations = useCallback(() => {
    navigation.setParams({
      fromCode: toCode,
      fromName: toName,
      toCode: fromCode,
      toName: fromName,
    });
  }, [navigation, fromCode, fromName, toCode, toName]);

  const handleShare = useCallback(() => {
    const url = `${shareOrigin()}/journey/${encodeURIComponent(fromCode)}/${encodeURIComponent(toCode)}`;
    // iOS shows the url as a link preview, so it stays out of the message.
    const content =
      Platform.OS === 'ios'
        ? { message: `${fromName} to ${toName} on Namma Metro`, url }
        : { message: `${fromName} to ${toName} on Namma Metro: ${url}` };
    Share.share(content).catch(() => undefined);
  }, [fromCode, toCode, fromName, toName]);

  const isSaved = saved.isTripSaved(fromCode, toCode);
  const canSave = Boolean(plan && !isPlaceholderData);
  const handleSave = useCallback(() => {
    const nowSaved = saved.toggleTrip({ code: fromCode, name: fromName }, { code: toCode, name: toName });
    haptics.press();
    AccessibilityInfo.announceForAccessibility(nowSaved ? 'Trip saved' : 'Trip removed from Saved');
  }, [saved, fromCode, fromName, toCode, toName, haptics]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: ({ tintColor }) => (
        <>
          <Appbar.Action
            icon={({ size, color }) => <Ionicons name="swap-vertical" size={size} color={color} />}
            color={tintColor}
            accessibilityLabel="Reverse this journey"
            onPress={() => {
              haptics.press();
              handleSwapStations();
            }}
          />
          <Appbar.Action
            icon={({ size, color }) => <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={size} color={color} />}
            color={tintColor}
            accessibilityLabel={isSaved ? 'Remove saved trip' : 'Save this trip'}
            disabled={!canSave && !isSaved}
            onPress={handleSave}
          />
          <Appbar.Action
            icon={({ size, color }) => <Ionicons name="share-outline" size={size} color={color} />}
            color={tintColor}
            accessibilityLabel="Share this route"
            onPress={handleShare}
          />
        </>
      ),
    });
  }, [navigation, handleSwapStations, handleShare, handleSave, canSave, isSaved, haptics]);

  const handleStationSelect = useCallback(
    (station: { code: string; name: string }) => {
      const target = editing;
      setEditing(null);
      if (!target) return;
      if (target === 'from') {
        if (station.code === toCode) return handleSwapStations();
        navigation.setParams({ fromCode: station.code, fromName: station.name });
      } else {
        if (station.code === fromCode) return handleSwapStations();
        navigation.setParams({ toCode: station.code, toName: station.name });
      }
    },
    [editing, navigation, fromCode, toCode, handleSwapStations],
  );

  // One outcome per requested journey, including cached results. Refetches stay quiet.
  const journeyKey = JSON.stringify([fromCode, toCode, strategy]);
  useEffect(() => {
    if (!isFocused || isPending || isPlaceholderData || (!plan && !isError)) return;
    const outcomeKey = `${journeyKey}:${plan ? 'success' : 'error'}`;
    if (lastOutcome.current === outcomeKey) return;
    lastOutcome.current = outcomeKey;
    if (plan) haptics.success();
    else haptics.error();
  }, [isFocused, isPending, isPlaceholderData, plan, isError, journeyKey, haptics]);

  const { data: lines } = useMetroLinesQuery();
  const { data: allStations } = useStationSearchQuery('');

  // A sideways swipe flips between the two strategies, but only when they
  // give different routes. Otherwise the swipe would reload the same plan.
  const swipeHint = useRef(new Animated.Value(0)).current;
  const canSwipeRef = useRef(false);
  canSwipeRef.current = plan?.strategies_differ === true;
  const strategyRef = useRef(strategy);
  strategyRef.current = strategy;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        canSwipeRef.current && Math.abs(gs.dx) > 12 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderRelease: (_, gs) => {
        if (!canSwipeRef.current) return;
        const current = strategyRef.current;
        const next: RouteStrategy | null =
          gs.dx < -50 && current !== 'minimum-interchange'
            ? 'minimum-interchange'
            : gs.dx > 50 && current !== 'least-distance'
              ? 'least-distance'
              : null;
        if (!next) return;
        haptics.select();
        setStrategy(next);
        Animated.sequence([
          Animated.timing(swipeHint, {
            toValue: gs.dx < 0 ? -8 : 8,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.spring(swipeHint, { toValue: 0, useNativeDriver: true }),
        ]).start();
      },
    }),
  ).current;

  const stationCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allStations ?? []) map.set(s.station_name.trim().toLowerCase(), s.station_code);
    return map;
  }, [allStations]);

  const lineColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const line of lines ?? []) {
      map.set(normalizeLineKey(line.name), line.primary_color_code);
      map.set(normalizeLineKey(line.line_color), line.primary_color_code);
      map.set(normalizeLineKey(line.line_code), line.primary_color_code);
    }
    return map;
  }, [lines]);

  if (isPending && !plan) return <LoadingState message="Planning your journey..." />;
  if (isError && !plan) {
    return <ErrorState message="Could not plan this journey" onRetry={refetch} />;
  }
  if (!plan) return <ErrorState message="No route data available" />;

  const rideLegs = plan.legs.filter((leg) => leg.kind !== 'transfer');
  const changes = Math.max(0, rideLegs.length - 1);
  const colorFor = (lineName: string, explicit: string | null) =>
    explicit ?? lineColorMap.get(normalizeLineKey(lineName)) ?? theme.colors.primary;

  // BMRC publishes one price per fare type and no running times, so the
  // summary counts stations and changes instead of promising a duration.
  const changeStations = plan.interchanges.map((stop) => stationName(stop.station));
  const summary = `${plan.station_count} ${
    plan.station_count === 1 ? 'station' : 'stations'
  }, ${changes === 0 ? 'no changes' : changeStations.length > 0 ? `change at ${changeStations.join(', ')}` : `${changes} ${changes === 1 ? 'change' : 'changes'}`}`;

  const fare = plan.fare.bmrc;
  const fareRows = [
    { label: 'Token', value: inr(fare.token), hint: 'Single journey' },
    { label: 'Smart card, peak', value: inr(fare.smart_card_peak), hint: '' },
    { label: 'Smart card, off-peak', value: inr(fare.smart_card_off_peak), hint: '' },
    { label: 'Group ticket', value: inr(fare.group_ticket), hint: '' },
  ];

  const savedLabel = savedAt
    ? `Saved plan from ${new Date(savedAt).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })}. Fares may have changed.`
    : 'Saved plan. Fares may have changed.';

  const chips: { key: string; icon: keyof typeof Ionicons.glyphMap; text: string; tone: ChipTone }[] =
    [
      { key: 'fare', icon: 'cash-outline', text: `Token ${inr(fare.token)}`, tone: 'accent' },
      {
        key: 'changes',
        icon: 'swap-horizontal',
        text: changes === 0 ? 'No changes' : `${changes} ${changes === 1 ? 'change' : 'changes'}`,
        tone: 'tonal',
      },
      {
        key: 'stations',
        icon: 'ellipsis-horizontal',
        text: `${plan.station_count} ${plan.station_count === 1 ? 'station' : 'stations'}`,
        tone: 'outline',
      },
    ];

  return (
    <View
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      {...(plan.strategies_differ === true ? panResponder.panHandlers : {})}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {savedAt !== null && !isPlaceholderData ? <OfflineNote message={savedLabel} /> : null}

        {/* Headline. Each station name opens the picker to change it. */}
        <Reveal index={0} replayOnFocus={false}>
          <View style={styles.head}>
            <Text
              variant="headlineMedium"
              style={[styles.headline, { color: theme.colors.onSurface }]}
            >
              <Text
                onPress={() => setEditing('from')}
                accessibilityRole="button"
                accessibilityHint="Change the starting station"
              >
                {fromName}
              </Text>
              <Text style={[styles.headlineJoin, { color: theme.colors.onSurfaceVariant }]}>
                {' to '}
              </Text>
              <Text
                onPress={() => setEditing('to')}
                accessibilityRole="button"
                accessibilityHint="Change the destination"
              >
                {toName}
              </Text>
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {summary}
            </Text>
          </View>
        </Reveal>

        <Reveal index={1} replayOnFocus={false}>
          <View style={styles.chips}>
            {chips.map((chip) => {
              const fg =
                chip.tone === 'accent' ? theme.colors.onPrimaryContainer : theme.colors.onSurface;
              return (
                <View
                  key={chip.key}
                  style={[
                    styles.chip,
                    chip.tone === 'accent' && { backgroundColor: theme.colors.primaryContainer },
                    chip.tone === 'tonal' && { backgroundColor: fills.containerHigh },
                    chip.tone === 'outline' && {
                      borderWidth: 1,
                      borderColor: theme.colors.outlineVariant,
                    },
                  ]}
                >
                  {chip.tone !== 'outline' ? (
                    <Ionicons name={chip.icon} size={16} color={fg} />
                  ) : null}
                  <Text variant="labelLarge" style={[emphasis.strong, look.figures, { color: fg }]}>
                    {chip.text}
                  </Text>
                </View>
              );
            })}
          </View>
        </Reveal>

        {/* The preference sits above the map it changes. BMRC's two strategies
            return the same route everywhere, so this stays hidden until they
            actually differ. */}
        {plan.strategies_differ === true ? (
          <Reveal index={1} replayOnFocus={false}>
            <Animated.View style={{ transform: [{ translateX: swipeHint }] }}>
              <StrategyToggle active={strategy} onChange={setStrategy} />
            </Animated.View>
          </Reveal>
        ) : null}

        {/* The trip on the network map, like the map tab but framed on this route. */}
        <Reveal index={1} replayOnFocus={false}>
          <RouteMap
            legs={plan.legs}
            colorFor={(leg) => colorFor(leg.line_name, leg.line_color)}
            onOpenMap={() =>
              navigation.getParent<NavigationProp<RootTabParamList>>()?.navigate('MapTab', {
                screen: 'MetroMap',
                params: { focusCode: rideLegs[0]?.from_station_code ?? fromCode },
              })
            }
          />
        </Reveal>

        <Reveal index={4} replayOnFocus={false}>
          <View style={[styles.timeline, { backgroundColor: fills.containerLow }]}>
            {plan.legs.map((leg, index) =>
              leg.kind === 'transfer' ? (
                <TransferSegmentView key={`transfer-${leg.from_station}-${index}`} leg={leg} />
              ) : (
                <RouteSegmentView
                  key={`${leg.line_name}-${leg.from_station}-${index}`}
                  leg={leg}
                  lineColor={colorFor(leg.line_name, leg.line_color)}
                  isLast={index === plan.legs.length - 1}
                  stationCodeMap={stationCodeMap}
                  onStationPress={(code, name) =>
                    navigation.navigate('StationDetail', { stationCode: code, stationName: name })
                  }
                />
              ),
            )}
          </View>
        </Reveal>

        <View style={styles.section}>
          <SectionHeader title="Ticket" />
          <TicketPass
            fromCode={plan.origin.code || fromCode}
            toCode={plan.destination.code || toCode}
            fromName={fromName}
            toName={toName}
            date={new Date().toLocaleDateString(undefined, {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
            })}
            columns={[
              { label: 'Token', value: inr(fare.token), note: 'Single journey' },
              {
                label: 'Smart card',
                value: inr(fare.smart_card_off_peak),
                note: `Peak ${inr(fare.smart_card_peak)}`,
              },
            ]}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Fares" />
          <View style={[styles.fareTable, { backgroundColor: fills.containerLow }]}>
            {fareRows.map((row, index) => (
              <View
                key={row.label}
                style={[
                  styles.fareRow,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.fareLabel}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurface }}>
                    {row.label}
                  </Text>
                  {row.hint ? (
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {row.hint}
                    </Text>
                  ) : null}
                </View>
                <Text
                  variant="titleSmall"
                  style={[emphasis.strong, look.figures, { color: theme.colors.onSurface }]}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>
          <Text
            variant="labelSmall"
            style={[styles.fareNote, { color: theme.colors.onSurfaceVariant }]}
          >
            {`Zone ${fare.zone}. Fares from BMRCL.`}
          </Text>
        </View>
      </ScrollView>

      <StationPicker
        visible={editing !== null}
        selectedCode={editing === 'from' ? fromCode : toCode}
        onSelect={handleStationSelect}
        onClose={() => setEditing(null)}
        title={editing === 'to' ? 'Change destination' : 'Change start'}
      />
    </View>
  );
}

const baseStyles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    paddingBottom: 40,
    gap: spacing.base,
  },
  head: {
    gap: 6,
    paddingHorizontal: spacing.xs,
  },
  headline: {
    fontWeight: '500',
    letterSpacing: -0.3,
  },
  headlineJoin: {
    fontWeight: '400',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
  },
  timeline: {
    borderRadius: 28,
    paddingTop: 18,
    paddingRight: spacing.base,
    paddingLeft: spacing.base,
    paddingBottom: spacing.xs,
  },
  section: {
    gap: spacing.xs,
  },
  fareTable: {
    borderRadius: 24,
    paddingHorizontal: spacing.base,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  fareLabel: {
    flexShrink: 1,
  },
  fareNote: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
  },
});
