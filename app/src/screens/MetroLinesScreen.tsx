import { useHaptics } from '../hooks/useHaptics';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useTheme } from 'react-native-paper';
import { useMetroLinesQuery } from '../hooks';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { LoadingState } from '../components/LoadingState';
import { OfflineNote } from '../components/OfflineNote';
import { ErrorState } from '../components/ErrorState';
import { Touchable } from '../components/Touchable';
import { LineGlyph, lineGlyph, lineSubtitle, lineTitle, terminalName } from '../components/LineGlyph';
import { useAppTheme } from '../theme/ThemeContext';
import type { MetroLine } from '../types';
import type { NetworkStackParamList } from '../navigation/types';
import { spacing, shape, emphasis } from '../theme';

type Nav = NativeStackNavigationProp<NetworkStackParamList, 'Network'>;

function LineRow({ line, first, last }: { line: MetroLine; first: boolean; last: boolean }) {
  const navigation = useNavigation<Nav>();
  const theme = useTheme();
  const { fills, look } = useAppTheme();
  const material = look.style === 'material';

  const title = lineTitle(line);
  const subtitle = lineSubtitle(line);
  const from = terminalName(line.start_station);
  const to = terminalName(line.end_station);

  return (
    <Touchable
      radius={material ? shape.sm : 0}
      onPress={() =>
        navigation.navigate('LineStations', {
          lineCode: line.line_code,
          lineName: line.name,
          lineColor: line.primary_color_code,
        })
      }
      accessibilityLabel={`${title}, ${from} to ${to}`}
      style={material
        ? [
            styles.row,
            { backgroundColor: fills.containerLow },
            first && styles.rowFirst,
            last && styles.rowLast,
          ]
        : { borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: fills.hairline }}
    >
      <View style={styles.rowInner}>
        <LineGlyph color={line.primary_color_code} glyph={lineGlyph(line)} />
        <View style={styles.rowText}>
          <View style={styles.titleLine}>
            <Text
              variant="titleMedium"
              numberOfLines={1}
              style={[emphasis.strong, styles.title, { color: theme.colors.onSurface }]}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          {line.name_kn ? (
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {line.name_kn}
            </Text>
          ) : null}
          <Text
            variant="bodySmall"
            numberOfLines={2}
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {from} to {to}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.onSurfaceVariant} />
      </View>
    </Touchable>
  );
}

export function MetroLinesScreen() {
  const haptics = useHaptics();
  const { data, isLoading, isError, isOfflineCopy, refetch, isRefetching } =
    useMetroLinesQuery();
  const theme = useTheme();
  const { fills, look } = useAppTheme();
  const isDesktop = useIsDesktop();
  const material = look.style === 'material';
  const card = {
    backgroundColor: fills.containerLow,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: fills.hairline,
    borderRadius: look.radius.hero,
    overflow: 'hidden' as const,
  };

  const lines = useMemo(
    () => (data ?? []).filter((line) => line.show_in_frontend !== false),
    [data],
  );

  if (isLoading) return <LoadingState message="Loading metro lines..." />;
  if (isError && !data) {
    return <ErrorState message="Could not load metro lines" onRetry={refetch} />;
  }

  const total = lines.length;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => {
            haptics.select();
            void refetch();
          }}
        />
      }
    >
      {isOfflineCopy ? <OfflineNote message="Saved lines from your last visit." /> : null}

      <View style={styles.head}>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
          {total} {total === 1 ? 'line' : 'lines'}
        </Text>
      </View>

      <View style={styles.section}>
        <View style={[styles.list, isDesktop && styles.listDesktop, !material && !isDesktop && [card, styles.groupedList]]}>
          {lines.map((line, index) => (
            <View key={line.line_code} style={isDesktop && [styles.gridCell, !material && card]}>
              <LineRow
                line={line}
                first={isDesktop || index === 0}
                last={isDesktop || index === lines.length - 1}
              />
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.base,
    paddingBottom: spacing['3xl'],
    gap: spacing.lg,
  },
  contentDesktop: {
    padding: spacing.xl,
  },
  head: {
    gap: 4,
    paddingHorizontal: spacing.xs,
  },
  section: {
    gap: spacing.xs,
  },
  list: {
    gap: 3,
  },
  groupedList: {
    gap: 0,
  },
  listDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridCell: {
    width: '49%',
  },
  row: {
    borderRadius: shape.sm,
  },
  rowFirst: {
    borderTopLeftRadius: shape.xl,
    borderTopRightRadius: shape.xl,
  },
  rowLast: {
    borderBottomLeftRadius: shape.xl,
    borderBottomRightRadius: shape.xl,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingLeft: spacing.base,
    paddingRight: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: 3,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  title: {
    flexShrink: 1,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 3,
    height: 24,
    borderRadius: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
});
