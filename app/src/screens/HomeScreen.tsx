import { useCallback, useEffect, useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import {
  usePopularRoutesQuery,
  useNotificationsQuery,
  useStationPicker,
  useStationSearchQuery,
} from '../hooks';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { StationPicker } from '../components/StationPicker';
import { SectionHeader } from '../components/SectionHeader';
import { NotificationCard } from '../components/NotificationCard';
import { Touchable } from '../components/Touchable';
import { Reveal } from '../components/Reveal';
import { JourneyFields } from '../components/JourneyFields';
import { OfflineNote } from '../components/OfflineNote';
import { GetTheApp } from '../components/web/GetTheApp';
import { useAppTheme } from '../theme/ThemeContext';
import type { HomeStackParamList, RootTabParamList } from '../navigation/types';
import { spacing, radius, shape, emphasis, overline } from '../theme';
import { stationName } from '../utils/format';

type Nav = NativeStackNavigationProp<HomeStackParamList, 'Home'>;

function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { fills } = useAppTheme();
  const isDesktop = useIsDesktop();
  const fromPicker = useStationPicker();
  const toPicker = useStationPicker();
  const popularRoutes = usePopularRoutesQuery(5);
  const notifications = useNotificationsQuery();
  const savedAlerts = notifications.isOfflineCopy;
  const savedNote = savedAlerts
    ? 'You are offline. Alerts are from your last visit. Search and saved journeys still work.'
    : '';
  const { data: allStations } = useStationSearchQuery('');

  // "Route from here" on a station or the map lands here with the From field
  // already filled. Clear the param so a later visit doesn't refill it.
  const route = useRoute<RouteProp<HomeStackParamList, 'Home'>>();
  const presetFrom = route.params?.presetFrom;
  const setFrom = fromPicker.setStation;
  useEffect(() => {
    if (!presetFrom) return;
    setFrom(presetFrom);
    navigation.setParams({ presetFrom: undefined });
  }, [presetFrom, setFrom, navigation]);

  const canSearch = Boolean(fromPicker.station && toPicker.station);

  // Popular routes are stored as bare codes; resolve them to names so the
  // list reads as places rather than as identifiers.
  const stationNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of allStations ?? []) {
      map.set(s.station_code.trim().toUpperCase(), s.station_name);
    }
    return map;
  }, [allStations]);

  const nameForCode = useCallback(
    (code: string) => stationNameMap.get(code.trim().toUpperCase()) ?? code,
    [stationNameMap],
  );

  const handleFindRoute = () => {
    if (!fromPicker.station || !toPicker.station) return;
    navigation.navigate('JourneyResults', {
      fromCode: fromPicker.station.code,
      toCode: toPicker.station.code,
      fromName: fromPicker.station.name,
      toName: toPicker.station.name,
    });
  };

  const handleSwap = useCallback(() => {
    const temp = fromPicker.station;
    fromPicker.setStation(toPicker.station);
    toPicker.setStation(temp);
  }, [fromPicker, toPicker]);

  const handlePopularRoute = (fromCode: string, toCode: string) => {
    navigation.navigate('JourneyResults', {
      fromCode,
      toCode,
      fromName: nameForCode(fromCode),
      toName: nameForCode(toCode),
    });
  };

  const tabs = navigation.getParent<NavigationProp<RootTabParamList>>();
  const goToAlerts = () => tabs?.navigate('AlertsTab', { screen: 'Notifications' } as never);

  const hasFrequent = (popularRoutes.data?.length ?? 0) > 0;
  const hasAlerts = (notifications.data?.length ?? 0) > 0;

  const planner = (
    <View style={[styles.planner, { backgroundColor: fills.container }]}>
      <JourneyFields
        from={{
          name: fromPicker.station ? stationName(fromPicker.station.name) : null,
          placeholder: 'Choose a station',
          onPress: fromPicker.open,
          accessibilityLabel: `From: ${fromPicker.station?.name ?? 'choose a station'}`,
          accessibilityHint: 'Opens the station picker',
        }}
        to={{
          name: toPicker.station ? stationName(toPicker.station.name) : null,
          placeholder: 'Choose a station',
          onPress: toPicker.open,
          accessibilityLabel: `To: ${toPicker.station?.name ?? 'choose a station'}`,
          accessibilityHint: 'Opens the station picker',
        }}
        onSwap={handleSwap}
        swapDisabled={
          (!fromPicker.station && !toPicker.station) ||
          fromPicker.station?.code === toPicker.station?.code
        }
      />

      <View style={styles.plannerControls}>
        <Touchable
          radius={radius.pill}
          haptic="press"
          onPress={handleFindRoute}
          disabled={!canSearch}
          accessibilityLabel="Find route"
          accessibilityHint={canSearch ? undefined : 'Pick both stations first'}
          style={{ backgroundColor: theme.colors.primary, opacity: canSearch ? 1 : 0.5 }}
        >
          <View style={styles.findButton}>
            <Ionicons name="search" size={20} color={theme.colors.onPrimary} />
            <Text variant="titleMedium" style={[emphasis.strong, { color: theme.colors.onPrimary }]}>
              Find route
            </Text>
          </View>
        </Touchable>
      </View>
    </View>
  );

  const frequent = !hasFrequent ? null : (
    <View style={styles.section}>
      <SectionHeader title="Frequent" />
      {/* Separate tiles with small gaps and only the outer corners fully
          rounded, so the group reads as one block. */}
      <View style={styles.groupList}>
        {popularRoutes.data!.map((route, index, all) => (
          <Touchable
            key={route.routeKey}
            radius={shape.sm}
            haptic="press"
            onPress={() => handlePopularRoute(route.fromStationCode, route.toStationCode)}
            accessibilityLabel={`Plan ${nameForCode(route.fromStationCode)} to ${nameForCode(route.toStationCode)}`}
            style={[
              styles.groupTile,
              { backgroundColor: fills.containerLow },
              index === 0 && styles.groupTileFirst,
              index === all.length - 1 && styles.groupTileLast,
            ]}
          >
            <View style={styles.routeRow}>
              <View style={styles.miniRail}>
                <View style={[styles.miniRing, { borderColor: theme.colors.primary }]} />
                <View style={[styles.miniLine, { backgroundColor: theme.colors.primary }]} />
                <View style={[styles.miniDot, { backgroundColor: theme.colors.primary }]} />
              </View>
              <View style={styles.routeNames}>
                <Text
                  variant="bodyLarge"
                  numberOfLines={1}
                  style={[emphasis.strong, { color: theme.colors.onSurface }]}
                >
                  {stationName(nameForCode(route.fromStationCode))}
                </Text>
                <Text
                  variant="bodyLarge"
                  numberOfLines={1}
                  style={[emphasis.strong, { color: theme.colors.onSurface }]}
                >
                  {stationName(nameForCode(route.toStationCode))}
                </Text>
              </View>
              <View style={styles.routeMeta}>
                <Text variant="titleSmall" style={[emphasis.strong, { color: theme.colors.onSurface }]}>
                  {route.hitCount}×
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  planned
                </Text>
              </View>
            </View>
          </Touchable>
        ))}
      </View>
    </View>
  );

  const alerts = !hasAlerts ? null : (
    <View style={styles.section}>
      <SectionHeader title="Alerts" action="See all" onAction={goToAlerts} />
      <View style={styles.notifList}>
        {notifications.data!.slice(0, 3).map((notif) => (
          <NotificationCard key={notif.id} notification={notif} />
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + (isDesktop ? spacing.xl : spacing.sm) },
        isDesktop && styles.contentDesktop,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Reveal index={0}>
        <View style={styles.masthead}>
          <View style={styles.mastheadTop}>
            <Text
              variant="labelMedium"
              style={[overline, styles.date, { color: theme.colors.onSurfaceVariant }]}
            >
              {todayLabel()}
            </Text>
            <Touchable
              radius={radius.pill}
              onPress={() => navigation.navigate('About')}
              accessibilityLabel="About this app"
            >
              <View style={styles.iconButton}>
                <Ionicons name="information-circle-outline" size={22} color={theme.colors.onSurfaceVariant} />
              </View>
            </Touchable>
            <Touchable
              radius={radius.pill}
              onPress={() => navigation.navigate('Appearance')}
              accessibilityLabel="Appearance settings"
              style={{ backgroundColor: fills.containerHigh }}
            >
              <View style={styles.iconButton}>
                <Ionicons name="color-palette-outline" size={20} color={theme.colors.onSurface} />
              </View>
            </Touchable>
          </View>
          <Text
            variant="displaySmall"
            accessibilityRole="header"
            style={[styles.title, { color: theme.colors.onSurface }]}
          >
            Where are you{'\n'}headed today?
          </Text>
        </View>
      </Reveal>

      {savedAlerts ? <OfflineNote message={savedNote} /> : null}

      <Reveal index={1}>{planner}</Reveal>

      {isDesktop ? (
        // A first visit has no frequent routes yet. An empty column would
        // push Alerts into the right half, so each column needs content.
        <View style={styles.desktopColumns}>
          {frequent ? <View style={styles.desktopColumn}>{frequent}</View> : null}
          {alerts ? <View style={styles.desktopColumn}>{alerts}</View> : null}
        </View>
      ) : (
        <>
          <Reveal index={3}>{frequent}</Reveal>
          <Reveal index={4}>{alerts}</Reveal>
        </>
      )}

      {/* Narrow web viewports get no sidebar, so the install and download
          links sit at the foot of the screen most visitors land on. */}
      {Platform.OS === 'web' && !isDesktop ? (
        <Reveal index={5}>
          <GetTheApp />
        </Reveal>
      ) : null}

      <StationPicker
        visible={fromPicker.visible}
        selectedCode={fromPicker.station?.code}
        onSelect={fromPicker.select as (s: { code: string; name: string }) => void}
        onClose={fromPicker.close}
        title="From"
      />
      <StationPicker
        visible={toPicker.visible}
        selectedCode={toPicker.station?.code}
        onSelect={toPicker.select as (s: { code: string; name: string }) => void}
        onClose={toPicker.close}
        title="To"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.base,
    gap: spacing.xl,
    paddingBottom: spacing['4xl'],
  },
  contentDesktop: {
    padding: spacing.xl,
  },
  desktopColumns: {
    flexDirection: 'row',
    gap: spacing.xl,
    alignItems: 'flex-start',
  },
  desktopColumn: {
    flex: 1,
    minWidth: 0,
  },
  masthead: {
    gap: spacing.sm,
  },
  mastheadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  date: {
    flex: 1,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '500',
    letterSpacing: -0.5,
  },
  planner: {
    borderRadius: 32,
    padding: spacing.sm,
    marginHorizontal: -spacing.xs,
  },
  plannerControls: {
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 56,
  },
  section: {
    gap: spacing.xs,
  },
  groupList: {
    gap: 3,
  },
  groupTile: {
    borderRadius: shape.sm,
  },
  groupTileFirst: {
    borderTopLeftRadius: shape.xl,
    borderTopRightRadius: shape.xl,
  },
  groupTileLast: {
    borderBottomLeftRadius: shape.xl,
    borderBottomRightRadius: shape.xl,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: spacing.base,
    paddingVertical: 14,
  },
  miniRail: {
    alignItems: 'center',
    width: 10,
  },
  miniRing: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2.5,
  },
  miniLine: {
    width: 3,
    height: 16,
    opacity: 0.6,
  },
  miniDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  routeNames: {
    flex: 1,
    gap: 6,
  },
  routeMeta: {
    alignItems: 'flex-end',
  },
  notifList: {
    gap: spacing.sm,
  },
});
