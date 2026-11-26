import { useHaptics } from '../hooks/useHaptics';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useNotificationsQuery } from '../hooks';
import { NotificationCard, type NoticePosition } from '../components/NotificationCard';
import { LoadingState } from '../components/LoadingState';
import { OfflineNote } from '../components/OfflineNote';
import { ErrorState } from '../components/ErrorState';
import { EmptyState } from '../components/EmptyState';
import { SectionHeader } from '../components/SectionHeader';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { spacing } from '../theme';

function positionOf(index: number, count: number): NoticePosition {
  if (count === 1) return 'single';
  if (index === 0) return 'first';
  if (index === count - 1) return 'last';
  return 'middle';
}

/** Passenger notices published by BMRCL, newest first. */
export function NotificationsScreen() {
  const theme = useTheme();
  const haptics = useHaptics();
  const isDesktop = useIsDesktop();
  const { data, isLoading, isError, isOfflineCopy, refetch, isRefetching } =
    useNotificationsQuery();

  if (isLoading) {
    return <LoadingState message="Loading notices" subtitle="BMRCL passenger notices" />;
  }
  const count = data?.length ?? 0;

  const ListHeader = (
    <View style={styles.header}>
      {isOfflineCopy ? (
        <OfflineNote message="Saved notices. Newer ones will appear when you're back online." />
      ) : null}
      {count > 0 ? <SectionHeader title="Passenger notices" count={count} /> : null}
    </View>
  );

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={[styles.list, isDesktop && styles.listDesktop]}
      ListHeaderComponent={ListHeader}
      ItemSeparatorComponent={Separator}
      renderItem={({ item, index }) => (
        <NotificationCard notification={item} position={positionOf(index, count)} />
      )}
      refreshing={isRefetching}
      onRefresh={() => {
        haptics.select();
        void refetch();
      }}
      ListEmptyComponent={
        isError ? (
          <ErrorState
            message="Couldn't load BMRCL notices"
            onRetry={refetch}
          />
        ) : (
          <EmptyState
            title="No notices right now"
            subtitle="BMRCL has no active passenger notices."
            icon="notifications-off-outline"
          />
        )
      }
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingHorizontal: spacing.base,
    paddingBottom: spacing['3xl'],
  },
  listDesktop: {
    paddingHorizontal: spacing.xl,
  },
  header: {
    gap: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  separator: {
    height: 3,
  },
});
